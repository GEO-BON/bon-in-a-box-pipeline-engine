import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./style.css";

// mcp-bridge serves Ollama's own API. /llm/ rather than /api/, because /api/ is
// already script-server's -- see http-proxy/conf.d-prod/ngnix.conf.
const CHAT_URL = import.meta.env.VITE_CHAT_URL || "/llm/api/chat";
const PROMPT_URL = import.meta.env.VITE_CHAT_PROMPT_URL || "/assistant/prompt";

// Must name a model already resident in the shared Ollama. That instance runs with
// OLLAMA_MAX_LOADED_MODELS=1, so asking for a different tag evicts the resident one
// on every alternation and destroys latency for everything else using it.
const MODEL_NAME = import.meta.env.VITE_CHAT_MODEL || "qwen3.5:9b";

// Strip tool-call JSON blocks and bridge-injected "Assistant:" prefixes that leak
// through when the model emits tool calls as plain text instead of using Ollama's
// native tool_calls field. Smaller models do this often enough to matter.
function cleanContent(text) {
  const trimmed = text.trim();
  // If the entire response is a tool-call JSON object, the bridge failed to execute
  // the tool -- show a neutral placeholder rather than raw JSON.
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && "name" in parsed && "arguments" in parsed) {
      return "_Querying the engine…_";
    }
  } catch {
    // Not a bare tool call; fall through to the partial strip below.
  }
  return text
    .replace(/\{[\s\S]*?"name"\s*:[\s\S]*?"arguments"\s*:\s*\{[\s\S]*?\}\s*\}/g, "")
    .replace(/^Assistant:\s*/gm, "")
    .trim();
}

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! How can I assist you with the Biodiversity Evaluation Engine today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // True between sending and the first token: the shared Ollama runs with
  // OLLAMA_NUM_PARALLEL=1, so a turn can sit in a queue for a while with nothing to
  // show. Without this the composer just looks frozen.
  const [waiting, setWaiting] = useState(false);
  const bottomRef = useRef(null);

  // Fetched rather than inlined so it stays single-sourced with the MCP server's
  // guides, and so its links point at this instance. ollama-mcp-bridge has no system
  // prompt of its own -- it forwards whatever messages we send -- so without this the
  // model gets no guidance about the platform at all.
  const systemPrompt = useRef(null);
  useEffect(() => {
    let cancelled = false;
    fetch(PROMPT_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && body?.prompt) systemPrompt.current = body.prompt;
      })
      .catch(() => {
        // Non-fatal: the assistant still answers, just without platform guidance.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    // Capture conversation history before adding the new turn. Slice off the initial
    // hardcoded greeting (index 0) so only real Q&A exchanges become model context.
    const history = messages.slice(1).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [
      ...m,
      { role: "user", content: question },
      { role: "assistant", content: "", thinking: "" },
    ]);
    setLoading(true);
    setWaiting(true);

    try {
      const outgoing = [...history, { role: "user", content: question }];
      if (systemPrompt.current) {
        outgoing.unshift({ role: "system", content: systemPrompt.current });
      }

      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL_NAME,
          stream: true,
          options: {
            num_ctx: 16384,
            num_batch: 64,
          },
          messages: outgoing,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      // {stream:true} so multi-byte UTF-8 chars split across packets decode correctly.
      const decoder = new TextDecoder("utf-8");
      // Buffer accumulates raw text across reader.read() calls so that events
      // spanning TCP packet boundaries are never split mid-JSON.
      let buffer = "";
      let streamDone = false;
      while (!streamDone) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trimEnd();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          if (line === "data: [DONE]") {
            streamDone = true;
            break;
          }
          try {
            const payload = line.startsWith("data: ")
              ? JSON.parse(line.slice(6))
              : JSON.parse(line);
            if (payload.error) throw new Error(payload.error);
            const token = payload.token ?? payload?.message?.content ?? payload.response;
            const thinkToken = payload?.message?.thinking ?? payload.think;
            if (token || thinkToken) setWaiting(false);
            if (token) {
              setMessages((m) => {
                const last = m.at(-1);
                return [...m.slice(0, -1), { ...last, content: last.content + token }];
              });
            }
            if (thinkToken) {
              setMessages((m) => {
                const last = m.at(-1);
                return [
                  ...m.slice(0, -1),
                  { ...last, thinking: (last.thinking || "") + thinkToken },
                ];
              });
            }
            // Do NOT break on payload.done -- the bridge sends multiple Ollama
            // responses in one stream (one per tool-call round), each with done:true.
            // Only the HTTP connection closing signals the end of the turn.
          } catch (parseErr) {
            // Swallow JSON parse errors from an incomplete or malformed chunk.
            // Chrome and Firefox word SyntaxError differently, so match on type.
            if (!(parseErr instanceof SyntaxError)) throw parseErr;
          }
        }
      }
      reader.cancel();
    } catch (err) {
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
      setWaiting(false);
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-header">Biodiversity Evaluation Engine Assistant</div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-message ${m.role}`}>
            <div className="chat-bubble">
              {m.role === "assistant" ? (
                <>
                  {m.thinking && (
                    <details className="thinking-block">
                      <summary>Thinking…</summary>
                      <div className="thinking-content">{m.thinking}</div>
                    </details>
                  )}
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {cleanContent(m.content)}
                  </ReactMarkdown>
                </>
              ) : (
                m.content
              )}
              {i === messages.length - 1 && loading && m.role === "assistant" && (
                <span className="cursor">▋</span>
              )}
            </div>
          </div>
        ))}
        {waiting && (
          <div className="chat-waiting">
            Waiting for the assistant — the model handles one request at a time, so
            this may queue behind another session.
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          value={input}
          placeholder="Ask the Biodiversity Evaluation Engine to do something..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          disabled={loading}
        />
        <button className="chat-send" onClick={send} disabled={loading}>
          {loading ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
