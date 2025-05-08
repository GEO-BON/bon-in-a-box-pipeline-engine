import sys, json;

import os
print(os.environ['SCRIPT_SERVER_CACHE_CLEANER'])

# Reading input.json
inputs = biab_inputs()
intIn = inputs['some_int']

# Do stuff.
if intIn == 13 :
  biab_error_stop("some_int == 13, you're not lucky! This causes failure.")

intIn += 1

# Serializing output.json
biab_output("increment", intIn)
