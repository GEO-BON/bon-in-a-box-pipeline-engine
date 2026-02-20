import express from "express";
import {
  CopilotRuntime,
  copilotRuntimeNodeExpressEndpoint,
  OpenAIAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from "@copilotkit/runtime";
import { BuiltInAgent } from "@copilotkitnext/agent";
import cors from "cors";
import { OpenAI } from "openai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const app = express();

const model = "liquid/lfm-2.5-1.2b-thinking:free";
// "stepfun/step-3.5-flash:free";
// "nvidia/nemotron-3-nano-30b-a3b:free"

const instructions =
  "You are a helpful AI assistant for the BON in a Box platform with access to MCP servers. You can answer questions about biodiversity, help with data processing, execute scripts and pipelines, and provide general assistance. Be conversational and helpful. You have access to general knowledge. You can look at the resources for pipelines and scripts to see what pipeliens are available and what parameters you need to set. Try to finish answering all questions by running a pipeline on the BON in a Box API. Never claim to have limited capabilities - answer all questions to the best of your ability.";

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["*"],
  }),
);
const openRouterClient = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
});

const serviceAdapter = new OpenAIAdapter({
  openai: openRouterClient,
  model: model,
});

const openaiProvider = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
});

const defaultAgent = new BuiltInAgent({
  model: openaiProvider.chat("stepfun/step-3.5-flash:free"),
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

app.use("/copilotkit", (req, res, next) => {
  if (req.path === "/info" && req.method === "GET") {
    next();
    return;
  }

  (async () => {
    const handler = copilotRuntimeNodeHttpEndpoint({
      endpoint: "/",
      runtime,
      serviceAdapter,
    });

    return handler(req, res);
  })().catch(next);
});

// Handle GET /copilotkit/info for the React frontend
app.get("/copilotkit/info", (req, res) => {
  res.json({
    version: "1.51.3",
    agents: {
      default: {
        id: "default",
        name: "Default Agent",
      },
    },
  });
});

app.listen(4000, () => {
  console.log("Listening at http://localhost:4000/copilotkit");
});
