import os

import sys, json;

# Reading json
data = biab_inputs()
intIn = data['some_int']
fileIn = data['some_file']
if not os.path.exists(fileIn):
  biab_error_stop(f"File '{fileIn}' does not exist.")

 # We are not actually reading all the multiple json array files we receive in this test.
 # The script will not be executed as it's hpc results will be mocked.

with open(fileIn, 'r') as f:
  content = f.read()
  print("Contents of csv input:")
  print(content)

intIn += 1

biab_output("increment", intIn)