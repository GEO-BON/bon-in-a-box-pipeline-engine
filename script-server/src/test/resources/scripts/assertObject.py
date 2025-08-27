import sys, json

# Reading inputs
data = biab_inputs()
some_object = data['some_object']

print("Is valid json?")
if not isinstance(some_object, dict) :
    print("No.")
    biab_error_stop('This is not a json object')

print("Yes!")
# Write outputs
biab_output('some_object', some_object)