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
import ReactMarkdown from "react-markdown";
import { CustomButtonGreen, CustomButtonGrey } from "./CustomMUI";
import { Alert } from "@mui/material";

export const api = new BonInABoxScriptService.DefaultApi();

export default function RunHistory() {
  let [runHistory, setRunHistory] = useState(null);
  let [start, setStart] = useState(0);
  let limit=30;
  useEffect(() => {
    api.getHistory({start, limit},(error, _, response) => {
      document.getElementById('pageTop')?.scrollIntoView({ behavior: 'smooth' });
      if (error) {
        setRunHistory(<HttpError httpError={error} response={response} context={"getting run history"} />);
      } else if (response && response.text) {
        const runs = response.body.sort((a, b) => {
          const aa = new Date(a.startTime);
          const bb = new Date(b.startTime);
          return bb - aa;
        });
        setRunHistory(
          <div id='pageTop' style={{padding:"20px"}}>
            <h1>Previous runs</h1>
              <Grid container spacing={2}>
                {runs.map((res, i) => (
                  <RunCard key={i} run={res} />
                ))}
              </Grid>
              <PreviousNext start={start} limit={limit} runLength={runs.length} setStart={setStart}/>
          </div>
        );
      } else {
        setRunHistory(<Alert severity="warning">Could not retrieve history: empty response.</Alert>);
      }
    });
  }, [start, limit]);

  return runHistory ? runHistory : <Spinner variant='light' />;
}

export const LastNRuns = async (n) => {
    const start0=0;
    return await api.getHistory({start0, n}, (error, _, response) => {
      document.getElementById('pageTop')?.scrollIntoView({ behavior: 'smooth' });
      if (error) {
        return <HttpError httpError={error} response={response} context={"getting run history"} />
      } else if (response && response.text) {
        return (
          <Grid container spacing={2}>
            {runs.map((res) => (
              <RunCard run={res} />
            ))}
          </Grid>
        );
      } else {
        return <Alert severity="warning">Could not retrieve history: empty response.</Alert>;
      }
    });
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

const PreviousNext = (props)=> {
  const { start, limit, runLength, setStart } = props;
  return(
  <Grid container spacing={2} justifyContent="flex-center" sx={{ marginTop: "20px", paddingBottom: "100px" }}>
      {start > 0 && (
        <Grid xs={12} md={6}>
          <CustomButtonGrey onClick={() => { setStart((prev) => (Math.max(prev - limit, 0))) }}>
            {"<< Previous page"}
          </CustomButtonGrey>
        </Grid>
      )}
      {runLength == limit && (
        <Grid xs={12} md={6}>
        <CustomButtonGrey onClick={()=>{setStart((prev)=>(prev+limit))}}>{"Next page >>"}</CustomButtonGrey>
        </Grid>
      )}
  </Grid>
  )
}

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
    setExpanded(false) // close card if card reused for another history item
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
  }, [pipeline, run, setExpanded]);
  return (
    <Grid size={{ md: 10, lg: 5 }}>
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
          <>
            <CardHeader
              avatar={
                <Avatar sx={{ bgcolor: color(run.status) }}>
                  <AccountTreeIcon sx={{ color: "#f3f3f1" }} />
                </Avatar>
              }
              title={run.runId.substring(0, ind)}
              subheader={date.toLocaleString(navigator.language)}
            />
          </>
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
        {run.inputs && Object.entries(run.inputs).length > 0 && (
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            {expanded && <CardContent>
              <ReactMarkdown className="historyDescription">
                {desc}
              </ReactMarkdown>
              <h3 style={{ color: "var(--biab-green-main)" }}>Inputs</h3>
              <Table size="small">
                <TableBody>
                  {Object.entries(run.inputs).map((i) => {
                    return (
                      <TableRow key={i[0]}>
                        <TableCell
                          sx={{
                            maxWidth: "300px",
                            wordWrap: "break-word",
                            fontWeight: "bold",
                          }}
                        >
                          {i[0] in inputs && !!inputs[i[0]]
                            ? <Tooltip title={i[0]}>{inputs[i[0]].label}</Tooltip>
                            : <>{i[0]}</> // When script / pipelines info not found on the server
                          }
                        </TableCell>
                        <TableCell style={{whiteSpace: "pre-wrap"}}>
                          <>{Array.isArray(i[1]) ? i[1].join(", ") : i[1]}</>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>}
          </Collapse>
        )}
      </Card>
    </Grid>
  );
};
