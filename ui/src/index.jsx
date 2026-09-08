import { useState, useEffect, useContext, lazy, Suspense } from "react";

import { createRoot } from "react-dom/client";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import {
  BrowserRouter,
  createBrowserRouter,
  Route,
  RouterProvider,
  Routes,
  useLocation,
} from "react-router-dom";

import HomePage from "./components/HomePage";
import { PipelinePage } from "./components/PipelinePage";
import StepChooser from "./components/PipelineEditor/StepChooser";
import { Layout, PageTitle } from "./Layout";
import InfoPage from "./components/info/InfoPage";
import RunHistory from "./components/RunHistory";
import Chat from "./components/chat";
import { Spinner } from "./components/Spinner";
import { HttpError } from "./components/HttpErrors";
import FileManager from "./components/FileManager";
import { uiContext } from "./uiContext.jsx";

const PipelineEditor = lazy(() =>
  import("./components/PipelineEditor/PipelineEditor")
);

import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import { Alert } from "@mui/material";
export const api = new BonInABoxScriptService.DefaultApi();
export const fm_api = new BonInABoxScriptService.FileManagerApi();

// --- Startup health checks -------------------------------------------------
//
// Both checks below run against services that may still be booting. On a hosted
// deployment that is the normal case, not the exceptional one: the proxy hands the
// browser this UI as soon as the containers are up, which can be before
// script-server has bound its port and before python-api is listening. A failure on
// the first try is expected. What matters is that the UI notices when it clears,
// without the user having to reload the page.
const HEALTH_RETRY_MS = 5000;
// These two need a client of their own because callApi() takes its timeout from the
// client, and the shared one is set to 60 minutes -- right for a pipeline run,
// useless for a health check. Bounding them matters when a proxy queues requests for
// a backend that is not up yet: it holds the request open rather than refusing it,
// and an unbounded health check would sit there indefinitely.
const HEALTH_TIMEOUT_MS = 10000;

const healthClient = new BonInABoxScriptService.ApiClient();
healthClient.timeout = HEALTH_TIMEOUT_MS;
const healthApi = new BonInABoxScriptService.DefaultApi(healthClient);
const healthFmApi = new BonInABoxScriptService.FileManagerApi(healthClient);

// Module scope, so the references are stable across renders and usable as effect
// dependencies.
const checkSystemStatus = (callback) => healthApi.getSystemStatus(callback);
const checkFileManager = (callback) => healthFmApi.isFileManagerDisabled(callback);
// Which optional features this instance has switched on. Not a liveness check -- the
// two above already cover that, one per backend -- so its failure must never gate the
// UI: an instance that cannot answer it still works, it just cannot say which
// features are off. See the defaults in App().
const checkServerStatus = (callback) => healthApi.getServerStatus(callback);

/**
 * Calls `check` on a fixed interval until it succeeds, then stops.
 * Reports the last error while it is still failing, and null once it has passed.
 *
 * The interval is deliberately independent of the responses. Scheduling the next
 * attempt from inside the previous one's handler -- which is what this replaced --
 * means one request that neither succeeds nor fails ends the retrying for good, and
 * reloading the page becomes the only way to recover.
 */
