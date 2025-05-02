#!/bin/bash
echo '{"randomness": 234}' | tee "$1/output.json"

# Note: using tee, since with the following command sometimes the file is created with a delay.
# echo '{\n"randomness": 234\n}' > "$1/output.json"
