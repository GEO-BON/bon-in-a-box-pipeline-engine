import sys, json;

# Reading json
data = biab_inputs()
intIn = data['some_int']

intIn += 1

dictionary = {
  "increment": intIn,
  "tell_me": "What a wonderful "
}

# Serializing json
json_object = json.dumps(dictionary, indent = 2)
with open(sys.argv[1] + '/' + "output.json", "w") as outfile:
    outfile.write(json_object)