from fastapi import FastAPI, HTTPException, Response, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import duckdb
import os
import json
import geopandas as gpd
import pandas as pd
from pathlib import Path
import shutil

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


# backend for file uploads
# Resolve workspace structure correctly relative to main_api.py
# BASE_DIR = Path(__file__).resolve().parent.parent.parent
# STORAGE_ROOT = BASE_DIR / "pipeline-repo" / "userdata" / "files"
# STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

# @app.get("/")
# def get_files(id: str = Query(None)):
#     """
#     SVAR RestDataProvider queries the root path directly.
#     When expanding deep nested files, it sends a target directory query string (?id=/subfolder).
#     """
#     items = []
    
#     # Check if we are checking the root directory or a specific subdirectory extension
#     target_dir = STORAGE_ROOT / id.lstrip("/") if id else STORAGE_ROOT
    
#     if not target_dir.exists() or not target_dir.is_dir():
#         return items

#     # RestDataProvider prefers single-level shallow listing when an ID is targeted
#     search_pattern = "*" if id else "**/*"
#     iterator = target_dir.glob("*") if id else STORAGE_ROOT.rglob("*")

#     for path in iterator:
#         try:
#             rel_path = "/" + str(path.relative_to(STORAGE_ROOT)).replace("\\", "/")
            
#             # Map standard top-level structural identifiers
#             if path.parent == STORAGE_ROOT:
#                 parent_id = "/"
#             else:
#                 parent_id = "/" + str(path.parent.relative_to(STORAGE_ROOT)).replace("\\", "/")

#             items.append({
#                 "id": rel_path,
#                 "value": path.name,
#                 "type": "folder" if path.is_dir() else "file",
#                 "size": path.stat().st_size if path.is_file() else 0,
#                 "parent": parent_id
#             })
#         except Exception:
#             continue
            
#     return items

# @app.get("/info")
# def get_info():
#     """
#     Maps your operating system drive context directly into your component layout.
#     Matches your React file's expectation: info.stats
#     """
#     total, used, free = shutil.disk_usage(STORAGE_ROOT)
#     return {
#         "stats": {
#             "total": total,
#             "used": used,
#             "free": free
#         }
#     }

# @app.post("/")
# async def handle_action(
#     action: str = Form(...), 
#     source: str = Form(None), 
#     target: str = Form(None), 
#     name: str = Form(None)
# ):
#     """Handles directory actions natively sent via the RestDataProvider execution pipeline."""
#     if action == "create-folder":
#         clean_target = target.lstrip("/") if target else ""
#         dest = STORAGE_ROOT / clean_target / name if clean_target else STORAGE_ROOT / name
#         dest.mkdir(parents=True, exist_ok=True)
#         return {"status": "success", "id": "/" + str(dest.relative_to(STORAGE_ROOT)).replace("\\", "/")}
        
#     elif action == "delete":
#         target_path = STORAGE_ROOT / source.lstrip("/")
#         if target_path.exists():
#             if target_path.is_dir():
#                 shutil.rmtree(target_path)
#             else:
#                 target_path.unlink()
#         return {"status": "success"}

#     elif action == "rename":
#         source_path = STORAGE_ROOT / source.lstrip("/")
#         if source_path.exists():
#             new_path = source_path.parent / name
#             source_path.rename(new_path)
#             return {"status": "success", "id": "/" + str(new_path.relative_to(STORAGE_ROOT)).replace("\\", "/")}

#     raise HTTPException(status_code=400, detail=f"Action '{action}' is unhandled")

# @app.post("/upload")
# async def upload_file(file: UploadFile = File(...), id: str = Form("/")):
#     """Catches multipart stream packages safely inside the requested user scope folder."""
#     clean_target = id.lstrip("/")
#     dest_folder = STORAGE_ROOT / clean_target if clean_target else STORAGE_ROOT
#     dest_folder.mkdir(parents=True, exist_ok=True)
    
#     dest_file = dest_folder / file.filename
#     with dest_file.open("wb") as buffer:
#         shutil.copyfileobj(file.file, buffer)
        
#     return {
#         "status": "success", 
#         "value": file.filename, 
#         "id": "/" + str(dest_file.relative_to(STORAGE_ROOT)).replace("\\", "/")
#     }