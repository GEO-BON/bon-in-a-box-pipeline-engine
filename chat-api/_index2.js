import express from "express";
import {
  CopilotRuntime,
  GoogleGenerativeAIAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from "@copilotkit/runtime";
import { BuiltInAgent } from "@copilotkit/runtime/v2";

const app = express();
app.use(express.json());

// Copilot runtime with MCP support
const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: "google/gemini-2.5-flash",
      instructions:
        "You are a helpful AI assistant for the BON in a Box pipeline engine. You help users with biodiversity data processing, pipelines, and general questions. You have access to tools for executing scripts and pipelines. Answer all questions to the best of your ability - do not claim to have limited capabilities. Be conversational, helpful, and informative.",
      mcpServers: [
        {
          id: "bon-in-a-box-mcp",
          transport: {
            type: "http",
            url: "http://python-api:8002",
          },
        },
      ],
    }),
  },
});

// Gemini LLM adapter
const serviceAdapter = new GoogleGenerativeAIAdapter({
  model: "google/gemini-2.5-flash",
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Handle GET /copilotkit/info for the React frontend
app.get("/copilotkit/info", (req, res) => {
  const info = {
    version: "1.51.3",
    agents: {
      default: {
        name: "default",
        description: "BON in a Box AI assistant",
      },
    },
  };
  res.json(info);
});

const copilotHandler = copilotRuntimeNodeHttpEndpoint({
  endpoint: "/copilotkit",
  runtime,
  serviceAdapter,
});

app.use("/copilotkit", (req, res, next) => {
  Promise.resolve(copilotHandler(req, res)).catch(next);
});

app.listen(4000, () =>
  console.log(
    "CopilotKit backend listening on http://localhost:4000/copilotkit",
  ),
);
