import json
import sys

# Read inputs, calling script shoud assign the return value to a variable
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