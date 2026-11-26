import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import { RestDataProvider } from "@svar-ui/filemanager-data-provider";
import { Locale } from "@svar-ui/react-core";
import { Filemanager, WillowDark, getMenuOptions } from "@svar-ui/react-filemanager";
import { fileManagerLocale } from "./fileManagerLocale";

import "@svar-ui/react-filemanager/all.css";
import "./FileManager.css";

const BackendServer = "/file-manager";
const restProvider = new RestDataProvider(BackendServer);

export default function FileManager() {
    const { t, i18n } = useTranslation("fileManager");
    const [data, setData] = useState([]);
    const [drive, setDrive] = useState({});
    const words = useMemo(
        () => i18n.resolvedLanguage === "en" ? undefined : fileManagerLocale(t),
        [i18n.resolvedLanguage, t]
    );

    const init = useCallback((api) => {
        // save/rename/delete/upload
        api.setNext(restProvider);

        // lazy-loading subfolder content
        api.on("request-data", ({ id }) => {
            restProvider.loadFiles(id).then((files) => {
                api.exec("provide-data", { id, data: files });
            });
        });
    }, []);

    function menuOptions(mode, item) {
        let options = getMenuOptions(mode);
        if (mode == "add") {
            options = options.filter((o) => o.id != "add-file");
        }
        return options;
    }

    useEffect(() => {
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
                <Locale words={words}>
                    <Filemanager init={init} data={data} menuOptions={menuOptions} drive={drive} />
                </Locale>
            </WillowDark>
        </div>
    );
}
