options(error=traceback, keep.source=TRUE, show.error.locations=TRUE)

# Define repo for install.packages
repositories = getOption("repos")
repositories["CRAN"] = "https://cloud.r-project.org/"
options(repos = repositories)

library(rjson)

# Load variables
args <- commandArgs(trailingOnly = TRUE)
outputFolder <- args[1]
scriptFile <- args[2]

biab_output_list <- list()

## Helper functions definitions
# Read inputs, calling script should assign the return value to a variable
biab_inputs <- function(){
    rjson::fromJSON(file=file.path(outputFolder, "input.json"))
}

# Add outputs throughout the script
biab_output <- function(key, value){
    biab_output_list[[ key ]] <<- value
    cat("Output added for \"", key, "\"\n")
}

# Non-breaking messages
biab_info <- function(message) biab_output("info", message)
biab_warning <- function(message) biab_output("warning", message)

# Output error message and stop the pipeline
biab_error_stop <- function(errorMessage){
    biab_output_list[[ "error" ]] <<- errorMessage
    stop(errorMessage)
}

# Wait for R's own package install lock directories to clear.
wait_for_r_pkg_unlock <- function(pkg, timeout_sec = 600, poll_sec = 0.25) {
    start_time <- Sys.time()
    lock_dirs <- c(file.path(.libPaths(), paste0("00LOCK-", pkg)), file.path(.libPaths(), "00LOCK"))
    waiting_logged <- FALSE

    repeat {
        active_locks <- lock_dirs[dir.exists(lock_dirs)]
        if (length(active_locks) == 0) {
            if (waiting_logged) {
                elapsed <- as.numeric(difftime(Sys.time(), start_time, units = "secs"))
                print(sprintf("R package lock released for '%s' after %.2f seconds", pkg, elapsed))
            }
            return(invisible(TRUE))
        }

        if (!waiting_logged) {
            print(sprintf(
                "Waiting for R package install lock for '%s': %s",
                pkg,
                paste(basename(active_locks), collapse = ", ")
            ))
            waiting_logged <- TRUE
        }

        elapsed <- as.numeric(difftime(Sys.time(), start_time, units = "secs"))
        if (elapsed >= timeout_sec) {
            biab_error_stop(sprintf("Timeout while waiting for R package lock for '%s'", pkg))
        }
        Sys.sleep(poll_sec)
    }
}

biab_ensure_package <- function(pkg, version = NULL, installer, timeout_sec = 600, poll_sec = 0.25) {
    has_required_version <- function() {
        requireNamespace(pkg, quietly = TRUE) &&
            (is.null(version) || utils::packageVersion(pkg) == version)
    }

    start_time <- Sys.time()
    repeat {
        elapsed <- as.numeric(difftime(Sys.time(), start_time, units = "secs"))
        if (elapsed >= timeout_sec) {
            biab_error_stop(sprintf("Package '%s' failed to install required version in time", pkg))
        }

        wait_for_r_pkg_unlock(pkg, timeout_sec = timeout_sec, poll_sec = poll_sec)
        if (has_required_version()) {
            print(sprintf("Package '%s' is installed and meets version requirements", pkg))
            return(invisible(TRUE))
        }

        print(sprintf("Installing package '%s' (required version: %s)", pkg, ifelse(is.null(version), "any", version)))
        install_ok <- TRUE
        tryCatch(
            installer(),
            error = function(e) {
                msg <- conditionMessage(e)
                if (grepl("failed to lock directory|00LOCK", msg, ignore.case = TRUE)) {
                    install_ok <<- FALSE
                } else {
                    print("Done.")
                    stop(e)
                }
            }
        )

        if (!install_ok) {
            Sys.sleep(poll_sec)
        }
    }
}

## Execution
# Create PID file
pidFile <- file.path(outputFolder, ".pid")
writeLines(as.character(Sys.getpid()), pidFile)
on.exit(unlink(pidFile), add = TRUE)

# Execute the script
exitCode <- 0
tryCatch(
    {
        withCallingHandlers(source(scriptFile),
            error=function(e){
                if(grepl("ignoring SIGPIPE signal",e$message)) {
                    cat("Suppressed: ignoring SIGPIPE signal\n");
                } else {
                    exitCode <<- 1
                    if (is.null(biab_output_list[["error"]])) {
                        biab_output_list[["error"]] <<- conditionMessage(e)
                        cat("Caught error, stack trace:\n")
                        print(sys.calls()[-seq(1:5)])
                    }
                }
            }
        )
    },
    interrupt = function(i) {
        cat("R wrapper caught interrupt\n");
        biab_output_list[["error"]] <<- "Cancelled"
        exitCode <<- 130
    },
    error = function(e) {
        # Error already handled in withCallingHandlers
    }
)

suspendInterrupts({
    if(length(biab_output_list) > 0) {
        cat("Writing outputs to BON in a Box...\n")
        jsonData <- rjson::toJSON(biab_output_list, indent=2)
        write(jsonData, file.path(outputFolder, "output.json"))
    }

    cat("Writing dependencies to file...\n")
    capture.output(sessionInfo(), file = paste0(outputFolder, "/dependencies.txt"))
    cat(" done.\n")
})

gc()
quit(status=exitCode)