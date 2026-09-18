import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./style.css";

// The chat bridge serves Ollama's own API. /llm/ rather than /api/, because /api/ is
// already script-server's -- see http-proxy/conf.d-prod/ngnix.conf.
const CHAT_URL = import.meta.env.VITE_CHAT_URL || "/llm/api/chat";
const PROMPT_URL = import.meta.env.VITE_CHAT_PROMPT_URL || "/assistant/prompt";

// Must name a model already resident in the shared Ollama. That instance runs with
// OLLAMA_MAX_LOADED_MODELS=1, so asking for a different tag evicts the resident one
// on every alternation and destroys latency for everything else using it.
//
// `-ctx` is a Modelfile variant of qwen3.5:9b with the context size baked in, preloaded
// and pinned -- `ollama ps` reports it as UNTIL: Forever. This default used to be the
// bare `qwen3.5:9b`, which is a DIFFERENT tag, so every message evicted the pinned
// 9.2 GB model, loaded the other one, and left whatever pins `-ctx` to swap it back.
// That is what the long pause before the assistant started thinking actually was: not
// prefill, and not the size of the prompt, but a model swap around every turn.
const MODEL_NAME = import.meta.env.VITE_CHAT_MODEL || "qwen3.5:9b-ctx";

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
          // Ollama unloads an idle model after 5 minutes, and the next request pays
          // 9.2 GB of reload before its first token -- during which the stream carries
          // no bytes at all. On a busy shared host that silence can outlast nginx's 600s
          // read timeout, and the turn dies mid-flight with nothing to show for it. Since
          // a conversation is a handful of turns separated by however long the user takes
          // to read an answer, the 5-minute default expires constantly, which is a good
          // part of why the assistant fails at random rather than consistently.
          //
          // This only asks; the host decides. Another model loaded by someone else can
          // still evict this one, so it narrows the window rather than closing it -- the
          // bridge patch in python-api/app/bridge/sitecustomize.py is what makes the eviction
          // survivable when it does happen.
          keep_alive: "60m",
          // Sampling parameters only. num_ctx and num_batch are LOAD-time settings:
          // asking for values that differ from how the resident model was loaded makes
          // Ollama stand up a new runner, which means reloading 9.2 GB -- the same cost
          // as naming the wrong model, arrived at a different way. They were set here to
          // 16384 and 64; the context size now comes from the pinned `-ctx` model itself
          // (see MODEL_NAME), which is the only place that can set it without a reload.
          //
          // num_batch was also eight times below Ollama's default of 512, which slows
          // prefill on its own by splitting the prompt into far more forward passes.
          options: {
            // Ollama's default is -1: generate until the model emits a stop token or
            // the context window is full. A reasoning model that never leaves its
            // reasoning has neither, so an unbounded turn grinds through the whole
            // context and then hits nginx's 600s read timeout with nothing to show.
            // This is per generation, and the bridge runs one per tool-call round, so
            // it bounds a runaway round without shortening a legitimate answer.
            num_predict: 2048,
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

      // A turn can end having produced only reasoning: the model never leaves its
      // thinking, or spends the whole turn on tool rounds that error. cleanContent can
      // also empty a bubble on its own, by stripping a response that was nothing but a
      // tool call the bridge failed to execute. Either way the bubble renders blank and
      // the turn looks like it silently died -- so say what happened instead. The
      // reasoning, if there is any, sits in the disclosure above this text.
      setMessages((m) => {
        const last = m.at(-1);
        if (last?.role !== "assistant" || cleanContent(last.content)) return m;
        return [
          ...m.slice(0, -1),
          {
            ...last,
            content: last.thinking
              ? "_Stopped while still reasoning, without reaching an answer. The reasoning is above. Asking again, more narrowly, usually helps._"
              : "_No answer was returned. Please try again._",
          },
        ];
      });
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
          placeholder="Ask the Biodiversity Evaluation Engine for information or to run a pipeline..."
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
