import sys, json;

# Reading input.json
inputFile = open(sys.argv[1] + '/input.json')
data = json.load(inputFile)
some_object = data['some_object']

# Do stuff.
def is_valid_json(jsonString):
    try:
        json.loads(jsonString)
        return True
    except ValueError:
        return False

if not is_valid_json(some_object) :
    sys.exit("This is not a json object")

# Serializing output.json
dictionary = {
  "some_object": some_object
}
json_object = json.dumps(dictionary, indent = 2)
with open(sys.argv[1] + '/output.json', "w") as outfile:
    outfile.write(json_object)