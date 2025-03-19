#!/bin/bash

# This script checks for allowed commands in a loop per line
THIS_SCRIPT=$(basename $0)

function reject_command() {
	echo "Command rejected by $THIS_SCRIPT: $1"
	logger -t automation -p local0.info "Command rejected by $THIS_SCRIPT for user $USER: $1"
	exit
}

function test_line() {
    line=$1
	echo $line
	case "$line" in
		# always available commands
		ls*|cat*|cd*|echo*|uname*|id*|groups*)
			$line
		;;
		# file commands
		mv*|cp*|rm*|mkdir*)
            $line
		;;
		# python commands
		python*|python3*|python3.6*|python3.7*|python3.8*|python3.9*|python3.10*|python3.11*|python2*|python2.7*)
            $line
		;;
		# git
		git*)
            $line
		;;
		# archiving commands
		tar*|dar*|gzip*|zip*|bzip2*)
            $line
		;;
		# rsync
		rsync*)
            $line
		;;
		# sftp and new scp
		/usr/libexec/openssh/sftp-server*)
            $line
		;;
		# old scp
		scp*)
            $line
		;;
		# slurm commands
		squeue*|scancel*|sbatch*|scontrol*|sq*)
			$line
		;;
		# commands needed for apptainer
		module*|apptainer*)
			$line
		;;
		"")
			echo "Discarding empty line"
		;;
		*)
			reject_command "$line"
        ;;
	esac
}


logger -t automation -p local0.info "Command called by $THIS_SCRIPT for user $USER: $SSH_ORIGINAL_COMMAND"
# This condition comes from the DRAC sample. Not sure why it is there.
if [[ "$THIS_SCRIPT" == "allowed_commands.sh" || "$THIS_SCRIPT" == "slurm_commands.sh" ]]; then
    while IFS= read -r line; do
        test_line "$line"
    done <<< "$SSH_ORIGINAL_COMMAND"
else
    reject_command "$SSH_ORIGINAL_COMMAND"
fi
