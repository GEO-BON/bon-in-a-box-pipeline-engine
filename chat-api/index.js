import express from 'express';
import {
  CopilotRuntime,
  copilotRuntimeNodeExpressEndpoint,
  GoogleGenerativeAIAdapter,
  ExperimentalEmptyAdapter,
} from '@copilotkit/runtime';
import { BuiltInAgent } from '@copilotkit/runtime/v2';
import cors from 'cors';

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["*"],
  }),
);

const serviceAdapter = new GoogleGenerativeAIAdapter({ model:"google/gemini-2.5-flash" });

const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: "google/gemini-2.5-flash",
      instructions: "You are a helpful AI assistant for the BON in a Box pipeline engine. You help users with biodiversity data processing, pipelines, and general questions. You have access to tools for executing scripts and pipelines. Answer all questions to the best of your ability - do not claim to have limited capabilities. Be conversational, helpful, and informative.",
    }),
  },
});

/*const copilotRuntime = copilotRuntimeNodeExpressEndpoint({*/
const copilotRuntimeNodeHttpEndpoint= copilotRuntimeNodeExpressEndpoint({
  endpoint: '/',
  runtime,
  serviceAdapter,
});

// Handle GET /copilotkit/info for the React frontend
app.get('/copilotkit/info', (req, res) => {
  const info = {
    version: "1.51.3",
    agents: {
      default: {
        name: "default",
        description: "Default AI assistant",
      },
    },
  };
  res.json(info);
});

/*app.use('/copilotkit', copilotRuntime);*/

app.use('/copilotkit', (req, res, next) => {
  (async () => {
    const handler = copilotRuntimeNodeHttpEndpoint;
    return handler(req, res);
  })().catch(next);
});

app.listen(4000, () => {
  console.log('Listening at http://localhost:4000/copilotkit');
});