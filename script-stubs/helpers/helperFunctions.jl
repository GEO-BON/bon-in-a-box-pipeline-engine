using JSON


biab_output_dict = Dict{String, Any}()

# Read the inputs from input.json
function biab_inputs()
    if !isfile("input.json")
        biab_error_stop("Input file 'input.json' not found.")
    end
    return JSON.parsefile("input.json")
end

# Add outputs throughout the script
function biab_output(key::String, value)
    global biab_output_dict
    biab_output_dict[key] = value
    println("Output added for \"$key\"")
end

# Non-breaking messages
biab_info(message) = biab_output("info", message)
biab_warning(message) = biab_output("warning", message)

# Output error message and stop the pipeline
function biab_error_stop(errorMessage)
    global biab_output_dict
    biab_output_dict["error"] = errorMessage
    error(errorMessage)
end
