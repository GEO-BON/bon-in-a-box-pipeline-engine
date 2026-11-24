#!/bin/sh
set -eu

case "$QUARTO_PROJECT_OUTPUT_DIR" in
  /*) output_dir="$QUARTO_PROJECT_OUTPUT_DIR" ;;
  *) output_dir="$PWD/$QUARTO_PROJECT_OUTPUT_DIR" ;;
esac

for project in lang/*; do
  [ -f "$project/_quarto.yml" ] || continue
  language=${project##*/}
  quarto render "$project" --output-dir "$output_dir/$language"
done
