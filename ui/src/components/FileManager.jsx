// import { useState, useEffect } from 'react';
// import { RestDataProvider } from "@svar-ui/filemanager-data-provider";
// import { Filemanager, WillowDark } from "@svar-ui/react-filemanager";
// import { BACKEND_URL } from "../config";

// import "@svar-ui/react-filemanager/all.css";
// import "./FileManager.css";

// const BackendServer = BACKEND_URL;

// const restProvider = new RestDataProvider(BackendServer);   // no longer need this (??)

 
// export default function FileManager() {
//     const [data, setData] = useState([]);
//     const [drive, setDrive] = useState({});

//     const init = (api) => {
//         api.setNext(restProvider); // to save/rename/delete/upload

//         // loading subfolder content
//         api.on("request-data", ({ id }) => {
//             restProvider.loadFiles(id).then((files) => {
//                 api.exec("provide-data", { id, data: files });
//             });
//         });
//     };

//     useEffect(() => {
//         Promise.all([restProvider.loadFiles(), restProvider.loadInfo()]).then(
//             ([files, info]) => {
//                 setData(files);
//                 setDrive(info.stats);
//             }
//         );
//     }, []);

//     return (
//         <div className="file-manager">
//             <WillowDark>
//                 <Filemanager init={init} data={data} drive={drive} />
//             </WillowDark>
//         </div>
//     );
// }

import { useState, useEffect } from 'react';
import { RestDataProvider } from "@svar-ui/filemanager-data-provider";
import { Filemanager, WillowDark } from "@svar-ui/react-filemanager";

import "@svar-ui/react-filemanager/all.css";
import "./FileManager.css";

// 1. Point to your proxy gateway rather than hardcoding port 8001. 
// This keeps your app stable when deploying to production!
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
        // 2. Safely capture the backend responses
        Promise.all([restProvider.loadFiles(), restProvider.loadInfo()]).then(
            ([files, info]) => {
                setData(files);
                
                // FIXED: Adjusted code here. SVAR expects the total/used metrics 
                // nested cleanly within info.stats, which matches our new FastAPI layout.
                if (info && info.stats) {
                    setDrive(info.stats);
                }
            }
        ).catch(err => {
            console.error("Failed to load file manager workspace data:", err);
        });
    }, []);

    return (
        <div className="file-manager" style={{ width: "100%", height: "600px" }}>
            <WillowDark>
                {/* Only render the Filemanager once your critical variables are ready */}
                <Filemanager init={init} data={data} drive={drive} />
            </WillowDark>
        </div>
    );
}
