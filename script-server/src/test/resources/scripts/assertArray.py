import sys, json;

# Reading input.json
data = biab_inputs()
arrayIn = data['array']

# Checking if this is an array...
if not isinstance(arrayIn, list) :
    biab_error_stop("This is not an array")

# Serializing output.json
biab_output("the_same", arrayIn)