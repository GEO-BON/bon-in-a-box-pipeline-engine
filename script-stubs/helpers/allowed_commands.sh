#!/bin/bash

THIS_SCRIPT=$(basename $0)

function reject_command() {
    echo "Command rejected by $THIS_SCRIPT: $1"
    logger -t automation -p local0.info "Command rejected by $THIS_SCRIPT for user $USER: $1"
    exit 1
}

function is_safe_command() {
    local cmd="$1"
    local safe_patterns=(
		# always available commands
        "^ls"
        "^cat"
        "^cd"
        "^echo"
        "^uname"
        "^id"
        "^groups"
		# file commands
        "^mv"
        "^cp"
        "^rm"
        "^mkdir"
		# python commands
        "^python[0-9.]*"
		# git
        "^git"
		# archiving commands
        "^tar"
        "^dar"
        "^gzip"
        "^zip"
        "^bzip2"
		# rsync
        "^rsync"
		# sftp and new scp
        "^/usr/libexec/openssh/sftp-server"
		# old scp
        "^scp"
		# slurm commands
        "^squeue"
        "^scancel"
        "^sbatch"
        "^scontrol"
		"^sq"
		# commands needed for apptainer
        "^module"
        "^apptainer"
		# conditionals
        "^if"
        "^fi"
        "^else"
        "^elif"
        "^\\["
        "^test"
    )

    for pattern in "${safe_patterns[@]}"; do
        if [[ "$cmd" =~ $pattern ]]; then
            return 0
        fi
    done
    return 1
}

function validate_complex_command() {
    local command="$1"

    while IFS= read -r line; do
        # Trim whitespace
        line=$(echo "$line" | xargs)

        # Skip empty lines
        [[ -z "$line" ]] && continue

        # Check if each line is a safe command
        if ! is_safe_command "$line"; then
            reject_command "$line"
        fi
    done <<< "$command"
}

logger -t automation -p local0.info "Command called by $THIS_SCRIPT for user $USER: $SSH_ORIGINAL_COMMAND"

# Check script name condition from original DRAC sample script
if [[ "$THIS_SCRIPT" == "allowed_commands.sh" || "$THIS_SCRIPT" == "slurm_commands.sh" ]]; then
    validate_complex_command "$SSH_ORIGINAL_COMMAND"

    # If validation passes, execute the command
    bash -c "$SSH_ORIGINAL_COMMAND"
else
    reject_command "$SSH_ORIGINAL_COMMAND"
fi