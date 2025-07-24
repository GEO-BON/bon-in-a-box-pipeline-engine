#!/bin/python3
import os, sys, json

biab_output_list = {}

# Read inputs, calling script should assign the return value to a variable
def biab_inputs():
	inputFile = open(sys.argv[1] + '/input.json')
	return json.load(inputFile)

# Add outputs throughout the script
def biab_output(key, value):
	biab_output_list[ key ] = value
	print("Output added for \"", key, "\"\n")

# Non-breaking messages
def biab_info(message):
	biab_output("info", message)

def biab_warning(message):
	biab_output("warning", message)

# Output error message and stop the pipeline
def biab_error_stop(errorMessage):
	biab_output_list[ "error" ] = errorMessage
	sys.exit(errorMessage)


if __name__ == "__main__":
	# Receive args
	output_folder = os.path.abspath(sys.argv[1])
	script_path = os.path.abspath(sys.argv[2])

	# Add script dir to sys.path
	script_dir = os.path.dirname(os.path.abspath(script_path))
	sys.path.insert(0, script_dir)

	# Run script
	try:
		exec(open(script_path).read(), globals())
	except:
		raise
	finally: # Write the output.json file
		if biab_output_list:
			print("Writing outputs to BON in a Box...", flush=True)
			with open(output_folder + "/output.json", "w") as outfile:
				outfile.write(json.dumps(biab_output_list, indent = 2))

		# Capture dependencies for this run
		print("Writing dependencies to file...", flush=True)
		os.system("/opt/conda/bin/pip freeze > " + output_folder + "/dependencies.txt")
		print(" done.", flush=True)

