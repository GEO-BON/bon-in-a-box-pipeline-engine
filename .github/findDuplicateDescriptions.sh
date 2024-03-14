#!/bin/bash

RED="\033[31m"
ENDCOLOR="\033[0m"

echo "Checking for duplicate lines inside each yml file..."
# This is a frequent error in step YML files when adding an additionnal param :
# Copy paste the param above and forget to change the description!

# Checking inside the same file only :
# some description duplication will occur naturally between files and it's OK.
# ex. "Species name" description should always look the same!

# By using description:\s+\w+, we avoid matching "description: |" that is the yml syntax for mutliline comments.
# Limitation: this does not check multiline description...

RESULTS=$(find . -name "*.yml" -exec sh -c "echo {}; \
grep -E \"description:\s+\w+
text:
doi:\" '{}' \
  | sort \
  | uniq -d \
  | awk '{print \"${RED}\" \"[DUPLICATE] \" \$0 \"${ENDCOLOR}\"}'" \;)

echo "$RESULTS"

if [[ "$RESULTS" == *"[DUPLICATE]"* ]]
  then exit 1
fi

echo "No duplicates found."
echo ""