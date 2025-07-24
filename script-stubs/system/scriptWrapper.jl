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

try
    include(script_file_path)
catch e
    msg = sprint(showerror, e)
    biab_output_dict["error"] = msg
    println("\n$msg")
    Base.show_backtrace(stdout, catch_backtrace())
    println("\n\n")
finally
    if !isempty(biab_output_dict)
        println("Writing outputs to BON in a Box...")
        jsonData = JSON.json(biab_output_dict, 2)
        open(joinpath(output_folder, "output.json"), "w") do f
            write(f, jsonData)
        end

    end

    println("Writing dependencies to file...")
    deps = Pkg.dependencies()
    direct_deps = filter(x -> x[2].is_direct_dep, deps)
    open(joinpath(output_folder, "dependencies.txt"), "w") do file
        for (uuid, pkg) in direct_deps
            println(file, "$(pkg.name) $(pkg.version)")
        end
    end
    println(" done.")
    flush(stdout)

    rm(pid_file_path)
end