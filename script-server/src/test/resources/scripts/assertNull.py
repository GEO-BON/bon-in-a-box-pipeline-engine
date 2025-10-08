import sys, json;
print("start")
# Reading input.json
data = biab_inputs()
print(data)
stringIn = data['input']

# Do stuff.
if stringIn is not None:
    print("This is not null")
    biab_error_stop("This is not null")

# Serializing output.json
biab_output("the_same", stringIn)
