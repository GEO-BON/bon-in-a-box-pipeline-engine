import { useState, useEffect } from 'react';
import { RestDataProvider } from "@svar-ui/filemanager-data-provider";
import { Filemanager, WillowDark } from "@svar-ui/react-filemanager";
import { BACKEND_URL } from "../config";

import "@svar-ui/react-filemanager/all.css";
import "./FileManager.css";

const BackendServer = BACKEND_URL;
const restProvider = new RestDataProvider(BackendServer);


export default function FileManager() {
    const [data, setData] = useState([]);
    const [drive, setDrive] = useState({});

    const init = (api) => {
        api.setNext(restProvider); // save/rename/delete/upload

        // lazy loading subfolder content
        api.on("request-data", ({ id }) => {
            restProvider.loadFiles(id).then((files) => {
                api.exec("provide-data", { id, data: files });
            });
        });
    };

    useEffect(() => {
        Promise.all([restProvider.loadFiles(), restProvider.loadInfo()]).then(
            ([files, info]) => {
                setData(files);
                setDrive(info.stats);
            }
        );
    }, []);

    return (
        <div className="file-manager">
            <WillowDark>
                <Filemanager init={init} data={data} drive={drive} />
            </WillowDark>
        </div>
    );
}