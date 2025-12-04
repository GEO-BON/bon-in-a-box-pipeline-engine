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
    fromJSON(file=file.path(outputFolder, "input.json"))
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

## Execution
# Create PID file
pidFile <- file.path(outputFolder, ".pid")
writeLines(as.character(Sys.getpid()), pidFile)
on.exit(unlink(pidFile), add = TRUE)

# Execute the script
withCallingHandlers(source(scriptFile),
    error=function(e){
        if(grepl("ignoring SIGPIPE signal",e$message)) {
            cat("Suppressed: ignoring SIGPIPE signal\n");
        } else if (is.null(biab_output_list[["error"]])) {
            biab_output_list[["error"]] <<- conditionMessage(e)
            cat("Caught error, stack trace:\n")
            print(sys.calls()[-seq(1:5)])
        }
    }
)

if(length(biab_output_list) > 0) {
    cat("Writing outputs to BON in a Box...\n")
    jsonData <- toJSON(biab_output_list, indent=2)
    write(jsonData, file.path(outputFolder,"output.json"))
}

cat("Writing dependencies to file...\n")
capture.output(sessionInfo(), file = paste0(outputFolder, "/dependencies.txt"))
cat(" done.\n")

gc()