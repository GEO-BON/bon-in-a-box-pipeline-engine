import React, { useState, useEffect, lazy, Suspense } from "react";

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
import { Layout } from "./Layout";
import InfoPage from "./components/InfoPage";
import RunHistory from "./components/RunHistory";
import { Spinner } from "./components/Spinner";
import { HttpError } from "./components/HttpErrors";
const PipelineEditor = lazy(() =>
  import("./components/PipelineEditor/PipelineEditor")
);

import * as BonInABoxScriptService from "bon_in_a_box_script_service";
import { Alert } from "@mui/material";
export const api = new BonInABoxScriptService.DefaultApi();

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
    element: <Layout right={<HomePage />} />,
  },
  {
    path: "script-form/:pipeline?/:runHash?",
    element: <Layout right={<PipelinePage key="singleScriptRun" runType="script" />} />,
  },
  {
    path: "pipeline-form/:pipeline?/:runHash?",
    element: <Layout right={<PipelinePage key="pipelineRun" runType="pipeline" />} />,
  },
  {
    path: "pipeline-editor",
    element: (
      <Layout
        left={
          <StepChooser />
        }
        right={
          <Suspense fallback={<Spinner />}>
            <PipelineEditor />
          </Suspense>
        }
      />
    ),
  },
  {
    path: "history",
    element: <Layout right={<RunHistory />} />,
  },
  {
    path: "info",
    element: <Layout right={<InfoPage />} />,
  },
  {
    path: "*",
    element: <Layout right={<NotFound />} />,
  },
]);

const staticRouter = (content) => {
  return <BrowserRouter>
    <Routes>
      <Route path="*" element={<Layout right={content} />} />
    </Routes>
  </BrowserRouter>
};

function App() {
  const [systemError, setSystemError] = useState(null);
  const [statusChecked, setStatusChecked] = useState(false);

  useEffect(() => {
    api.getSystemStatus((error, _, response) => {
      setStatusChecked(true);
      let pollingTimer = null

      if (error) {
        setSystemError({ error, response });

        const keepPollingStatus = () => {
          pollingTimer = setTimeout(() => {
            api.getSystemStatus((error, _, response) => {
              if (error) {
                keepPollingStatus();
                setSystemError({ error, response });
              } else {
                setSystemError(null)
              }
            });

          }, 5000);
        }
        keepPollingStatus();
      }

      return () => clearTimeout(pollingTimer);
    });
  }, [setSystemError, setStatusChecked]);

  if (!statusChecked)
    return staticRouter(<Spinner />);

  if (systemError) {
    if (systemError.error.status === 502) {
      return staticRouter(
        <Alert severity="error" className="systemError">
          502 error: Script server appears to be offline.
          If it is starting, it is not yet ready to respond.
        </Alert>
      );
    }
    return staticRouter(<HttpError className="systemError" error={systemError.error} response={systemError.response} />);
  }

  return <RouterProvider router={router} />;
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
