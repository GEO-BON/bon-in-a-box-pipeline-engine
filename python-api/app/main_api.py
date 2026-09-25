from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import duckdb
import os
import json
import geopandas as gpd
import pandas as pd
from dotenv import load_dotenv

from file_manager import fm_router


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ddb = duckdb.connect()
ddb.execute("SET home_directory='/app/ddb_home'")
ddb.install_extension("spatial")
ddb.load_extension("spatial")
ddb.install_extension("httpfs")
ddb.load_extension("httpfs")


countries_parquet = "https://data.fieldmaps.io/adm0/osm/intl/adm0_polygons.parquet"
regions_parquet = "https://data.fieldmaps.io/edge-matched/humanitarian/intl/adm1_polygons.parquet"

if not os.path.exists("/app/countries.json"):
    print("Generating countries.json...", flush=True)
    countries=ddb.sql("SELECT adm0_src, adm0_name, geometry_bbox FROM read_parquet('%s')" % countries_parquet).df()
    with open('/app/countries.json', 'w') as f:
        json.dump(countries.to_dict(orient='records'), f, indent=4)
    print("done", flush=True)

if not os.path.exists("/app/regions.json"):
    print("Generating regions.json...", flush=True)
    regions=ddb.sql("SELECT adm1_src, adm1_name, adm0_src, adm0_name, geometry_bbox FROM read_parquet('%s')" % regions_parquet).df()
    with open('/app/regions.json', 'w') as f:
        json.dump(regions.to_dict(orient='records'), f)
    print("done", flush=True)

@app.get("/region")
def read_root():
    return {"Title": "BON in a Box Python API", "Version": "1.0.0", "Description": "API for countries and subnational region names and geometries. Based on fieldmaps.io UN parquet files."}

@app.get("/region/countries_list")
def countries_list():
    df = pd.read_json('/app/countries.json', orient='records')
    df = df.dropna()
    return df.to_dict(orient='records')

@app.get("/region/regions_list")
def regions_list(country_iso:str):
    df = pd.read_json('/app/regions.json', orient='records')
    names = df[(df['adm0_src'] == country_iso) | (df['adm0_src'] == country_iso+'_1')]
    if names.empty:
        raise HTTPException(status_code=404, detail="Country ISO code not valid")

    print("Returning %d regions for country %s" % (len(names), country_iso))

    json_str = names.to_json(orient='records')
    return Response(content=json_str, media_type='application/json')

