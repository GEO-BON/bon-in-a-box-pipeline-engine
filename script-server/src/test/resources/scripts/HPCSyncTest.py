import os

import sys, json;

# Reading json
data = biab_inputs()
intIn = data['some_int']
fileIn = data['some_file']
if not os.path.exists(fileIn):
  biab_error_stop(f"File '{fileIn}' does not exist.")

intIn += 1

biab_output("increment", intIn)