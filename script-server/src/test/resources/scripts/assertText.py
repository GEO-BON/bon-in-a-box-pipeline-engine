import sys, json;
print("start")
# Reading input.json
inputFile = open(sys.argv[1] + '/input.json')
data = json.load(inputFile)
print(data)
stringIn = data['input']

# Do stuff.
if stringIn is None:
    sys.exit("This is null")

if type(test_string) != str
     sys.exit("Not a string")

# Serializing output.json
dictionary = {
  "the_same": stringIn
}
json_object = json.dumps(dictionary, indent = 2)
with open(sys.argv[1] + '/output.json', "w") as outfile:
    outfile.write(json_object)
