using JSON
using Pkg

output_folder = ARGS[1]
script_file_path = ARGS[2]

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

pid_file_path = joinpath(output_folder, ".pid")
open(pid_file_path, "w") do file write(file, string(getpid())) end;

# Internal use: Outputs the saved outputs and environment
function on_exit()
    global biab_output_dict
    global pid_file_path

    if !isempty(biab_output_dict)
        try print("Writing outputs to BON in a Box...\n") catch; end # this throws when called after an interrupt (but the log still goes through)
        jsonData = JSON.json(biab_output_dict, 2)
        open(joinpath(output_folder, "output.json"), "w") do f
            write(f, jsonData)
        end

    end

    try print("Writing dependencies to file...\n") catch; end
    deps = Pkg.dependencies()
    direct_deps = filter(x -> x[2].is_direct_dep, deps)
    open(joinpath(output_folder, "dependencies.txt"), "w") do file
        for (uuid, pkg) in direct_deps
            write(file, "$(pkg.name) $(pkg.version)")
        end
    end
    try print(" done.\n") catch; end
    flush(stdout)

    rm(pid_file_path)
end

atexit(on_exit)

try
    include(script_file_path)
catch e
    msg = sprint(showerror, e)
    biab_output_dict["error"] = msg
    println("\n$msg\n")
    Base.show_backtrace(stdout, catch_backtrace())
    println("\n\n")
end