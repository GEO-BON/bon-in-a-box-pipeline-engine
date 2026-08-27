import openeo
import os
import yaml
from pathlib import Path
from system.scriptWrapper import signal_handler

log_level = "warning"

# Accessing yaml file to extract input types
script_name = Path(output_folder).parent.name
yaml_path = Path("/script-stubs/openEO")/f"{script_name}.yml"

with open(yaml_path) as f:
    yaml_file = yaml.safe_load(f)

input_info = {
    input_id: input_def["type"]
    for input_id, input_def in yaml_file["inputs"].items()
}

print("Input types:", input_info)

# Credentials
id = os.getenv("CDSE_CLIENT_ID")
secret = os.getenv("CDSE_CLIENT_SECRET")
if not id or not secret:
    biab_error_stop("Please specify CDSE credentials in runner.env")

# Reading inputs
data = biab_inputs()

# Extract process id
if (data['url'] is not None):
    process_id = data['url'].split('/')[-1].removesuffix(".json")
    process_graph = data['url']
else:
    biab_error_stop("Missing the process url.")

# Set up inputs for process call
inputs = dict(data)
inputs.pop('url', None)

# Check input types for special cases
for key in input_info.keys():
    # bboxCRS
    if input_info[key] == "bboxCRS":
        spatial_extent = data.get(key) if data.get(key) else biab_error_stop("Something went wrong. Yaml does not match input.json. Please contact the BON in a Box team.")
        bbox = spatial_extent['bbox']
        crs_info = spatial_extent['CRS']
        crs = f"{crs_info['authority']}:{crs_info['code']}"
        epsg = int(crs.split(':')[1])
        aoi = {"west": bbox[0], "south": bbox[1], "east": bbox[2], "north": bbox[3], "crs": epsg}
        inputs[key] = aoi

    # datacube or geoTIFF
    if input_info[key] == "image/tiff;application=geotiff":
        biab_error_stop("GeoTIFF inputs files not yet supported with openEO scripts.")

# Pass inputs to openEO process
connection = openeo.connect("https://openeo.dataspace.copernicus.eu/")

# authentication
connection.authenticate_oidc_client_credentials(
    client_id = id,
    client_secret = secret,
)
print("***********************************************")
print("Running openEO with the following parameters:")
print(f"Process id: {process_id}")
print(f"Namespace: {process_graph}")
print(f"Inputs: {inputs}")
print("***********************************************")

# Get cube from UDP
cube = connection.datacube_from_process(
    process_id = process_id,
    namespace = process_graph,
    **inputs
)

# Run UDP then reload output as a cube
print("Starting UDP job to retrieve data cube...", flush=True)
udp_job = cube.save_result(format="GTiff").create_job(
    title="UDP"
)

# Signal handler will allow to write whatever outputs we have (in the finally clause below)
def openEO_signal_handler(sig, frame):
    print('Termination signal received. Stopping opeEO process.', flush=True)
    biab_output_list[ "error" ] = "Script run has received a stop signal before completion.\nCancelling openEO process..."
    udp_job.stop()
    sys.exit(0)

current_signal_SIGTERM = signal.getsignal(signal.SIGTERM)
current_signal_SIGINT = signal.getsignal(signal.SIGINT)
signal.signal(signal.SIGTERM, openEO_signal_handler)
signal.signal(signal.SIGINT, openEO_signal_handler)

try:
    udp_job.start_and_wait()
except Exception as e:
    biab_error_stop(f"UDP job failed: {e}")
finally:
    signal.signal(signal.SIGTERM, current_signal_SIGTERM)
    signal.signal(signal.SIGINT, current_signal_SIGINT)

for entry in udp_job.logs(level = log_level):
    print(f"[{entry.get('level')}]: {entry.get('message')}", flush=True)

print(f"UDP job finished: {udp_job.job_id}", flush=True)

job_results = udp_job.get_results()
rasters = job_results.download_files(output_folder)

raster_outs = [str(r) for r in rasters if not str(r).endswith(".json")]
biab_output("output_rasters", raster_outs)


