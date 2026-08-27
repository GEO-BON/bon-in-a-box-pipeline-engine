from fastapi import FastAPI, APIRouter, HTTPException, Response, File, UploadFile, Query, Request, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import duckdb
import os
import json
import json
import geopandas as gpd
import pandas as pd
import shutil
from dotenv import load_dotenv

# for file scanning
import io
# import clamd
from clamav_client.clamd import ClamdNetworkSocket
from fastapi.concurrency import run_in_threadpool



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

# backend for file scanning 
# configure connection clamAV daemon instance
CLAMAV_HOST = os.environ.get("CLAMAV_HOST", "clamav")
CLAMAV_PORT = 3310

def _sync_scan(file_bytes: bytes) -> dict:
    """
    Synchronous socket scanning executed inside a threadpool worker
    """    
    cd = ClamdNetworkSocket(host=CLAMAV_HOST, port=CLAMAV_PORT)
    scan_result = cd.instream(io.BytesIO(file_bytes))
    # debugging
    print(f"[ClamAV Scanner] Result for upload: {scan_result}", flush=True)
    return scan_result

async def scan_file_buffer(file: UploadFile = File(...)) -> UploadFile:
    """
    FastAPI validation dependency. Automatically catches incoming multi-part files,
    scans them over the docker socket, and rejects threats before saving them.
    """
    try:
        file_bytes = await file.read()
        scan_result = await run_in_threadpool(_sync_scan, file_bytes)
        await file.seek(0)
        if scan_result and "stream" in scan_result:
            status_type, threat_name = scan_result["stream"]
            if status_type == "FOUND":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Malware detected! File blocked by antivirus: {threat_name}"
                )
    except HTTPException:
        raise
    except Exception as e:
        # log network connection issues
        print(f"Antivirus service connectivity down: {str(e)}")
        await file.seek(0)
    return file

#################################################
####    BACKEND FOR FILE MANAGEMENT SYSTEM    ###
#################################################

fm_router = APIRouter(prefix="/fm-api")

BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_ROOT = Path(os.environ.get("USERDATA_ROOT", "./storage"))
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
# disables everything if set to true
DISABLE_MY_FILES = os.environ.get("DISABLE_MY_FILES", "false").lower() == "true"

def check_if_disabled():
    if DISABLE_MY_FILES:
        raise HTTPException(status_code=403, detail="Cannot load files. This instance is read-only")

def resolve(id: str) -> Path:
    return STORAGE_ROOT / id.lstrip("/")

def to_id(path: Path) -> str:
    return "/" + str(path.relative_to(STORAGE_ROOT)).replace("\\", "/")

def list_dir(target: Path):
    items = []
    for path in target.glob("*"):
        is_dir = path.is_dir()
        item = {
            "id": to_id(path),
            "value": path.name,
            "type": "folder" if is_dir else "file",
            "size": path.stat().st_size if path.is_file() else 0,
        }
        # treat folders as lazy-loaded assets
        if is_dir:
            item["lazy"] = True
            
        items.append(item)
    return items

# loading root files
@fm_router.get("/is_disabled")
def get_root_files():
    return {"disabled": DISABLE_MY_FILES}

# loading root files
@fm_router.get("/files")
def get_root_files():
    check_if_disabled()
    return list_dir(STORAGE_ROOT)

# endpoint to fetch ALL files + folders (not just root ones)
def get_file_info(path: Path) -> dict:
    is_dir = path.is_dir()
    item = {
        "id": to_id(path),
        "value": path.name,
        "type": "folder" if is_dir else "file",
        "size": path.stat().st_size if path.is_file() else 0,
    }
    if is_dir:
        item["lazy"] = True
    return item

@fm_router.get("/files/all")
def get_all_files():
    check_if_disabled()
    items = []
    for path in STORAGE_ROOT.rglob("*"):
        items.append(get_file_info(path))
    return items