function useHealthCheck(check) {
  const [state, setState] = useState({ pending: true, error: null, data: null });

  useEffect(() => {
    let stopped = false;
    let timer = null;

    const attempt = () => {
      check((error, data, response) => {
        if (stopped) return;

        if (error) {
          setState({ pending: false, error: { error, response }, data: null });
        } else {
          stopped = true;
          clearInterval(timer);
          setState({ pending: false, error: null, data });
        }
      });
    };

    attempt();
    timer = setInterval(attempt, HEALTH_RETRY_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [check]);

  return state;
}

/**
 * Whether this failure means "not up yet" rather than something the user must act
 * on. 503 is excluded on purpose: script-server answers 503 with a real
 * configuration message, which has to reach the screen instead of hiding behind a
 * "starting up" notice that would never clear.
 */
function isStarting({ error }) {
  return error.status === 502 || error.status === 504 || Boolean(error.timeout);
}

function ManageFilesPage() {
  const { disableMyFiles } = useContext(uiContext);
  return (
    <>
      <PageTitle title="Manage files" />
      {!disableMyFiles && <FileManager />}
    </>
  );
}

function NotFound() {
  const location = useLocation();
  return (
    <main style={{ padding: "1rem" }}>
      <h2>404 - Page not found</h2>
      <p>{location.pathname}</p>
      <p>Lost in the wilderness?</p>
    </main>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Layout right={<HomePage />} />
    ),
  },
  {
    path: "script-form/:pipeline?/:runHash?",
    element: (
      <Layout right={<PipelinePage key="singleScriptRun" runType="script" />} />
    ),
  },
  {
    path: "chat",
    element: (
      <Layout right={<Chat />} />
    ),
  },
  {
    path: "pipeline-form/:pipeline?/:runHash?",
    element: (
      <Layout right={<PipelinePage key="pipelineRun" runType="pipeline" />} />
    ),
  },
  {
    path: "pipeline-editor",
    element: (
      <Layout
        left={<StepChooser />}
        right={
          <>
            <PageTitle title="Pipeline Editor" />
            <Suspense fallback={<Spinner />}>
              <PipelineEditor />
            </Suspense>
          </>
        }
      />
    ),
  },
  {
    path: "history",
    element: (
      <Layout right={
        <>
          <PageTitle title="History" />
          <RunHistory />
        </>
        }
      />
    ),
  },
  {
    path: "info",
    element: (
      <Layout right={
        <>
          <PageTitle title="Info" />
          <InfoPage />
        </>
        }
      />
    ),
  },
  {
    path: "manage-files",
    element: <Layout right={<ManageFilesPage />} />,
  },
  {
    path: "*",
    element: <Layout right={<NotFound />} />,
  },
]);

const staticRouter = (content) => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<Layout right={content} />} />
      </Routes>
    </BrowserRouter>
  );
};

function App() {
  const status = useHealthCheck(checkSystemStatus);
  const fileManager = useHealthCheck(checkFileManager);
  const features = useHealthCheck(checkServerStatus);

  if (status.pending) return staticRouter(<Spinner />);

  // Which check is failing decides the wording: "Script server is offline" is simply
  // untrue when it is the file service that has not come up.
  const checks = [
    { label: "Script server", state: status },
    { label: "File service", state: fileManager },
  ];
  // A real failure outranks a not-up-yet one, so a configuration error is never
  // hidden behind a notice that says to keep waiting.
  const failed = checks.find((c) => c.state.error && !isStarting(c.state.error));
  const starting = checks.find((c) => c.state.error);

  if (failed) {
    return staticRouter(
      <HttpError
        className="systemError"
        error={failed.state.error.error}
        response={failed.state.error.response}
      />
    );
  }

  if (starting) {
    return staticRouter(
      <Alert severity="error" className="systemError">
        {starting.label} appears to be offline. If it is starting, it is not yet
        ready to respond — retrying every {HEALTH_RETRY_MS / 1000} seconds.
      </Alert>
    );
  }

  // Deliberately NOT in `checks` above: /api/status is not a liveness probe, and a
  // failure to read it must not put an error page in front of a working instance.
  // Every default below is the permissive one, so an unreadable /api/status leaves the
  // UI exactly as it behaved before this endpoint existed -- the server still enforces
  // each of these, and answers 503 with its own message if the user tries.
  //
  // disableMyFiles keeps coming from /fm-api/is_disabled rather than from
  // features.data.myFilesEnabled: that call is python-api's liveness probe and has to
  // be made anyway, and it is answered by the service that actually enforces the flag.
  // /api/status merely reports it.
  const value = {
    disableMyFiles: fileManager.data?.disabled ?? false,
    runsEnabled: features.data?.runsEnabled ?? true,
    savePipelineToServer: features.data?.savePipelineToServer ?? true,
    condaPackEnabled: features.data?.condaPackEnabled ?? true,
    antivirusEnabled: features.data?.antivirusEnabled ?? false,
    antivirusReachable: features.data?.antivirusReachable ?? null,
  };

  return (
    <uiContext.Provider value={value}>
      <RouterProvider router={router} />
    </uiContext.Provider>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
