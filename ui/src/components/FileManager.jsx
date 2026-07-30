import { Filemanager, WillowDark } from "@svar-ui/react-filemanager";
import "@svar-ui/react-filemanager/all.css";
import "./FileManager.css";

export default function FileManager() {
    return (
        <div className="file-manager">
            <WillowDark>
                <Filemanager api={"http://localhost:3200"} />
            </WillowDark>
        </div>
    );
}