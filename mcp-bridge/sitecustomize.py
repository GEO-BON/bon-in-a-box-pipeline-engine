"""A tool name the model invents must not be able to kill the chat.

`ollama-mcp-bridge` turns every tool failure into a string the model reads back and can
recover from -- a timeout, a 500 from the API, a schema violation, all of it. Every
failure but one: `MCPManager.call_tool` looks the name up *before* that try block, and

    raise ValueError(f"Tool {tool_name} not found")

escapes into the async generator behind the StreamingResponse. The response has already
begun by then, so there is no status code left to send -- the chunked body simply stops.
curl calls that "transfer closed with outstanding read data remaining"; Firefox calls it
"Error in input stream", which is what the user sees, mid-answer, with the turn dead and
no way to continue it. A 9B model that has just written three correct tool calls and
misremembers the fourth name -- `run_step` for `biab.run_step`, or `biab.run` for a tool
that was taken off the allowlist -- ends the conversation instead of being corrected.

So this wraps the method to answer an unknown name the way the bridge answers every other
tool problem: with a message naming the tools that do exist, in the round where the model
can still act on it. `python-api/app/mcp-server/server.py` carries the other half of the
story -- `getInfo` was renamed `get_info` because of this same crash.

Loaded through PYTHONPATH rather than by replacing the module: `sitecustomize` is imported
by `site` at interpreter startup, so nothing in the image is shadowed, and an upstream
change to mcp_manager.py is inherited rather than silently reverted. If upstream moves the
raise inside the try where it belongs, this wrapper simply stops having anything to
complain about; it does not have to be removed for the image to keep working.

Wired up on the mcp-bridge service in compose.yml.
"""

import sys


def _install():
    from ollama_mcp_bridge.mcp_manager import MCPManager

    if getattr(MCPManager.call_tool, "_biab_guarded", False):
        return

    original = MCPManager.call_tool

    async def call_tool(self, tool_name, arguments):
        known = [t["function"]["name"] for t in self.all_tools]
        if tool_name not in known:
            # Loud, because a model reaching for a tool that does not exist is a naming
            # problem in the playbooks or the toolset, and the whole reason this was hard
            # to find is that the only evidence was an uncaught traceback from uvicorn --
            # not a loguru line, so it does not turn up in a grep for ERROR.
            print(
                f"[biab] tool {tool_name!r} does not exist; answering the model with the "
                f"{len(known)} that do, instead of breaking the stream",
                file=sys.stderr,
                flush=True,
            )
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


try:
    _install()
except Exception as exc:  # never let a patch be the reason the bridge does not start
    print(
        f"[biab] could not guard call_tool ({exc!r}); an unknown tool name will still "
        "break the stream",
        file=sys.stderr,
        flush=True,
    )
