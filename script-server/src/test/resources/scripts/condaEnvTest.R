## Using example from https://r-graph-gallery.com/21-distribution-plot-using-ggplot2.html
# Libraries
library(ggplot2)
library(dplyr)
library(rjson)

# Load dataset from github
data <- read.table("/scripts/condaEnvTest.csv", header=TRUE)

# JPEG device
plot_file = file.path(outputFolder, "condaEnvTest.jpg")


# Make the histogram
data |>
  filter( price<300 ) |>
  ggplot(aes(x=price)) +
    geom_density(fill="#69b3a2", color="#e9ecef", alpha=0.8)

ggsave(plot_file)

## Outputting result to JSON
output <- list("plot" = plot_file)
jsonData <- toJSON(output, indent=2)
write(jsonData, file.path(outputFolder,"output.json"))
