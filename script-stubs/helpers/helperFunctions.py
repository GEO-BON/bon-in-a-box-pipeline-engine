import json
import sys

def biab_inputs():
	inputFile = open(sys.argv[1] + '/input.json')
	return json.load(inputFile)

def biab_output(key, value):
	biab_output_list[ key ] = value
	print("Output added for \"", key, "\"\n")


def biab_info(message):
	biab_output("info", message)

def biab_warning(message):
	biab_output("warning", message)

def biab_error_stop(errorMessage):
	biab_output_list[ "error" ] = errorMessage
	sys.exit(errorMessage)