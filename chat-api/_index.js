import express from "express";
import {
  CopilotRuntime,
  copilotRuntimeNodeExpressEndpoint,
  OpenAIAdapter,
} from "@copilotkit/runtime";
import { BuiltInAgent } from "@copilotkitnext/agent";
import cors from "cors";
import { OpenAI } from "openai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["*"],
  }),
);

const logOpenRouterRequest = async (url, options = {}) => {
  try {
    if (options?.body) {
      let bodyText = "";
      if (typeof options.body === "string") {
        bodyText = options.body;
      } else if (options.body instanceof Uint8Array) {
        bodyText = Buffer.from(options.body).toString("utf8");
      }

      if (bodyText) {
        try {
          const parsed = JSON.parse(bodyText);
          const messages = Array.isArray(parsed?.messages) ? parsed.messages : [];
          const missingContent = messages.filter(
            (msg) => msg && typeof msg === "object" && msg.content === undefined,
          ).length;
          console.log("OPENROUTER: outbound request", {
            url,
            messageCount: messages.length,
            missingContent,
            model: parsed?.model,
          });
        } catch {
          console.log("OPENROUTER: outbound request (non-JSON body)", {
            url,
            bodyLength: bodyText.length,
          });
        }
      }
    }
  } catch (error) {
    console.warn("OPENROUTER: failed to log request", error);
  }

  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  console.log("OPENROUTER: response status", {
    url,
    status: response.status,
    contentType,
  });

  if (contentType.includes("text/event-stream") && response.body) {
    try {
      const reader = response.clone().body.getReader();
      const { value } = await reader.read();
      if (value) {
        const chunkText = Buffer.from(value).toString("utf8");
        console.log("OPENROUTER: first SSE chunk", chunkText.slice(0, 500));
      } else {
        console.log("OPENROUTER: first SSE chunk empty");
      }
    } catch (error) {
      console.warn("OPENROUTER: failed to read SSE chunk", error);
    }
  }

  if (!response.ok) {
    try {
      const text = await response.clone().text();
      console.error("OPENROUTER: error response", {
        url,
        status: response.status,
        body: text,
      });
    } catch (error) {
      console.warn("OPENROUTER: failed to read error response", error);
    }
  }
  return response;
};

app.use(
  "/copilotkit",
  express.json({ limit: "2mb" }),
  (req, _res, next) => {
    if (req.method === "POST") {
      console.log("CHAT-API: /copilotkit POST received", {
        path: req.path,
        contentType: req.headers["content-type"],
      });

      console.log("CHAT-API: raw body info", {
        bodyType: typeof req.body,
        isArray: Array.isArray(req.body),
        keys: req.body && typeof req.body === "object" ? Object.keys(req.body) : [],
      });

      if (req.body?.method) {
        console.log("CHAT-API: method", {
          method: req.body.method,
          paramsKeys: req.body.params && typeof req.body.params === "object" ? Object.keys(req.body.params) : [],
          agentId: req.body.params?.agentId,
          hasParamsBody: !!req.body.params?.body,
          hasBody: !!req.body.body,
        });
      }

      const normalizeMessages = (messages) => {
        if (!Array.isArray(messages)) return messages;
        const normalizeContent = (value) => {
          if (value === undefined || value === null) return "";
          if (typeof value === "string") return value;
          try {
            return JSON.stringify(value);
          } catch (error) {
            return String(value);
          }
        };

        return messages.map((msg) => {
          if (!msg || typeof msg !== "object") return msg;
          const rawContent = msg.content ?? msg.result;
          const content = normalizeContent(rawContent);
          if (rawContent !== content) {
            console.warn("CHAT-API: Normalized message content", {
              role: msg.role,
              hadContent: rawContent !== undefined && rawContent !== null,
            });
          }
          return {
            ...msg,
            content,
          };
        });
      };

      const normalizeCopilotBody = (payload) => {
        if (!payload || typeof payload !== "object") return payload;
        if (Array.isArray(payload.messages)) {
          payload.messages = normalizeMessages(payload.messages);
        }
        if (payload.input && Array.isArray(payload.input.messages)) {
          payload.input.messages = normalizeMessages(payload.input.messages);
        }
        if (payload.body && Array.isArray(payload.body.messages)) {
          payload.body.messages = normalizeMessages(payload.body.messages);
        }
        return payload;
      };

      if (typeof req.body === "string") {
        try {
          req.body = JSON.parse(req.body);
          console.log("CHAT-API: parsed string body to JSON");
        } catch (error) {
          console.warn("CHAT-API: failed to parse string body", error);
        }
      }

      if (req.body?.body) {
        const direct = req.body.body;
        if (typeof direct === "string") {
          try {
            req.body.body = JSON.parse(direct);
          } catch (error) {
            console.warn("CHAT-API: failed to parse body", error);
          }
        }
        req.body.body = normalizeCopilotBody(req.body.body);

        const bodyObj = req.body.body;
        if (bodyObj && typeof bodyObj === "object") {
          console.log("CHAT-API: body keys", Object.keys(bodyObj));
          const msgCount = Array.isArray(bodyObj.messages) ? bodyObj.messages.length : 0;
          const inputMsgCount = Array.isArray(bodyObj.input?.messages) ? bodyObj.input.messages.length : 0;
          const nestedMsgCount = Array.isArray(bodyObj.body?.messages) ? bodyObj.body.messages.length : 0;
          console.log("CHAT-API: body message counts", {
            messages: msgCount,
            inputMessages: inputMsgCount,
            nestedMessages: nestedMsgCount,
          });
        }
      }

      if (req.body?.method && req.body?.params?.body) {
        const inner = req.body.params.body;
        if (typeof inner === "string") {
          try {
            req.body.params.body = JSON.parse(inner);
          } catch (error) {
            console.warn("CHAT-API: failed to parse params.body", error);
          }
        }
        req.body.params.body = normalizeCopilotBody(req.body.params.body);
      }

      req.body = normalizeCopilotBody(req.body);

      const logRoles = (label, messages) => {
        if (!Array.isArray(messages)) return;
        const roles = messages.map((msg) => {
          if (!msg || typeof msg !== "object") return "invalid";
          const content = msg.content ?? msg.result ?? "";
          const length = typeof content === "string" ? content.length : 0;
          return `${msg.role ?? "unknown"}:${length}`;
        });
        console.log(label, roles);
      };

      logRoles("CHAT-API: incoming message roles", req.body?.messages);
      logRoles("CHAT-API: incoming params.body roles", req.body?.params?.body?.messages);
      logRoles("CHAT-API: incoming body roles", req.body?.body?.messages);
      logRoles("CHAT-API: incoming body.input roles", req.body?.body?.input?.messages);
      logRoles("CHAT-API: incoming body.body roles", req.body?.body?.body?.messages);
    }
    next();
  },
);


