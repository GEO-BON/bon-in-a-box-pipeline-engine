import sys, json;

# Reading input.json
data = biab_inputs()
boolIn = data['input_bool']

# Do stuff.
if not isinstance(boolIn, bool) :
    biab_error_stop("This is not a boolean")

# Serializing output.json
biab_output("the_same", boolIn)