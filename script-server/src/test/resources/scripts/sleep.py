import sys, json, time;

# Reading json
inputFile = open(sys.argv[1] + '/input.json')
data = json.load(inputFile)
delay = data['delay']

time.sleep(delay)

dictionary = {
  "elapsed": delay
}

# Serializing json
json_object = json.dumps(dictionary, indent = 2)
with open(sys.argv[1] + '/' + "output.json", "w") as outfile:
    outfile.write(json_object)