import { useState, useEffect } from 'react';
import { RestDataProvider } from "@svar-ui/filemanager-data-provider";
import { Filemanager, WillowDark, getMenuOptions } from "@svar-ui/react-filemanager";

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

    function menuOptions(mode, item) {
        let options = getMenuOptions(mode);
        if (mode == "add") {
            options = options.filter((o) => o.id != "add-file");
        }
        return options;
    }

    useEffect(() => {
        // debugging 
        // console.log({ DISABLE_MY_FILES });

        // captures backend responses
        Promise.all([restProvider.loadFiles(), restProvider.loadInfo()]).then(
            ([files, info]) => {
                setData(files);
            }
        ).catch(err => {
            console.error("Failed to load file manager data:", err);
        });
    }, []);

    return (
        <div className="file-manager" style={{ width: "100%" }}>
            <WillowDark>
                <Filemanager init={init} data={data} menuOptions={menuOptions} drive={drive} />
            </WillowDark>
        </div>
    );
}
