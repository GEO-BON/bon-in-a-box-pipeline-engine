#!/bin/bash

THIS_SCRIPT=$(basename $0)

RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
ENDCOLOR="\033[0m"

function reject_command() {
	echo -e "${YELLOW}Command rejected by $THIS_SCRIPT: $1${ENDCOLOR}"
	logger -t automation -p local0.info "Command rejected by $THIS_SCRIPT for user $USER: $1"
	if ! $testing; then
		exit 1
	fi
}

function is_safe_command() {
	local cmd="$1"

	# In case we are inside an if, ignore the "then" keyword
	cmd=$(echo "$cmd" | sed 's/^then //')

	local safe_patterns=(
		# always available commands
		"^ls( |$)"
		"^cat "
		"^cd "
		"^echo "
		"^uname( |$)"
		"^id( |$)"
		"^groups( |$)"
		# file commands
		"^mv "
		"^cp "
		"^rm "
		"^mkdir "
		# python commands
		"^python[0-9.]* "
		# git
		"^git "
		# archiving commands
		"^tar "
		"^dar "
		"^gzip "
		"^zip "
		"^bzip2 "
		# rsync
		"^rsync "
		# sftp and new scp
		"^/usr/libexec/openssh/sftp-server "
		# old scp
		"^scp "
		# slurm commands
		"^squeue "
		"^scancel "
		"^sbatch "
		"^scontrol "
		"^sq "
		# commands needed for apptainer
		"^module "
		"^apptainer "
		# conditionals
		"^if "
		"^fi( |$)"
		"^else( |$)"
		"^elif "

		# DO NOT ALLOW "sed"!
		# someone could do
		# sed -i 's/\# Validate and execute/testing=true/' allowed_commands.sh
	)

	local safe_file_tests=(
		"^\\[ -f "  # Test for file existence
		"^\\[ -d "  # Test for directory existence
		"^\\[ -r "  # Test for file readability
		"^\\[ -w "  # Test for file writability
		"^\\[ -x "  # Test for file executability
		"^\\[ -e "  # Test for file existence (any type)
		"^test -f " # Alternative file test syntax
		"^test -d " # Alternative directory test syntax
	)

	# Check against safe commands
	for pattern in "${safe_patterns[@]}"; do
		if [[ "$cmd" =~ $pattern ]]; then
			return 0
		fi
	done

	# Check against safe file tests for conditional blocks
	for pattern in "${safe_file_tests[@]}"; do
		if [[ "$cmd" =~ $pattern ]]; then
			return 0
		fi
	done

	return 1
}

function validate_complex_command() {
	local fullCommand="$1"
	local in_conditional=false
	local conditional_allowed=false

	while IFS= read -r line; do
		line="${line//&&/;}" # Replace '&&' by ';', in our case we just want them to be split.
		IFS=';' read -ra cmds <<<"$line"
		for cmd in "${cmds[@]}"; do
			# Trim whitespace using xargs
			# xargs removes leading/trailing whitespace and condenses multiple spaces
			cmd=$(echo "$cmd" | xargs)

			# Skip empty lines
			[[ -z "$cmd" ]] && continue

			if ! is_safe_command "$cmd"; then
				reject_command "$cmd"
				return 1
			fi
		done
	done <<<"$fullCommand"

	return 0
}

function test_command_filter() {
	testing=true
	passed=true

	# Command, Expected Result (PASS/FAIL)
	local test_cases=(
		## Supposed to PASS
		"ls -l=PASS"
		"cat file.txt=PASS"
		"if [ -f image.sif ]; then apptainer build image.sif docker://ubuntu; fi=PASS"
		"python3 script.py=PASS"
		"rm some_file=PASS"
		"rm -rf some_folder=PASS"
		"if [ -d /tmp ]; then echo 'Directory exists'; else echo 'No directory'; fi=PASS"
		"if [ -f /nonexistent ]; then rm some_file; fi=PASS"
		"if [ -f /nonexistent ]; then rm some_file; fi ; ls=PASS"
		"module load python=PASS"
		"apptainer build image.sif docker://ubuntu=PASS"

		## Supposed to FAIL
		"module load python; forbiddenCommand=FAIL"   # this test is failing
		"module load python && forbiddenCommand=FAIL" # this test is failing
		"forbiddenCommand=FAIL"
		"lspasswd=FAIL" # this one starts with ls (allowed) but has a non-allowed ending.
		"if [ -f /nonexistent ]; then forbiddenCommand; fi=FAIL"
		"if [ -f /nonexistent && forbiddenCommand ]; then ls; fi=FAIL"
		"if [ -f /nonexistent ];
            forbiddenCommand
        fi=FAIL" # this test is failing
		"sudo su=FAIL"
	)

	echo "Starting Command Filter Test Suite"
	echo "--------------------------------"

	for test_case in "${test_cases[@]}"; do
		# Use parameter expansion to split the last '=' occurrence
		cmd="${test_case%=*}"
		expected="${test_case##*=}"

		echo "Testing command: '$cmd'"

		if validate_complex_command "$cmd"; then
			result="PASS"
		else
			result="FAIL"
		fi

		if [[ "$result" == "$expected" ]]; then
			echo -e "${GREEN}PASS ✓ ${ENDCOLOR}(Expected: $expected, Got: $result)"
		else
			echo -e "${RED}FAIL ✗ (Expected: $expected, Got: $result)${ENDCOLOR}"
			passed=false
		fi
	done

	echo "--------------------------------"
	if $passed; then
		echo "Test suite completed successfully"
	else
		echo -e "${RED}Test suite completed with errors${ENDCOLOR}"
	fi
}

# Main execution logic
logger -t automation -p local0.info "Command called by $THIS_SCRIPT for user $USER: $SSH_ORIGINAL_COMMAND"

# Check if this is a test run
if [[ "$SSH_ORIGINAL_COMMAND" == "test_command_filter" || $1 == "test_command_filter" ]]; then
	test_command_filter
	exit 0
fi

# Check script name condition from original DRAC sample script
if [[ "$THIS_SCRIPT" == "allowed_commands.sh" ]]; then
	# Validate and execute
	if validate_complex_command "$SSH_ORIGINAL_COMMAND"; then
		bash -c "$SSH_ORIGINAL_COMMAND"
	fi
else
	reject_command "$SSH_ORIGINAL_COMMAND"
fi
