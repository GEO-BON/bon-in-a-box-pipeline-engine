#!/bin/bash
# Build, conda-pack and upload to S3 every conda environment used by BON in a Box
# scripts, plus the two shared base environments (rbase, pythonbase).
# Archives are tagged with the current pipeline-repo commit, and an unsuffixed
# "latest" copy is also kept so condaEnvironment.sh's CONDA_PACK_URL download
# path keeps working unmodified.
#
# Env vars:
#   SCRIPTS_ROOT        Path to pipeline-repo/scripts (required)
#   CONDA_ENV_YML_DIR   Where extracted per-env yml specs are written (default: /conda-env-yml)
#   WORK_DIR            Scratch dir for packed archives before upload (default: /tmp/conda-pack-upload)
#   GIT_COMMIT          Commit hash to tag archives with (required)
#   S3_BUCKET           Target bucket (default: conda-pack)
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / S3_ENDPOINT_URL   Read directly by s5cmd

set -o pipefail

SCRIPTS_ROOT=${SCRIPTS_ROOT:?SCRIPTS_ROOT must be set}
GIT_COMMIT=${GIT_COMMIT:?GIT_COMMIT must be set}
CONDA_ENV_YML_DIR=${CONDA_ENV_YML_DIR:-/conda-env-yml}
WORK_DIR=${WORK_DIR:-/tmp/conda-pack-upload}
S3_BUCKET=${S3_BUCKET:-conda-pack}

failedEnvs=()
packedCount=0

function assertSuccess {
    if [[ $? -ne 0 ]] ; then
        echo -e "FAILED" ; exit 1
    fi
}

# Writes $CONDA_ENV_YML_DIR/<envName>.yml for every scripts/**/*.yml that has a
# top-level `conda:` key, using the same envName transform as ScriptStep.kt
# (relative path from scripts root, '/' -> '__', ' ' -> '_', strip .yml suffix).
# Prints one envName per line.
function extractPerScriptEnvs {
    python3 - "$SCRIPTS_ROOT" "$CONDA_ENV_YML_DIR" <<'EOF'
import pathlib, sys, yaml

scriptsRoot, condaEnvYmlDir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
condaEnvYmlDir.mkdir(parents=True, exist_ok=True)

for ymlFile in sorted(scriptsRoot.rglob("*.yml")):
    doc = yaml.safe_load(ymlFile.read_text()) or {}
    condaSection = doc.get("conda")
    if not condaSection:
        continue

    envName = str(ymlFile.relative_to(scriptsRoot)).replace("/", "__").replace(" ", "_")
    envName = envName.removesuffix(".yml")
    condaSection["name"] = envName

    (condaEnvYmlDir / f"{envName}.yml").write_text(yaml.dump(condaSection))
    print(envName)
EOF
}

# Packs one env to $WORK_DIR/<envName>.tar.gz, uploads commit-tagged + latest
# copies to S3 alongside its yml, then cleans up.
function packAndUpload {
    envName=$1
    envYmlPath=$2

    if ! mamba env list | grep -q " $envName "; then
        echo "Creating conda environment $envName..."
        mamba env create -y -n "$envName" -f "$envYmlPath"
        if [[ $? -ne 0 ]] ; then
            echo "    FAILED to create $envName."
            failedEnvs+=("$envName")
            return
        fi
    fi

    echo "Packing conda environment $envName..."
    mamba activate base ; assertSuccess
    tar="$WORK_DIR/$envName.tar"
    conda-pack --n-threads -1 --quiet -n "$envName" -o "$tar" --compress-level 0
    if [[ $? -ne 0 ]] ; then
        echo "    FAILED to pack $envName."
        failedEnvs+=("$envName")
        mamba deactivate # base
        return
    fi
    pigz "$tar" ; assertSuccess
    mamba deactivate # base

    zip="$tar.gz"
    yml="$WORK_DIR/$envName.yml"
    cp "$envYmlPath" "$yml" ; assertSuccess

    echo "Uploading $envName (commit $GIT_COMMIT)..."
    taggedZip="s3://$S3_BUCKET/$envName-$GIT_COMMIT.tar.gz"
    taggedYml="s3://$S3_BUCKET/$envName-$GIT_COMMIT.yml"
    s5cmd cp "$zip" "$taggedZip" ; assertSuccess
    s5cmd cp "$yml" "$taggedYml" ; assertSuccess

    # Refresh the unsuffixed "latest" pointer via a server-side copy, so
    # condaEnvironment.sh's CONDA_PACK_URL download path (which has no
    # knowledge of the commit hash) keeps finding the current archive.
    s5cmd cp "$taggedZip" "s3://$S3_BUCKET/$envName.tar.gz" ; assertSuccess
    s5cmd cp "$taggedYml" "s3://$S3_BUCKET/$envName.yml" ; assertSuccess

    rm -f "$zip" "$yml"
    packedCount=$((packedCount + 1))

    # Keep the base envs around, they are reused for every script without its own conda: section.
    if [[ "$envName" != "rbase" && "$envName" != "pythonbase" ]]; then
        mamba env remove -qy -n "$envName" > /dev/null 2>&1
    fi
}

source /.bashrc
mkdir -p "$CONDA_ENV_YML_DIR" "$WORK_DIR"

echo "Packing base environments..."
packAndUpload rbase /data/r-environment.yml
packAndUpload pythonbase /data/python-environment.yml

echo "Packing per-script environments..."
while IFS= read -r envName; do
    packAndUpload "$envName" "$CONDA_ENV_YML_DIR/$envName.yml"
done < <(extractPerScriptEnvs)

echo "Packed and uploaded $packedCount environment(s)."
if [[ ${#failedEnvs[@]} -gt 0 ]]; then
    echo "FAILED environments: ${failedEnvs[*]}"
    exit 1
fi
