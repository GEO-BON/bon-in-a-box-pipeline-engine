import sys, json;

# Reading input.json
data = biab_inputs()
input = data['input']

# Do stuff.
if not isinstance(input, float) :
    biab_error_stop("This is not a float")

# Serializing output.json
biab_output("the_same", input)