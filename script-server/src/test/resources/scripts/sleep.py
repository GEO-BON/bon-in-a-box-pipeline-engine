import sys, json, time;

# Reading json
data = biab_inputs()
delay = data['delay']

time.sleep(delay)

dictionary = {
  "elapsed": delay
}

# Serializing json
json_object = json.dumps(dictionary, indent = 2)
with open(sys.argv[1] + '/' + "output.json", "w") as outfile:
    outfile.write(json_object)