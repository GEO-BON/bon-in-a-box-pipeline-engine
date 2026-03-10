import express from "express";
import {
  BuiltInAgent,
  CopilotRuntime,
} from "@copilotkit/runtime/v2";
import { createCopilotEndpointExpress } from "@copilotkitnext/runtime/express";
import cors from "cors";


const app = express();


const instructions =
  "You are a helpful AI assistant for the BON in a Box platform with access to MCP servers. You can answer questions about biodiversity, help with data processing, execute scripts and pipelines, and provide general assistance. Be conversational and helpful. You have access to general knowledge. You can look at the resources for pipelines and scripts to see what pipeliens are available and what parameters you need to set. Try to finish answering all questions by running a pipeline on the BON in a Box API. Never claim to have limited capabilities - answer all questions to the best of your ability.";

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["*"],
  }),
);


const defaultAgent = new BuiltInAgent({
  /*model: openaiProvider.chat("stepfun/step-3.5-flash:free"),*/
  model: "google/gemini-2.5-pro",
  maxSteps: 12,
  toolChoice: "auto",
  prompt: instructions,
  mcpServers: [
    {
      type: "http",
      url: "http://python-api:8002/mcp",
    },
  ],
});

const runtime = new CopilotRuntime({
  agents: {
    default: defaultAgent,
  },
});

app.use(
  createCopilotEndpointExpress({
    runtime,
    basePath: "/copilotkit",
  }),
);

app.listen(4000, () => {
  console.log("Listening at http://localhost:4000/copilotkit");
});
