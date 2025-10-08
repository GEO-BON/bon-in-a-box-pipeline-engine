import sys, json, os.path;

# Reading input.json
data = biab_inputs()
pathIn = data['file']

# Checking if this is a file...
present = os.path.isfile(pathIn)

# Serializing output.json
dictionary = {
  "presence":present
}
json_object = json.dumps(dictionary, indent = 2)
with open(sys.argv[1] + '/output.json', "w") as outfile:
    outfile.write(json_object)