@app.get("/region/country_region_bbox")
def country_region_bbox(type: str = 'country', id: str = "", crs: str = 'EPSG:4326', output_format: str = 'bbox'):
    if type == 'country':
        reg = ddb.sql("SELECT *, ST_AsText(geometry) AS geom FROM read_parquet(?) WHERE adm0_src=?", params=[countries_parquet, id]).df()
        if( reg.empty ):
            raise HTTPException(status_code=404, detail="Country ID not found")
    elif type == 'region':
        reg = ddb.sql("SELECT *, ST_AsText(geometry) AS geom FROM read_parquet(?) WHERE adm1_src=?", params=[regions_parquet, id]).df()
        if( reg.empty ):
            raise HTTPException(status_code=404, detail="Region ID not found")
        country = ddb.sql("SELECT adm0_src, geometry_bbox FROM read_parquet(?) WHERE adm0_src=?", params=[countries_parquet, reg["adm0_src"].iloc[0]]).df()
    else:
        raise HTTPException(status_code=400, detail="Invalid type parameter. Must be 'country' or 'region'.")

    gs = gpd.GeoSeries.from_wkt(reg["geom"], crs="EPSG:4326")
    del reg["geom"]
    gdf = gpd.GeoDataFrame(reg, geometry=gs, crs="EPSG:4326")
    gdf = gdf.to_crs(crs)
    bbox = gdf.total_bounds
    if output_format == 'bbox':
        return {"bbox": bbox.tolist(), "crs": crs}
    elif output_format == 'chooser_input':
        if(type=='country'):
            country_bb4326 = reg["geometry_bbox"].iloc[0]
        elif(type=='region'):
            region_bb4326 = reg["geometry_bbox"].iloc[0]
            country_bb4326 = country["geometry_bbox"].iloc[0]
        return {"CRS": 
                {"CRSBboxWGS84": "", 
                 "authority": crs.split(':')[0], 
                 "code": crs.split(':')[1], 
                 "proj4Def": gdf.crs.to_proj4(), 
                 "unit": gdf.crs.axis_info[0].unit_name, 
                 "wktDef": gdf.crs.to_wkt()},
                 "bbox": bbox.tolist(),
                 "country": {
                     "ISO3": reg["adm0_src"].iloc[0], 
                     "englishName": reg["adm0_name"].iloc[0], 
                     "bboxWGS84": [country_bb4326["xmin"], country_bb4326["ymin"], country_bb4326["xmax"], country_bb4326["ymax"]]},
                 "region": type=='region' and {
                     "ISO3": reg["adm1_src"].iloc[0],
                     "englishName": reg["adm1_name"].iloc[0],
                     "bboxWGS84": [region_bb4326["xmin"], region_bb4326["ymin"], region_bb4326["xmax"], region_bb4326["ymax"]]
                 } or {}
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid output_format parameter. Must be 'bbox' or 'chooser_input'.")


@app.get("/region/geometry")
def region_geometry(type: str = 'country', id: str = ""):
    if type == 'country':
        reg = ddb.sql("SELECT *, ST_AsText(geometry) AS geom FROM read_parquet(?) WHERE adm0_src=?", params=[countries_parquet, id]).df()
        if( reg.empty ):
            raise HTTPException(status_code=404, detail="Country ID not found")
        fname = reg['adm0_name'].iloc[0].replace(' ','_')

    elif type == 'region':
        reg = ddb.sql("SELECT *, ST_AsText(geometry) AS geom FROM read_parquet(?) WHERE adm1_src=?", params=[regions_parquet, id]).df()
        if( reg.empty ):
            raise HTTPException(status_code=404, detail="Region ID not found")
        fname = reg['adm1_name'].iloc[0].replace(' ','_')

    gs = gpd.GeoSeries.from_wkt(reg["geom"], crs="EPSG:4326")
    del reg["geom"]
    gdf = gpd.GeoDataFrame(reg, geometry=gs, crs="EPSG:4326")
    file_path = "/tmp/%s_%s.gpkg" % (type,fname)
    gdf.to_file(file_path, driver='GPKG', layer='country_region', overwrite=True)
    return FileResponse(file_path, media_type="application/geopackage+sqlite3", filename="%s.gpkg" % fname)

app.include_router(fm_router)


# --- Assistant -------------------------------------------------------------
# The chat assistant's system prompt.
#
# This exists because ollama-mcp-bridge has no notion of a system prompt of its
# own: it forwards whatever `messages` the client sends. So the guidance has to
# ride in as messages[0] from the UI, and the UI has to get it from somewhere.
#
# Serving it here keeps it single-sourced with the MCP server's own copy of the
# file (mcp-server/assistant-role.md) rather than duplicating the text into the
# React bundle, where it would drift the first time anyone edited it.
#
# It used to be three files concatenated -- the role, a full API guide and a
# documentation guide, about 5.7 KB in every request. That is now one routing
# table of a dozen lines: the procedure for each kind of question lives in
# mcp-server/modes/ and reaches the model as the result of its `start_task` call,
# so a conversation carries the one procedure it needs instead of all five.
ASSISTANT_PROMPT_DIR = Path(__file__).parent / "mcp-server"

# The guides address services by the names they answer to INSIDE the compose network.
# A browser cannot resolve any of them, so every viewer and form link the model is
# told to hand the user would be dead on arrival -- and in the per-session deployment
# there is no single right host to hardcode instead, since each user is on their own
# subdomain. Rewriting them to whichever origin served the request is what makes the
# links work in dev, on the shared instance, and in a session alike.
_INTERNAL_ORIGINS = (
    "http://biab-script-server:8080",
    "http://biab-python-api:8001",
    "http://biab-python-api:8000",
    "http://swagger_ui:8080",
    "http://localhost",
)


def _read_prompt_part(name: str) -> str:
    path = ASSISTANT_PROMPT_DIR / name
    try:
        return path.read_text().strip()
    except OSError as exc:
        print(f"WARNING: assistant prompt part {path} unreadable: {exc}", flush=True)
        return ""


@app.get("/assistant/prompt")
def assistant_prompt(request: Request):
    """System prompt for the chat assistant, assembled from the MCP server's guides.

    The origin is taken from the request rather than configured, because in the
    per-session deployment every user reaches their own engine on their own
    subdomain -- a hardcoded host would hand every user someone else's links.
    """
    origin = str(request.base_url).rstrip("/")
    forwarded_host = request.headers.get("x-forwarded-host")
    if forwarded_host:
        proto = request.headers.get("x-forwarded-proto", "https")
        origin = f"{proto}://{forwarded_host}"

    prompt = _read_prompt_part("assistant-role.md")
    for internal in _INTERNAL_ORIGINS:
        prompt = prompt.replace(internal, origin)
    return {"prompt": prompt}
