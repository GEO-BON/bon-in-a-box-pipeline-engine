using Pkg
using FileWatching.Pidfile
using SHA

# Replaces this process (same PID, so the .pid file stays valid) with a fresh run of the wrapper.
function biab_restart(reason; project_dir=dirname(Base.active_project()))
    println("Restarting Julia $reason...")
    flush(stdout); flush(stderr)
    args = String[Base.julia_cmd().exec..., "--project=$project_dir", abspath(PROGRAM_FILE), ARGS...]
    GC.@preserve args begin
        argv = Ptr{UInt8}[pointer.(args)..., C_NULL]
        ccall(:execv, Cint, (Cstring, Ptr{Ptr{UInt8}}), args[1], argv)
    end
    error("Failed to restart Julia")
end

# A script with a Project.toml next to it runs in its own environment in the depot, seeded from
# that Project.toml and its Manifest. The copy is refreshed only when the source files change.
function biab_ensure_script_environment(script_file_path)
    script_dir = dirname(abspath(script_file_path))
    isfile(joinpath(script_dir, "Project.toml")) || return

    env_dir = joinpath(first(DEPOT_PATH), "environments", "biab", replace(strip(script_dir, '/'), '/' => '_'))
    files = filter(f -> f == "Project.toml" || occursin(r"^Manifest(-v[\d.]+)?\.toml$", f), readdir(script_dir))
    buf = IOBuffer()
    for f in files
        write(buf, f, read(joinpath(script_dir, f)))
    end
    digest = bytes2hex(sha256(take!(buf)))

    stamp = joinpath(env_dir, ".source_sha256")
    # The stamp is written last, so a matching stamp means the install completed.
    up_to_date() = isfile(stamp) && read(stamp, String) == digest
    in_env = abspath(dirname(Base.active_project())) == abspath(env_dir)

    if !up_to_date()
        mkpath(dirname(env_dir))
        mkpidlock(joinpath(first(DEPOT_PATH), "biab_pkg_install.lock"); wait=true, stale_age=120) do
            if !up_to_date()
                println("Preparing Julia environment for $script_dir")
                rm(env_dir; recursive=true, force=true)
                mkpath(env_dir)
                for f in files
                    cp(joinpath(script_dir, f), joinpath(env_dir, f))
                end
                Pkg.activate(env_dir)
                Pkg.instantiate()
                write(stamp, digest)
            end
        end
    end

    in_env || biab_restart("in the environment of this script"; project_dir=env_dir)
end

biab_ensure_script_environment(ARGS[2])

# Installs missing packages in the shared project; the lock serializes concurrent scripts.
# Restarts Julia after an install, since already-loaded packages cannot be swapped for the new versions.
function biab_ensure_package(pkgs::AbstractVector{<:AbstractString})
    missing_pkgs() = filter(p -> !haskey(Pkg.project().dependencies, p), pkgs)
    installed = false

    if !isempty(missing_pkgs())
        lock_path = joinpath(first(DEPOT_PATH), "biab_pkg_install.lock")
        mkpidlock(lock_path; wait=true, stale_age=120) do # 120 seconds
            # Another script may have installed them while we were waiting.
            to_add = missing_pkgs()
            if !isempty(to_add)
                println("Installing missing Julia packages: $to_add")
                Pkg.add(to_add)
                Pkg.precompile()
                installed = true
            end
        end
    end

    # Restart outside the lock so it is released first.
    installed && biab_restart("to load the newly installed packages")
end
biab_ensure_package(pkg::AbstractString) = biab_ensure_package([pkg])

biab_ensure_package("JSON")
using JSON

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
            write(file, "$(pkg.name) $(pkg.version)\n")
        end
    end

    # Exact package versions used by this run, to reproduce it later.
    for path in (Base.active_project(), Base.active_manifest())
        if path !== nothing && isfile(path)
            cp(path, joinpath(output_folder, basename(path)); force=true)
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