options(error=traceback, keep.source=TRUE, show.error.locations=TRUE)

# Define repo for install.packages
repositories = getOption("repos")
repositories["CRAN"] = "https://cloud.r-project.org/"
options(repos = repositories)

library(rjson)

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