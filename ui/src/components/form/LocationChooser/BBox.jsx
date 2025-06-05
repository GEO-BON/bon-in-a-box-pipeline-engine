/* eslint-disable prettier/prettier */
import { useEffect, useState, useRef, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import TextField from "@mui/material/TextField";
import { CustomButtonGreen } from "../../CustomMUI";
import { transformBboxAPI, validTerraPolygon } from "./api"
import * as turf from '@turf/turf';

export default function BBox({
  bbox,
  bboxGeoJSON,
  setBboxGeoJSON,
  CRS,
  setBbox,
  action,
  setAction
}) {
    const [MinX, setMinX] = useState("");
    const [MaxX, setMaxX] = useState("");
    const [MinY, setMinY] = useState("");
    const [MaxY, setMaxY] = useState("");

    const updateBbox = () =>{
        setAction('BboxButton')
        const b = [parseFloat(MinX).toFixed(6), parseFloat(MinY).toFixed(6), parseFloat(MaxX).toFixed(6), parseFloat(MaxY).toFixed(6)]
        setBbox(b);
        if(CRS === 4326){
            var feature = validTerraPolygon(turf.bboxPolygon(b));
            setBboxGeoJSON(feature)
        } else {
            transformBboxAPI(b, CRS, 4326).then((result)=>{
                if(result.data.results){
                    let r2 = result.data.results
                    r2 = r2.map((n)=>({ "x": parseFloat(n.x.toFixed(6)), "y": parseFloat(n.x.toFixed(6))}))
                    var geometry = {
                        type: "Polygon",
                        coordinates: [
                            [r2[0].x, r2[0].y],
                            [r2[1].x, r2[1].y],
                            [r2[2].x, r2[2].y],
                            [r2[3].x, r2[3].y],
                            [r2[0].x, r2[0].y]]
                        };
                    var feature = validTerraPolygon(turf.feature(geometry));
                    setBboxGeoJSON(feature)
                }else{
                    return
                }
            })
        }
    }

    useEffect(()=>{
        if(action !== ''){
            if(bboxGeoJSON){
                const b = turf.bbox(bboxGeoJSON)
                if(CRS === "4326"){
                    setBbox(b)
                } else {
                    transformBboxAPI(b, 4326, CRS).then((result) => {
                        if(result.data.results){
                            const r = result.data.results
                            const minx = Math.min(r[0].x,r[1].x,r[2].x,r[3].x)
                            const maxx = Math.max(r[0].x,r[1].x,r[2].x,r[3].x)
                            const miny = Math.min(r[0].y,r[1].y,r[2].y,r[3].y)
                            const maxy = Math.max(r[0].y,r[1].y,r[2].y,r[3].y)
                            const b2 = [parseFloat(minx).toFixed(6), parseFloat(miny).toFixed(6), parseFloat(maxx).toFixed(6), parseFloat(maxy).toFixed(6)]
                            setBbox(b2)
                            if(action == 'CRSButton'){
                                setAction("")
                                transformBboxAPI(b2, CRS, 4326).then((result)=>{
                                    if(result.data.results){
                                        let r2 = result.data.results
                                        r2 = r2 = r2.map((n)=>({ "x": parseFloat(n.x.toFixed(6)), "y": parseFloat(n.y.toFixed(6))}))
                                        var geometry = {
                                            type: "Polygon",
                                            coordinates: [[
                                                [r2[0].x, r2[0].y],
                                                [r2[1].x, r2[1].y],
                                                [r2[2].x, r2[2].y],
                                                [r2[3].x, r2[3].y],
                                                [r2[0].x, r2[0].y]
                                            ]]
                                            };
                                        var feature = validTerraPolygon(turf.feature(geometry));
                                        setBboxGeoJSON(feature)
                                    }else{
                                        return
                                    }
                                })
                            }
                        }
                    })
                }
            }
        }
        setAction("")
    }, [bboxGeoJSON, CRS, action])

    /*useEffect(()=>{
        if(action==='CRSButton'){
            if(update){
                setBboxGeoJSON(validTerraPolygon(turf.bboxPolygon(b)));
                setAction("")
            }
            update = false
        }
    })*/

    useEffect(()=>{
        if(bbox){
            setMinX(bbox[0]);
            setMinY(bbox[1]);
            setMaxX(bbox[2]);
            setMaxY(bbox[3]);
        }
    }, [bbox, CRS]);

  return (
    <>
    <TextField
        type="number"
        label="Minimum X"
        size="small"
        value={MinX}
        onChange={(e)=>setMinX(e.target.value)}
        sx={{ marginTop: "15px" , marginBottom: "10px" }}
    />
    <TextField
        type="number"
        size="small"
        label="Minimum Y"
        value={MinY}
        onChange={(e)=>setMinY(e.target.value)}
        sx={{ marginBottom: "10px" }}
    />
    <TextField
        type="number"
        label="Maximum X"
        size="small"
        value={MaxX}
        onChange={(e)=>setMaxX(e.target.value)}
        sx={{ marginBottom: "10px" }}
    />
    <TextField
        type="number"
        label="Maximum Y"
        size="small"
        value={MaxY}
        onChange={(e)=>setMaxY(e.target.value)}
        sx={{ marginBottom: "10px" }}
    />
    <CustomButtonGreen variant="contained" onClick={(e)=>updateBbox(e)}>
        Update coordinates
    </CustomButtonGreen>
    </>
  )
}


