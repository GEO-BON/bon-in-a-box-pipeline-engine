"""Nothing that goes wrong mid-turn should reach the user as "Error in input stream".

The chat UI streams `/llm/api/chat` straight from `ollama-mcp-bridge`. The bridge answers
it from an async generator behind a StreamingResponse, and that generator has no error
handling of any kind: no try, no except, no `raise_for_status`. Whatever it raises after
the first byte has gone out cannot become a status code any more -- the chunked body just
stops. curl calls that "transfer closed with outstanding read data remaining"; Firefox
calls it "Error in input stream", which is the whole of what the user sees, mid-sentence,
with the answer discarded and no way to continue the turn.

Two things reach it, and they look identical from the browser:

1. A tool name the model invented. `MCPManager.call_tool` looks the name up *before* its
   try block and raises `ValueError: Tool X not found`, while every other tool failure --
   timeout, 500, schema violation -- is caught and returned as a string the model reads
   back and recovers from. A 9B model that has just written three correct tool calls and
   misremembers the fourth ends the conversation instead of being corrected.

2. Any hiccup on the link to Ollama, which is a remote, shared machine. `stream_ollama`
   builds its client with a hardcoded `timeout=None`, so `OLLAMA_PROXY_TIMEOUT` never
   applies to this path -- there is no timeout here to raise. A reset, a half-open socket,
   an eviction of the model, a 502, all surface as `httpx.ReadError` or friends out of the
   middle of the generator. This is the one that feels random, because it is.

So this wraps both. An unknown tool name becomes a message naming the tools that exist. A
broken stream becomes a clean end to the response: whatever was already generated stays on
screen, a short italic note says the connection went, and the browser sees a
properly-terminated body instead of a truncated one. If the link breaks before a single
byte has been sent, nothing has been shown yet and the turn is simply retried.

Loaded through PYTHONPATH rather than by replacing the module: `sitecustomize` is imported
by `site` at interpreter startup, so nothing in the image is shadowed, and an upstream
change to the bridge is inherited rather than silently reverted. Both halves are the kind
of thing that belongs upstream; until they are there, they belong here.

Both patches reach into the bridge's internals -- `MCPManager.call_tool` and
`ProxyService._proxy_with_tools_streaming` -- which is why the Dockerfile pins
ollama-mcp-bridge to an exact version. If you move that pin, check both still attach:
they fail loudly rather than silently, but only in the python-api log.

startup.sh sets PYTHONPATH to this directory for the bridge process only.
"""

import json
import os
import sys

# Only ever used where the client has been sent nothing yet, so a retry cannot duplicate
# text that is already on screen. Zero disables it.
RETRIES = int(os.getenv("BIAB_STREAM_RETRIES", "2"))


def _log(message):
    print(f"[biab] {message}", file=sys.stderr, flush=True)


def _guard_call_tool():
    """An invented tool name answers the model instead of killing the turn."""
    from ollama_mcp_bridge.mcp_manager import MCPManager

    if getattr(MCPManager.call_tool, "_biab_guarded", False):
        return
    original = MCPManager.call_tool

    async def call_tool(self, tool_name, arguments):
        known = [t["function"]["name"] for t in self.all_tools]
        if tool_name not in known:
            # Loud, because a model reaching for a tool that does not exist is a naming
            # problem in the playbooks or the toolset, and the only evidence today is an
            # uncaught uvicorn traceback -- not a loguru line, so a grep for ERROR over
            # the bridge log misses it entirely.
            _log(f"tool {tool_name!r} does not exist; answering the model with the "
                 f"{len(known)} that do, instead of breaking the stream")
            # Same shape as the bridge's own error string, so the model meets one
            # convention for "that call did not work" rather than two.
            return (
                f"Error executing tool: there is no tool called {tool_name}. "
                "The tools available are: " + ", ".join(sorted(known)) + ". "
                "Call the one you meant, by its exact name, or tell the user what you "
                "were unable to do."
            )
        return await original(self, tool_name, arguments)

    call_tool._biab_guarded = True
    MCPManager.call_tool = call_tool


def _guard_stream():
    """A broken stream ends the response cleanly instead of truncating it."""
    import httpx
    from ollama_mcp_bridge.proxy_service import ProxyService

    if getattr(ProxyService._proxy_with_tools_streaming, "_biab_guarded", False):
        return
    original = ProxyService._proxy_with_tools_streaming

    def _chunk(**fields):
        base = {"model": "", "created_at": "", "done": False}
        base.update(fields)
        return json.dumps(base).encode() + b"\n"

    async def _proxy_with_tools_streaming(self, endpoint, payload):
        for attempt in range(RETRIES + 1):
            sent = False
            try:
                async for chunk in original(self, endpoint=endpoint, payload=payload):
                    sent = True
                    yield chunk
                return
            except Exception as exc:
                detail = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
                # Retrying is only safe while the client has seen nothing: the bridge
                # replays the turn from the first message, and anything already yielded
                # would arrive twice. Tool results already gathered live in `payload`'s
                # copy inside the call being retried, so a retry re-runs the generation,
                # not the pipeline launch.
                retryable = isinstance(exc, httpx.TransportError) and not sent
                if retryable and attempt < RETRIES:
                    _log(f"lost the connection to Ollama before any output ({detail}); "
                         f"retrying the turn, attempt {attempt + 2} of {RETRIES + 1}")
                    continue

                _log(f"stream ended early ({detail}); closing the response cleanly so the "
                     "browser does not report a truncated body")
                note = (
                    "\n\n_The connection to the model was lost before this answer "
                    "finished. Nothing above is wrong, it is just cut short -- ask again "
                    "to continue._"
                    if sent else
                    "_The connection to the model was lost before it could answer. "
                    "Please try again._"
                )
                yield _chunk(message={"role": "assistant", "content": note})
                yield _chunk(message={"role": "assistant", "content": ""},
                             done=True, done_reason="error")
                return

    _proxy_with_tools_streaming._biab_guarded = True
    ProxyService._proxy_with_tools_streaming = _proxy_with_tools_streaming


for _guard in (_guard_call_tool, _guard_stream):
    try:
        _guard()
    except Exception as exc:  # never let a patch be the reason the bridge does not start
        _log(f"could not install {_guard.__name__} ({exc!r}); the failure it covers will "
             "still reach the user as a broken stream")
