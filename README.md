# BON in a Box 2.0

Mapping Post-2020 Global Biodiversity Framework indicators and their uncertainty.

A Geo BON project, born from a collaboration between Microsoft, McGill, Humbolt institue, Université de Sherbrooke, Université Concordia and Université de Montréal.

## Running the servers locally
Prerequisites : 
 - Git
 - Linux: Docker with Docker Compose installed
 - Windows/Mac: Docker Desktop
 - At least 6 GB of free space (this includes the installation of Docker Desktop)

To run:
1. Clone repository (Windows users: do not clone this in a folder under OneDrive.)
2. Using a terminal, navigate to top-level folder.
3. `docker compose build` (this needs to be re-run everytime the server code changes, or when using git pull if you are not certain.)
4. `docker compose up -d`
5. In browser:
    - http://localhost/ shows a basic UI
6. `docker compose down` (to stop the server when done)

## Scripts
The scripts perform the actual work behind the scenes.
Currently supported : 
 - R version 4.1.2

Script lifecycle:
1. Script launched with output folder as a parameter.
2. Script reads input.json to get execution parameters (ex. species, area, data source, etc.)
3. Script performs its task
4. Script generates output.json, containing links to result files, or native values (int, string, etc.)

### Describing a script
The script description is in a .yml file next to the script. It describes
- The script to run
- Inputs
- Outputs
- Description
- External link (optional)
- References
See [example](/scripts/HelloWorld.yml)

Each input and output must declare a type, *in lowercase.* The following are accepted:
- int
- float
- MIME types
  - image/tiff;application=geotiff
  - image/jpg
  - text/plain
  - etc.

## Pipelines
Each script becomes a pipeline step.
