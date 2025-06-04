import axios from "axios";
import { v4 as uuidv4 } from 'uuid';

export const getStateAPI = async (geonameId) => {
    let result;
    const base_url = "http://api.geonames.org/childrenJSON";
    try {
        result = await axios({
        method: "get",
        baseURL: `${base_url}`,
        params: { geonameId: geonameId, inclBbox: true, username: "geobon" },
        });
    } catch (error) {
        result = { data: null };
    }
    return result;
};

export const getProjestAPI = async (geojson) => {
    let result;
    const base_url = "https://projest.io/ns/api/";
    let allData = [];
    let start = 1;

    while (start) {
        try {
            result = await axios({
                method: "post",
                url: `${base_url}`,
                params: { geojson: true, sort: "areadiff", max: 20, offset: start},
                data : new URLSearchParams({ geom: JSON.stringify(geojson) }),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                }
            });
            if(result.data.features.length > 0) {
                allData = allData.concat(result.data.features);
                start=start+20;
            }else{
                start=false
            }
        } catch (error) {
            console.error('Error fetching page:', start, error);
            start = false;
        }
    }
    return allData;
};


export const transformBboxAPI = async (bbox, source_crs, dest_crs) => {
    let result;
    const base_url = `https://api.maptiler.com/coordinates/transform/${bbox[0]},${bbox[1]};${bbox[0]},${bbox[3]};${bbox[2]},${bbox[1]};${bbox[2]},${bbox[3]}.json`;
    try {
        result = await axios({
        method: "get",
        baseURL: `${base_url}`,
        params: { s_srs: source_crs, t_srs: dest_crs, key:"U4hNLWRENxTa7CfHUUnN" },
        });
    } catch (error) {
        result = { results: null };
    }
    return result;
};

export const validTerraPolygon = (feature) =>{
    feature.properties.mode = "rectangle";
    feature.id=uuidv4();
    delete feature.bbox;
    return feature
}