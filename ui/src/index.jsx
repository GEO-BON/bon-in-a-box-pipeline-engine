import React, { useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import {
  createBrowserRouter,
  RouterProvider,
  useLocation,
} from "react-router-dom";

import { PipelinePage } from "./components/PipelinePage";
import StepChooser from "./components/PipelineEditor/StepChooser";
import { Layout } from "./Layout";
import Versions from "./components/Versions";
import RunHistory from "./components/RunHistory";
import { Spinner } from "./components/Spinner";
const PipelineEditor = lazy(() =>
  import("./components/PipelineEditor/PipelineEditor")
);

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

function App() {
  const [popupContent, setPopupContent] = useState();

  const router = createBrowserRouter([
    {
      path: "/",
      element: <Layout />,
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
            <StepChooser
              popupContent={popupContent}
              setPopupContent={setPopupContent}
            />
          }
          right={
            <Suspense fallback={<Spinner />}>
              <PipelineEditor />
            </Suspense>
          }
          popupContent={popupContent}
          setPopupContent={setPopupContent}
        />
      ),
    },
    {
      path: "history",
      element: <Layout right={<RunHistory />} />,
    },
    {
      path: "versions",
      element: <Layout right={<Versions />} />,
    },
    {
      path: "*",
      element: <Layout right={<NotFound />} />,
    },
  ]);

  return <RouterProvider router={router} />;
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
