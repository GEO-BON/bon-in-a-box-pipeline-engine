import subprocess
import json
import re
from datetime import datetime, timedelta

## This script cleans up all BON in a Box images from GitHub that don't have a special tag.

# True, staging branches are deleted.
# False, it keeps only the the head of all staging branches.
delete_staging=False

org = "geo-bon"


def run_gh_get_versions(package):
    cmd = ["gh", "api", f"/users/{org}/packages/container/{package}/versions"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return None
    return result.stdout

def get_versions(package):
    print("Fetching package versions...")
    output = run_gh_get_versions(package)
    return json.loads(output) if output else []

def is_git_sha(tag):
    return (re.fullmatch(r"sha-[a-f0-9]{7,}", tag) is not None
        or re.fullmatch(r"sha256-[a-f0-9]+", tag) is not None)

def is_staging(tag):
    return re.fullmatch(r".*staging", tag) is not None

def should_delete(tag):
    return (is_git_sha(tag)
            or (delete_staging and is_staging(tag))
        )

def delete_version(package, version_id):
    print(f"       X {version_id}...")
    cmd = ["gh", "api",
            "--method", "DELETE",
            "-H", "Accept: application/vnd.github+json",
            "-H", "X-GitHub-Api-Version: 2022-11-28",
            "--input", "/dev/null",
            f"/orgs/{org}/packages/container/{package}/versions/{version_id}"]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return None
    return result.stdout


def cleanup(package):
    versions = get_versions(package)

    # Get a datetime object
    for version in versions:
        version["created_dt"] = datetime.strptime(version["created_at"], "%Y-%m-%dT%H:%M:%SZ")

    # Releases are duplicated in GitHub. Group them by time, this should work 99% of the time.
    groups = [[]]
    for version in versions:
        current_group=groups[len(groups) -1]
        if len(current_group) == 0: # covers the first iteration only
            current_group.append(version)
        else:
            delta = current_group[-1]["created_dt"] - version["created_dt"]
            if delta <= timedelta(seconds=30):
                current_group.append(version)
            else:
                groups.append([version])


    for group in groups:
        tags=[]
        for version in group:
            tags.extend(version.get("metadata", {}).get("container", {}).get("tags", []))


        important_tags = [x for x in tags if not should_delete(x)]
        if len(important_tags) == 0:
            print("DELETE", tags)
            for version in group:
                delete_version(package, version["id"])
        else:
            print("KEEP  ", tags)

def main():
    print("Cleaning up gateway")
    cleanup("bon-in-a-box-pipeline-engine%2Fgateway")
    print("Cleaning up script-server")
    cleanup("bon-in-a-box-pipeline-engine%2Fscript-server")
    print("Cleaning up runner-conda")
    cleanup("bon-in-a-box-pipelines%2Frunner-conda")
    print("Cleaning up runner-julia")
    cleanup("bon-in-a-box-pipelines%2Frunner-julia")

if __name__ == "__main__":
    main()
