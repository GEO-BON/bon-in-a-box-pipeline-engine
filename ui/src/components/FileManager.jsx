import { useState, useEffect } from 'react';
import { RestDataProvider } from "@svar-ui/filemanager-data-provider";
import { Filemanager, WillowDark } from "@svar-ui/react-filemanager";
import "@svar-ui/react-filemanager/all.css";
import "./FileManager.css";

const BackendServer = "http://localhost:3200";
const restProvider = new RestDataProvider(BackendServer);


export default function FileManager() {
    const [data, setData] = useState([]);
    const [drive, setDrive] = useState({});

    const init = (api) => {
        api.setNext(restProvider); // wires save/rename/delete/upload to the backend
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