// OpenAI SDK client pointed at OpenRouter (OpenAI-compatible API)
const openRouterClient = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  fetch: logOpenRouterRequest,
});

const serviceAdapter = new OpenAIAdapter({
  openai: openRouterClient,
  model: "nvidia/nemotron-3-nano-30b-a3b:free",  // supports tool use; see https://openrouter.ai/models?supported_parameters=tools
});

// Vercel AI SDK OpenAI provider (v2) configured for OpenRouter chat-completions
const openaiProvider = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  fetch: logOpenRouterRequest,
});

const instructions =
  "You are a helpful AI assistant for the BON in a Box platform with access to MCP servers. You can answer questions about biodiversity, help with data processing, execute scripts and pipelines, and provide general assistance. Be conversational and helpful. You have access to general knowledge. Try to finish answering all questions by running a pipeline on the BON in a Box API. Never claim to have limited capabilities - answer all questions to the best of your ability."

const defaultAgent = new BuiltInAgent({
  model: openaiProvider.chat("openrouter/aurora-alpha"),
  maxSteps: 3,
  toolChoice: "auto",
  maxRetries: 2,
  mcpServers: [
    {
      type: "http",
      url: "http://python-api:8002/mcp",
    },
  ],
});

const runtime = new CopilotRuntime({
  instructions,
  agents: {
    default: defaultAgent,
  },
  beforeRequestMiddleware: async ({ request }) => {
    if (request.method === "GET") return;

    console.log("CHAT-API: beforeRequestMiddleware invoked", {
      path: request.url,
    });

    const cloned = request.clone();
    const body = await cloned.json().catch(() => null);
    if (!body || !Array.isArray(body.messages)) return;

    const missingContentCount = body.messages.filter(
      (msg) => msg && typeof msg === "object" && msg.content === undefined,
    ).length;
    if (missingContentCount > 0) {
      console.warn("MCP: Incoming messages missing content", {
        count: missingContentCount,
        path: request.url,
      });
    }

    const normalizeContent = (value) => {
      if (value === undefined || value === null) return "";
      if (typeof value === "string") return value;
      try {
        return JSON.stringify(value);
      } catch (error) {
        return String(value);
      }
    };

    const messages = body.messages.map((msg) => {
      if (!msg || typeof msg !== "object") return msg;
      const rawContent = msg.content ?? msg.result;
      const content = normalizeContent(rawContent);
      if (rawContent !== content) {
        console.warn("MCP: Normalized message content", {
          role: msg.role,
          hadContent: rawContent !== undefined && rawContent !== null,
        });
      }
      return {
        ...msg,
        content,
      };
    });

    const newBody = JSON.stringify({
      ...body,
      messages,
    });

    return new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: newBody,
    });
  },
});

