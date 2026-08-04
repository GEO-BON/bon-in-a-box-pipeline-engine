from fastapi import FastAPI, APIRouter, HTTPException, Response, File, Form, UploadFile, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import duckdb
import os
import json
import geopandas as gpd
import pandas as pd
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
fm_router = APIRouter(prefix="/fm-api")

BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_ROOT = BASE_DIR / "pipeline-repo" / "userdata" / "files"
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

def resolve(id: str) -> Path:
    # id comes in like "/New folder" (striping leading slash), keep inside STORAGE_ROOT
    return STORAGE_ROOT / id.lstrip("/")

def to_id(path: Path) -> str:
    return "/" + str(path.relative_to(STORAGE_ROOT)).replace("\\", "/")

def list_dir(target: Path):
    items = []
    for path in target.glob("*"):
        items.append({
            "id": to_id(path),
            "value": path.name,
            "type": "folder" if path.is_dir() else "file",
            "size": path.stat().st_size if path.is_file() else 0,
        })
    return items

@fm_router.get("/files")
def get_root_files():
    return list_dir(STORAGE_ROOT)

@fm_router.get("/files/{id:path}")
def get_subfolder_files(id: str):
    target = resolve(id)
    if not target.exists() or not target.is_dir():
        return []
    return list_dir(target)

@fm_router.post("/files/{id:path}")
def create_item(id: str, body: dict = Body(...)):
    name = body.get("name")
    item_type = body.get("type")
    if not name or not item_type:
        raise HTTPException(400, "'type' and 'name' parameters must be provided")
    dest = resolve(id) / name
    if item_type == "folder":
        dest.mkdir(parents=True, exist_ok=True)
    else:
        dest.touch(exist_ok=True)
    return {"id": to_id(dest)}

@fm_router.put("/files/{id:path}")
def rename_item(id: str, body: dict = Body(...)):
    if body.get("operation") != "rename":
        raise HTTPException(400, "Unsupported operation")
    source = resolve(id)
    if not source.exists():
        raise HTTPException(404, "Not found")
    new_path = source.parent / body["name"]
    source.rename(new_path)
    return {"id": to_id(new_path)}

@fm_router.put("/files")
def move_or_copy(body: dict = Body(...)):
    operation = body.get("operation")  # "move" or "copy"
    target_dir = resolve(body["target"])
    target_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for item_id in body.get("ids", []):
        src = resolve(item_id)
        dest = target_dir / src.name
        if operation == "move":
            src.rename(dest)
        else:
            (shutil.copytree if src.is_dir() else shutil.copy2)(src, dest)
        results.append({"id": to_id(dest), "name": dest.name})
    return {"result": results}

@fm_router.delete("/files")
def delete_items(body: dict = Body(...)):
    for item_id in body.get("ids", []):
        target = resolve(item_id)
        if target.is_dir():
            shutil.rmtree(target, ignore_errors=True)
        elif target.exists():
            target.unlink()
    return {"status": "success"}

@fm_router.post("/upload")
async def upload_file(file: UploadFile = File(...), id: str = Form("/")):
    dest_folder = resolve(id)
    dest_folder.mkdir(parents=True, exist_ok=True)
    dest_file = dest_folder / file.filename
    with dest_file.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"id": to_id(dest_file), "value": file.filename}

@fm_router.get("/info")
def get_info():
    total, used, free = shutil.disk_usage(STORAGE_ROOT)
    return {"stats": {"total": total, "used": used, "free": free}}

app.include_router(fm_router)