from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
import time
from pydantic import BaseModel
import duckdb
import os
from shapely.geometry import shape
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
def gadm_region_names(country_code:str, level:int=1):
    names = pg.AdmNames(complete=True, admin=country_code, content_level=level)
    return names.to_dict(orient='records')