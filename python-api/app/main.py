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

ddb = duckdb.connect("/app/duckdb.db")

ddb.sql("""
INSTALL spatial;
INSTALL httpfs;
LOAD spatial;
LOAD httpfs;
""")

countries_parquet = "https://data.fieldmaps.io/adm0/osm/intl/adm0_polygons.parquet"
regions_parquet = "https://data.fieldmaps.io/edge-matched/humanitarian/intl/adm1_polygons.parquet"

ddb.sql("CREATE TABLE IF NOT EXISTS countries AS SELECT adm0_src, adm0_name, geometry_bbox FROM read_parquet('%s')" % countries_parquet)
ddb.sql("CREATE TABLE IF NOT EXISTS regions AS SELECT adm1_src, adm1_name, adm0_src, adm0_name, geometry_bbox FROM read_parquet('%s')" % regions_parquet)

@app.get("/")
def read_root():
    return {"Title": "BON in a Box Python API"}

@app.get("/countries_list")
def gadm_country_names():
    names=ddb.sql("SELECT * FROM countries")
    return names.to_dict(orient='records')

@app.get("/regions_list")
def region_names(country_iso:str):
    names=ddb.sql("SELECT * FROM regions WHERE adm0_src = '%s'" % country_iso)
    if names.empty:
        return {"error": "Country ISO not found"}
    return names.to_dict(orient='records')

@app.get("/geometry")
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

@app.get("/bbox")
def gadm_region_geometry(gid:str):
    adm = pg.Items(admin=gid).set_crs(epsg=4326)
    if adm.empty:
        return {"error": "Region not found"}
    return adm.total_bounds.tolist()
