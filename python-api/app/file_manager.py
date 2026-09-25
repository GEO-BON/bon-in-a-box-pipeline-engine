from fastapi import APIRouter, HTTPException, UploadFile, Query, Request, Depends
from pathlib import Path
import os
import json
import shutil

from antivirus import scan_file_buffer

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