const copilotRuntimeHandler = copilotRuntimeNodeExpressEndpoint({
  endpoint: "/",
  runtime,
  serviceAdapter,
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

// Response instrumentation for SSE debugging
app.use("/copilotkit", (req, res, next) => {
  if (req.method !== "POST") {
    next();
    return;
  }

  const start = Date.now();
  let bytes = 0;
  let firstWriteLogged = false;
  let chunkLogCount = 0;
  const eventCounts = new Map();
  let lastToolResult = null;
  let lastToolName = null;
  let lastMessageId = null;
  let sawTextChunk = false;
  let pendingFinishEvent = null;
  let injectedFallback = false;
  const logEvent = (event) => {
    if (!event || typeof event !== "object") return;
    const type = event.type || "unknown";
    eventCounts.set(type, (eventCounts.get(type) || 0) + 1);
    if (type === "TOOL_CALL_RESULT") {
      lastToolResult = event.content ?? null;
      lastToolName = event.toolCallName ?? lastToolName;
    }
    if (type === "TEXT_MESSAGE_CHUNK" && event.messageId) {
      lastMessageId = event.messageId;
      sawTextChunk = true;
    }
    if (chunkLogCount < 10) {
      chunkLogCount += 1;
      const preview = typeof event.delta === "string" ? event.delta.slice(0, 200) : undefined;
      console.log("CHAT-API: response event", {
        index: chunkLogCount,
        type,
        toolCallName: event.toolCallName,
        preview,
      });
    }
  };

  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  res.write = (chunk, ...args) => {
    if (chunk) {
      bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
    }
    if (!firstWriteLogged) {
      firstWriteLogged = true;
      console.log("CHAT-API: response write started", {
        path: req.path,
        status: res.statusCode,
        contentType: res.getHeader("content-type"),
      });
    }
    if (!chunk) {
      return originalWrite(chunk, ...args);
    }

    const chunkText = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    const lines = chunkText.split("\n");
    const outLines = [];
    let modified = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        outLines.push(line);
        continue;
      }

      const jsonText = trimmed.replace(/^data:\s*/, "");
      if (!jsonText) {
        outLines.push(line);
        continue;
      }

      try {
        const event = JSON.parse(jsonText);
        logEvent(event);
        if (event.type === "RUN_FINISHED") {
          pendingFinishEvent = event;
          modified = true;
          continue;
        }
        outLines.push(line);
      } catch {
        outLines.push(line);
      }
    }

    if (modified) {
      const outText = outLines.join("\n");
      return originalWrite(outText, ...args);
    }
    return originalWrite(chunk, ...args);
  };

  res.end = (chunk, ...args) => {
    if (chunk) {
      bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
    }
    const summary = Array.from(eventCounts.entries()).reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
    const hasText = eventCounts.has("TEXT_MESSAGE_CHUNK");
    if (!hasText && lastToolResult && !injectedFallback) {
      const safeResult = typeof lastToolResult === "string" ? lastToolResult : JSON.stringify(lastToolResult);
      const resultSnippet = safeResult.length > 2000 ? safeResult.slice(0, 2000) + "\n...<truncated>" : safeResult;
      const fallbackMessage = [
        "Tool result",
        lastToolName ? `(${lastToolName})` : "",
        ":\n",
        resultSnippet,
      ].join(" ");
      const syntheticEvent = {
        type: "TEXT_MESSAGE_CHUNK",
        role: "assistant",
        messageId: lastMessageId || `fallback-${Date.now()}`,
        delta: fallbackMessage,
      };
      res.write(`data: ${JSON.stringify(syntheticEvent)}\n\n`);
      injectedFallback = true;
      summary.TEXT_MESSAGE_CHUNK = (summary.TEXT_MESSAGE_CHUNK || 0) + 1;
    }
    if (pendingFinishEvent) {
      res.write(`data: ${JSON.stringify(pendingFinishEvent)}\n\n`);
      summary.RUN_FINISHED = (summary.RUN_FINISHED || 0) + 1;
    }
    console.log("CHAT-API: response end", {
      path: req.path,
      status: res.statusCode,
      contentType: res.getHeader("content-type"),
      bytes,
      durationMs: Date.now() - start,
      eventCounts: summary,
    });
    return originalEnd(chunk, ...args);
  };

  res.on("close", () => {
    if (!res.writableEnded) {
      console.log("CHAT-API: response closed early", {
        path: req.path,
        status: res.statusCode,
        bytes,
        durationMs: Date.now() - start,
      });
    }
  });

  next();
});

app.use("/copilotkit", copilotRuntimeHandler);

app.listen(4000, () => {
  console.log("Listening at http://localhost:4000/copilotkit");
});
