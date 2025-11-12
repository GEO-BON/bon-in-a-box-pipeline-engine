from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import List, Dict
import time
from pydantic import BaseModel
import duckdb
import os
from shapely.geometry import shape
import geopandas as gpd
import pygadm as pg

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ddb = duckdb.connect()
ddb.sql("""
INSTALL spatial;
INSTALL httpfs;
LOAD spatial;
LOAD httpfs;
""")

@app.get("/")
def read_root():
    return {"Title": "BON in a Box Python API"}


@app.get("/country_list",response_model=List[Dict[str, str]])
def gadm_country_names():
    names = pg.AdmNames(complete=False, content_level=-1)
    return names.to_dict(orient='records')

@app.get("/regions_list/")
def gadm_region_names(country_gid:str, level:int=1):
    names = pg.AdmNames(complete=True, admin=country_gid, content_level=level)
    return names.to_dict(orient='records')

@app.get("/region_geometry/")
def gadm_region_geometry(gid:str):
    adm = pg.Items(admin=gid).set_crs(epsg=4326)
    if adm.empty:
        return {"error": "Region not found"}
    if(hasattr(adm, 'NAME_2') and adm.NAME_2.iloc[0] != ''):
        reg = adm.NAME_2.iloc[0]+'_'+adm.NAME_1.iloc[0]+'_'+adm.NAME_0.iloc[0]
    elif(hasattr(adm, 'NAME_1') and adm.NAME_1.iloc[0] != ''):
        reg = adm.NAME_1.iloc[0]+'_'+adm.NAME_0.iloc[0]
    else:
        reg = adm.NAME_0.iloc[0]
    fname = reg.replace(' ','_')+".gpkg"
    file_path = "/tmp/"+fname
    adm.to_file(file_path, driver='GPKG', layer='country_region', overwrite=True)
    return FileResponse(file_path, media_type="application/geopackage+sqlite3", filename=fname)

@app.get("/region_bbox/")
def gadm_region_geometry(gid:str):
    adm = pg.Items(admin=gid).set_crs(epsg=4326)
    if adm.empty:
        return {"error": "Region not found"}
    return adm.total_bounds.tolist()
