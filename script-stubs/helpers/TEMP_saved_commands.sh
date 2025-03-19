#!/bin/bash
docker image inspect --format '{{.RepoDigests}}' geobon/bon-in-a-box:runner-conda
module load apptainer
apptainer build biab-conda.sif docker://...monimageici...
