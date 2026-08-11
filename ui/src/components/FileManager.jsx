import { useState, useEffect } from 'react';
import { RestDataProvider } from "@svar-ui/filemanager-data-provider";
import { Filemanager, WillowDark } from "@svar-ui/react-filemanager";

import "@svar-ui/react-filemanager/all.css";
import "./FileManager.css";

const BackendServer = "/fm-api"; 
const restProvider = new RestDataProvider(BackendServer);

export default function FileManager() {
    const [data, setData] = useState([]);
    const [drive, setDrive] = useState({});

    const init = (api) => {
        // save/rename/delete/upload
        api.setNext(restProvider); 

        // lazy-loading subfolder content
        api.on("request-data", ({ id }) => {
            restProvider.loadFiles(id).then((files) => {
                api.exec("provide-data", { id, data: files });
            });
        });
    };

    useEffect(() => {
        // captures backend responses
        Promise.all([restProvider.loadFiles(), restProvider.loadInfo()]).then(
            ([files, info]) => {
                setData(files);
                
                if (info && info.stats) {
                    setDrive(info.stats);
                }
            }
        ).catch(err => {
            console.error("Failed to load file manager data:", err);
        });
    }, []);

    return (
        <div className="file-manager" style={{ width: "100%", height: "600px" }}>
            <WillowDark>
                <Filemanager init={init} data={data} drive={drive} />
            </WillowDark>
        </div>
    );
}
