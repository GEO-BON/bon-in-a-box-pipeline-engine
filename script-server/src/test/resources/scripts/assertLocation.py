import sys, json

# Reading inputs
data = biab_inputs()
some_input = data['some_input']
print(f"Input received: {some_input}")

print("Is valid json?")
if not isinstance(some_input, dict) :
    print("No.")
    biab_error_stop('This is not a json object')

print("Yes!")

print("Is valid location?")
required_keys = {"country", "region", "CRS", "bbox"}

if not required_keys.issubset(some_input):
    print("No.")
    biab_error_stop("Country object must contain ISO3, bboxWGS84 and englishName")

print("Yes!")

# Write outputs
biab_output('the_same', some_input)