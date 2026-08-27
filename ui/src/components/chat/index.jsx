import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./style.css";

const CHAT_URL = import.meta.env.VITE_RAG_URL || "/ask/stream";

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! How can I assist you with the Biodiversity Evaluation Engine today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    // Capture conversation history before adding the new turn.
    // Slice off the initial hardcoded greeting (index 0) so only real Q&A
    // exchanges are forwarded to the model as context.
    const history = messages.slice(1).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [
      ...m,
      { role: "user", content: question },
      { role: "assistant", content: "", thinking: "" },
    ]);
    setLoading(true);

    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: history.length ? history : undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      // Use {stream:true} so multi-byte UTF-8 chars split across packets decode correctly.
      const decoder = new TextDecoder("utf-8");
      // Buffer accumulates raw text across reader.read() calls so that SSE
      // events that span TCP packet boundaries are never split mid-JSON.
      let buffer = "";
      let streamDone = false;
      while (!streamDone) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Process every complete line (terminated by \n) in the buffer.
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trimEnd();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data: ")) continue;
          if (line === "data: [DONE]") { streamDone = true; break; }
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.error) throw new Error(payload.error);
            if (payload.token) {
              setMessages((m) => {
                const last = m.at(-1);
                return [...m.slice(0, -1), { ...last, content: last.content + payload.token }];
              });
            }
            if (payload.think) {
              setMessages((m) => {
                const last = m.at(-1);
                return [...m.slice(0, -1), { ...last, thinking: (last.thinking || "") + payload.think }];
              });
            }
          } catch (parseErr) {
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
                    {m.content}
                  </ReactMarkdown>
                </>
              ) : (
                m.content
              )}
              {i === messages.length - 1 &&
                loading &&
                m.role === "assistant" && <span className="cursor">▋</span>}
            </div>
          </div>
        ))}
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
