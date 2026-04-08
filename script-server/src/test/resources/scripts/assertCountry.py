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

print("Is valid country?")
country = some_input["country"]
required_keys = {"ISO3", "bboxWGS84", "englishName"}

if not required_keys.issubset(country):
    print("No.")
    biab_error_stop("Country object must contain ISO3, bboxWGS84 and englishName")

if not isinstance(country["ISO3"], str) or len(country["ISO3"]) != 3:
    print("No.")
    biab_error_stop("ISO3 must be a 3-letter string")

bbox = country["bboxWGS84"]
if (
    not isinstance(bbox, list)
    or len(bbox) != 4
    or not all(isinstance(v, (int, float)) for v in bbox)
):
    print("No.")
    biab_error_stop("bboxWGS84 must be a list of 4 numbers")

if not isinstance(country["englishName"], str) or not country["englishName"].strip():
    print("No.")
    biab_error_stop("englishName must be a non-empty string")

print("Yes!")

# Write outputs
biab_output('the_same', some_input)