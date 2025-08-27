import sys, json;

# Reading json
data = biab_inputs()
value = data['float_value']
divider = data['divider']

output = {
  "result": (value / divider)
}

# Serializing json
json_object = json.dumps(output, indent = 2)
with open(sys.argv[1] + '/' + "output.json", "w") as outfile:
    outfile.write(json_object)