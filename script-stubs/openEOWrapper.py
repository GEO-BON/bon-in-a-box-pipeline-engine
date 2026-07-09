import openeo
import os

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

# Special cases
# bboxCRS
spatial_extent = data.get('spatial_extent')
if spatial_extent and spatial_extent.get('bbox') is not None:
    bbox = spatial_extent['bbox']
    crs_info = spatial_extent['CRS']
    crs = f"{crs_info['authority']}:{crs_info['code']}"
    epsg = int(crs.split(':')[1])
    aoi = {"west": bbox[0], "south": bbox[1], "east": bbox[2], "north": bbox[3], "crs": epsg}
    inputs['spatial_extent'] = aoi

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

try:
    udp_job.start_and_wait()
except Exception as e:
    biab_error_stop(f"UDP job failed: {e}")

print(f"UDP job finished: {udp_job.job_id}", flush=True)

job_results = udp_job.get_results()
rasters = job_results.download_files(output_folder)

raster_outs = [str(r) for r in rasters if not str(r).endswith(".json")]
biab_output("output_rasters", raster_outs)


