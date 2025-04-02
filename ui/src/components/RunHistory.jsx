import { useEffect, useState } from "react";
import { Spinner } from "./Spinner";
import { HttpError } from "./HttpErrors";
import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid2";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import Tooltip from "@mui/material/Tooltip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import { styled } from "@mui/material/styles";
import { CustomButtonGreen } from "./CustomMUI";

export const api = new BonInABoxScriptService.DefaultApi();

export default function RunHistory() {
  let [runHistory, setRunHistory] = useState(null);
  useEffect(() => {
    api.getHistory((error, _, response) => {
      if(error) {
        if (error) setRunHistory(<HttpError httpError={error} response={response} context={"getting run history"} />);
      } else if (response && response.text) {
        const runs = JSON.parse(response.text).sort((a, b) => {
          const aa = new Date(a.startTime);
          const bb = new Date(b.startTime);
          return bb - aa;
        });
        setRunHistory(
          <Grid container spacing={2}>
            {runs.map((res) => (
              <RunCard run={res} />
            ))}
          </Grid>
        );
      } else {
        setRunHistory("Could not retrieve history: empty response.");
      }
    });
  }, []);

  return (
    <p style={{ whiteSpace: "pre-wrap" }}>
      {runHistory ? runHistory : <Spinner variant='light' />}
    </p>
  );
}

const color = (status) => {
  switch (status) {
    case "completed":
      return "#75bdad";
    case "error":
      return "red";
    case "running":
      return "#6e5384";
    // default gray (applies to cancelled pipelines)
  }
};

const ExpandMore = styled((props) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme }) => ({
  marginLeft: "auto",
  fontSize: "2em",
  transition: theme.transitions.create("transform", {
    duration: 10,
  }),
  "& hover": {
    background: "transparent",
  },
  variants: [
    {
      props: ({ expand }) => !expand,
      style: {
        transform: "rotate(0deg)",
      },
    },
    {
      props: ({ expand }) => !!expand,
      style: {
        transform: "rotate(180deg)",
      },
    },
  ],
}));

const RunCard = (props) => {
  const { run } = props;
  const [expanded, setExpanded] = useState(false);
  const [desc, setDesc] = useState("");
  const [inputs, setInputs] = useState({});
  const [status, setStatus] = useState("");
  const [name, setName] = useState("");

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  var date = new Date(run.startTime);
  const ind = run.runId.lastIndexOf(">");
  const pipeline = run.runId.substring(0, ind);
  const runHash = run.runId.substring(ind + 1);
  const debug_url = `/pipeline-form/${pipeline}/${runHash}`;
  useEffect(() => {
    api.getInfo("pipeline", `${pipeline}.json`, (error, _, response) => {
      if (response.status !== 404) {
        const res = JSON.parse(response.text);
        setDesc(res.description);
        setInputs(res.inputs);
        setStatus(run.status);
        setName(res.name);
      } else {
        setInputs({});
        setStatus("unavailable");
      }
    });
  }, [pipeline, run]);
  return (
    <Grid item size={{ md: 10, lg: 5 }}>
      <Card
        sx={{
          width: "100%",
          maxWidth: "1000px",
          background: "white",
          border: "3px solid #95a09e;",
          borderRadius: "10px",
        }}
      >
        <Tooltip title={runHash}>
          <CardHeader
            avatar={
              <Avatar sx={{ bgcolor: color(run.status) }}>
                <AccountTreeIcon sx={{ color: "#f3f3f1" }} />
              </Avatar>
            }
            title={run.runId.substring(0, ind)}
            subheader={date.toLocaleString(navigator.language)}
          />
        </Tooltip>
        <CardContent>
          <Tooltip title={desc}>
            <Typography variant="body2" sx={{ color: "black" }}>
              {name}
            </Typography>
          </Tooltip>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            Status:{" "}
            {status === "unavailable" && (
              <>This pipeline is not available in the current branch</>
            )}
            {status !== "unavailable" && <>{status}</>}
          </Typography>
        </CardContent>
        <CardActions disableSpacing>
          {status !== "error" &&
            status !== "unavailable" &&
            status !== "running" && (
              <a href={`/viewer/${run.runId}`} target="_blank">
                <CustomButtonGreen>See in viewer</CustomButtonGreen>
              </a>
            )}
          {status !== "unavailable" && (
            <a href={debug_url} target="_blank">
              <CustomButtonGreen>See in run UI</CustomButtonGreen>
            </a>
          )}

          <ExpandMore
            expand={expanded}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show more"
          >
            <ExpandMoreIcon
              sx={{ fontSize: "1.2em", color: "var(--biab-green-trans-main)" }}
            />
          </ExpandMore>
        </CardActions>
        {Object.entries(run.inputs).length > 0 && (
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <CardContent>
              <Typography
                sx={{
                  color: "#444",
                  fontSize: "0.9em",
                  marginBottom: "10px",
                }}
              >
                {desc}
              </Typography>
              <h3 style={{ color: "var(--biab-green-main)" }}>Inputs</h3>
              <Table size="small">
                <TableBody>
                  {Object.entries(run.inputs).map((i) => {
                    return (
                      <TableRow>
                        <TableCell
                          sx={{
                            maxWidth: "300px",
                            wordWrap: "break-word",
                            fontWeight: "bold",
                          }}
                        >
                          {i[0] in inputs && !!inputs[i[0]] && (
                            <Tooltip title={i[0]}>{inputs[i[0]].label}</Tooltip>
                          )}
                          {!(i[0] in inputs) && <>{i[0]}</>}
                        </TableCell>
                        <TableCell>{i[1]}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Collapse>
        )}
      </Card>
    </Grid>
  );
};
