import sys, json;

# Reading input.json
inputs = biab_inputs()
intIn = inputs['some_int']

# Do stuff.
if intIn == 13 :
  print("some_int == 13, you're not lucky! This causes failure.")
  sys.exit(1)

intIn += 1

# Serializing output.json
biab_output("increment", intIn)