# method for lazy-loaded folders
@fm_router.get("/files/{id:path}")
def get_subfolder_files(id: str):
    check_if_disabled()
    clean_id = id.lstrip("/")   # stripping double slashes
    target = resolve(clean_id)
    if not target.exists() or not target.is_dir():
        return []
    return list_dir(target)

# creating a file/folder
@fm_router.post("/files/{id:path}")
async def create_item(id: str, request: Request):
    check_if_disabled()
    raw = await request.body()
    body = json.loads(raw)
    name = body.get("name")
    item_type = body.get("type")
    if not name or not item_type:
        raise HTTPException(400, "'type' and 'name' parameters must be provided.")
    dest = resolve(id) / name
    if item_type == "folder":
        dest.mkdir(parents=True, exist_ok=True)
    else:
        dest.touch(exist_ok=True)
    return {"result": {"id": to_id(dest), "name": dest.name, "type": item_type}}

# renaming a folder
@fm_router.put("/files/{id:path}")
async def rename_item(id: str, request: Request):
    check_if_disabled()
    raw = await request.body()
    body = json.loads(raw)
    if body.get("operation") != "rename":
        raise HTTPException(400, "Unsupported operation")
    source = resolve(id)
    if not source.exists():
        raise HTTPException(404, "Not found")
    new_path = source.parent / body["name"]
    source.rename(new_path)
    return {"result": {"id": to_id(new_path), "name": new_path.name}}

# moving or copying a file
@fm_router.put("/files")
async def move_or_copy(request: Request):
    check_if_disabled()
    raw = await request.body()
    body = json.loads(raw)
    operation = body.get("operation")  # "move" or "copy"
    target_dir = resolve(body["target"])
    target_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for item_id in body.get("ids", []):
        src = resolve(item_id)
        dest = target_dir / src.name
        if operation == "move":
            src.rename(dest)
        else:   # operation == "copy"
            (shutil.copytree if src.is_dir() else shutil.copy2)(src, dest)
        results.append({"id": to_id(dest), "name": dest.name})
    return {"result": results}

# deleting a file
@fm_router.delete("/files")
async def delete_items(request: Request):
    check_if_disabled()
    raw = await request.body()
    body = json.loads(raw)
    for item_id in body.get("ids", []):
        target = resolve(item_id)
        if target.is_dir():
            shutil.rmtree(target, ignore_errors=True)
        elif target.exists():
            target.unlink()
    return {"status": "success"}

# uploading a file 
@fm_router.post("/upload")
# modified the signature, before it was : `file: UploadFile = File(...)`
async def upload_file(id: str = Query("/"), file: UploadFile = Depends(scan_file_buffer)):
    check_if_disabled()
    dest_folder = resolve(id)
    dest_folder.mkdir(parents=True, exist_ok=True)
    dest_file = dest_folder / file.filename
    with dest_file.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"id": to_id(dest_file), "value": file.filename}

# get total storage used
@fm_router.get("/info")
def get_info():
    check_if_disabled()
    total, used, free = shutil.disk_usage(STORAGE_ROOT)
    return {"stats": {"total": total, "used": used, "free": free}}

app.include_router(fm_router)


# --- Assistant -------------------------------------------------------------
# The chat assistant's system prompt.
#
# This exists because ollama-mcp-bridge has no notion of a system prompt of its
# own: it forwards whatever `messages` the client sends. So the guidance has to
# ride in as messages[0] from the UI, and the UI has to get it from somewhere.
#
# Serving it here keeps it single-sourced with the MCP server's own copies of
# these files (mcp-server/*.md) rather than duplicating the text into the React
# bundle, where it would drift the first time anyone edited the guide.
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

    parts = [
        _read_prompt_part("assistant-role.md"),
        "## API GUIDE\n" + _read_prompt_part("api-guide.md"),
        "## PLATFORM DOCUMENTATION\n" + _read_prompt_part("documentation.md"),
    ]
    prompt = "\n\n".join(p for p in parts if p.strip())
    for internal in _INTERNAL_ORIGINS:
        prompt = prompt.replace(internal, origin)
    return {"prompt": prompt}
