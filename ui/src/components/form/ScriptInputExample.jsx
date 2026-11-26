import { Box, Typography } from "@mui/material"
import { useTranslation } from "react-i18next"

export const ScriptInputExample = ({ example, type }) => {
    const { t } = useTranslation()
    if (example === null || example === undefined)
        return null

    let exampleString
    if(typeof example.join === "function")
        exampleString = example.join(", ")
    else if(type === "boolean")
        exampleString = example ? "true" : "false"
    else
        exampleString = example

    return <Box>
        <Typography
            sx={{
                marginLeft: 2,
                fontFamily: "Roboto",
                fontSize: "0.75em",
                color: "#555",
            }}
        >
            <>{t("form.example", { example: exampleString })}</>
        </Typography>
    </Box>

}
