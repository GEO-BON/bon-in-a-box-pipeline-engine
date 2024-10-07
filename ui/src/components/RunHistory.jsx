import { useEffect, useState } from "react";
import { Spinner } from "./Spinner";
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

var callback = function (error, data, response) {
  if (error) {
    console.error(error);
  } else {
    console.log("API called successfully. Returned data: " + data);
  }
};

export default function RunHistory() {
  let [runHistory, setRunHistory] = useState();
  useEffect(() => {
    api.getHistory((error, _, response) => {
      if (response && response.text) {
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
      } else if (error) setRunHistory(error.toString());
      else setRunHistory(null);
    });
  }, []);

  return (
    <p style={{ whiteSpace: "pre-wrap" }}>
      {runHistory ? runHistory : <Spinner />}
    </p>
  );
}

const color = (status) => {
  switch (status) {
    case "completed":
      return "#75bdad";
    case "error":
      return "red";
    case "aborted":
      return "yellow";
  }
};

const ExpandMore = styled((props) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme }) => ({
  marginLeft: "auto",
  transition: theme.transitions.create("transform", {
    duration: 50,
  }),
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
        setInputs(run.inputs);
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
          {status !== "error" && status !== "unavailable" && (
            <a href={`/viewer/${run.runId}`} target="_blank">
              <CustomButtonGreen>See in viewer</CustomButtonGreen>
            </a>
          )}
          {status !== "unavailable" && (
            <a href={debug_url} target="_blank">
              <CustomButtonGreen>See in debug UI</CustomButtonGreen>
            </a>
          )}

          <ExpandMore
            expand={expanded}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show more"
          >
            {!expanded && (
              <Typography sx={{ fontFamily: "Roboto" }}>Inputs</Typography>
            )}
            <ExpandMoreIcon />
          </ExpandMore>
        </CardActions>
        {Object.entries(inputs).length > 0 && (
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <CardContent>
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
                          {inputs[i[0]] && (
                            <Tooltip title={i[0]}>{inputs[i[0]].label}</Tooltip>
                          )}
                          {!inputs[i[0]] && <>{i[0]}</>}
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
