import { Box, Typography } from "@mui/material"
import { useTranslation } from "react-i18next"

export const ScriptInputExample = ({ example, type, optionLabels }) => {
    const { t } = useTranslation()
    if (example === null || example === undefined)
        return null

    // Options are shown with their translated label, like in the field above.
    const display = (value) => optionLabels?.[value] ?? value

    let exampleString
    if(typeof example.join === "function")
        exampleString = example.map(display).join(", ")
    else if(type === "boolean")
        exampleString = example ? "true" : "false"
    else
        exampleString = display(example)

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
