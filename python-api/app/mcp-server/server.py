import asyncio
import httpx
from fastmcp import FastMCP
import yaml
import json
import os
import sys

import docs_search
import run_report
import run_step as run_step_helper
import step_search

# Create an HTTP client for your API
client = httpx.AsyncClient(base_url="http://biab-gateway")

# --- The OpenAPI spec, which IS the toolset ------------------------------------
#
# Every generated tool this server exposes comes from this document, so failing to load
# it does not degrade the assistant -- it leaves it with almost nothing at all.
#
# It used to be fetched over HTTP from http://biab-gateway/swagger/openapi.yaml. That
# path only exists in DEVELOPMENT, where compose.dev.yml runs a swagger_ui container
# and the dev nginx proxies to it. Neither the production nginx nor the per-session
# Kubernetes gateway has a /swagger/ location, so in production that URL fell through
# to `location /` and returned the UI's index.html with a 200. yaml.safe_load then
# parsed that HTML into a plain string, and FastMCP.from_openapi died on it with
# "'str' object has no attribute 'get'" -- taking the whole MCP server down and
# leaving the chat bridge reporting "Total tools available: 0" with no obvious cause.
#
# So: prefer the copy baked into the image, and treat HTTP as the fallback rather
# than the source of truth. The spec belongs to script-server; the build stages it in
# (see .github/workflows/docker_python-api.yml) and compose.dev.yml bind-mounts it.
SPEC_URL = os.getenv("OPENAPI_SPEC_URL", "http://biab-gateway/swagger/openapi.yaml")
SPEC_PATHS = [
    os.getenv("OPENAPI_SPEC_PATH", ""),
    "/app/mcp-server/openapi.yaml",
    os.path.join(os.path.dirname(__file__), "openapi.yaml"),
]


def load_openapi_spec():
    """The spec as a dict, or raise with a message that says what to fix."""
    for path in SPEC_PATHS:
        if path and os.path.exists(path):
            with open(path) as f:
                spec = yaml.safe_load(f)
            if isinstance(spec, dict):
                print(f"[mcp] loaded OpenAPI spec from {path}", file=sys.stderr)
                return spec
            print(
                f"[mcp] {path} did not parse as a mapping ({type(spec).__name__}); "
                "ignoring it",
                file=sys.stderr,
            )

    print(f"[mcp] no local spec found, falling back to {SPEC_URL}", file=sys.stderr)
    response = httpx.get(SPEC_URL, timeout=10)
    response.raise_for_status()
    spec = yaml.safe_load(response.content)

    # The check that would have made the production failure obvious. YAML parses HTML
    # as a string rather than raising, so a 200 here proves nothing on its own.
    if not isinstance(spec, dict):
        raise RuntimeError(
            f"{SPEC_URL} did not return an OpenAPI document -- parsed as "
            f"{type(spec).__name__}, starting {str(spec)[:80]!r}. This is what a "
            "gateway serving index.html for an unknown path looks like. Bake the "
            "spec into the image or set OPENAPI_SPEC_PATH."
        )
    return spec


spec = load_openapi_spec()

# Create the MCP server
mcp = FastMCP.from_openapi(
    openapi_spec=spec,
    client=client,
    name="BON in a Box MCP Server",
)

# -------------------------------------------------------------------------
# 1. THE TOOLSET, KEPT SMALL ON PURPOSE
# -------------------------------------------------------------------------
# The bridge sends every registered tool's schema to the model on every request, and it
# makes one request per tool-call round -- so a tool nobody calls is not free, it is a
# tax on every generation of every conversation. The spec describes 27 operations, most
# of them the file manager and the cluster, and none of those answer any of the five
# kinds of question in modes/. The 22 dropped here were 58% of the schema budget
# (`python server.py --tool-budget`), sitting unused, on a model given a 16k window to
# hold the conversation, the playbook and every tool result of the turn as well.
#
# So the generated toolset is an allowlist rather than everything the API can do. The web
# UI still exposes all of it; only the assistant is narrowed.
#
# Removing `run` is older than that and has its own reason: see run_step below.
GENERATED_TOOLS_KEPT = {
    "getHistory",        # which runs exist, and their run ids
    "getCountriesList",  # ISO3 codes, when one is not already known
    "getRegionsList",    # adm1 codes for a country's regions
    "getCountryRegionBbox",  # the selector object a bboxCRS input takes
}


def non_json_operations(spec):
    """operationIds whose 200 response is declared, but not as JSON.

    These return plain text (a run id, "OK") or a binary body, and so can never produce
    the structured output an outputSchema promises. Named from the spec rather than
    found by scanning the registered tools, so that tools this file defines itself --
    which do return structured output -- can never be caught by it.
    """
    named = set()
    for methods in (spec.get("paths") or {}).values():
        for operation in methods.values():
            if not isinstance(operation, dict) or "operationId" not in operation:
                continue
            content = ((operation.get("responses") or {}).get("200") or {}).get("content") or {}
            if content and not any("json" in media_type for media_type in content):
                named.add(operation["operationId"])
    return named


async def prune_generated_tools(generated_names):
    """Reduce the generated tools to the allowlist, and fix up what survives.

    Both halves need the registered tool objects, so they share the one pass over them.

    The fixing up is dropping outputSchema from any kept tool that cannot produce
    structured output. FastMCP derives an outputSchema from the 200 response of every
    operation, including the ones that respond `text/plain`, and nothing then produces
    the structured content that schema advertises, so the client rejects the result:

        Output validation error: outputSchema defined but no structured output returned

    The call itself has already happened by then. That is what a chat session looks like
    when it launches two runs of the same pipeline and then loops on "the pipeline is
    running" without ever being able to say which one. The allowlist happens to exclude
    all three offenders today; this stays because the allowlist is edited by hand and the
    failure it prevents is silent and expensive.
    """
    tools = await mcp.get_tools()
    for name in sorted(tools):
        if name in GENERATED_TOOLS_KEPT or name not in generated_names:
            continue
        mcp.remove_tool(name)

    missing = GENERATED_TOOLS_KEPT - set(tools)
    if missing:
        # Not fatal -- an assistant short one tool still answers -- but silent would be
        # worse than useless: the symptom is the model insisting it cannot do something
        # it plainly should, with nothing in the logs.
        print(
            "[mcp] WARNING: these tools are on the keep list but were not generated "
            f"from the spec: {', '.join(sorted(missing))}. An operationId was renamed or "
            "removed in script-server/api/openapi.yaml.",
            file=sys.stderr,
        )

    for name in sorted(non_json_operations(spec) & GENERATED_TOOLS_KEPT):
        tool = tools.get(name)
        if tool is not None and tool.output_schema is not None:
            tool.output_schema = None
            print(f"[mcp] dropped unfulfillable outputSchema on {name}", file=sys.stderr)


GENERATED_NAMES = set(asyncio.run(mcp.get_tools()))
asyncio.run(prune_generated_tools(GENERATED_NAMES))
print(
    f"[mcp] kept {len(GENERATED_TOOLS_KEPT & GENERATED_NAMES)} of "
    f"{len(GENERATED_NAMES)} generated tools",
    file=sys.stderr,
)

# -------------------------------------------------------------------------
# 2. CONFIGURATION & FILE LOADING
# -------------------------------------------------------------------------
def load_text_file(filename):
    paths = [
        filename,
        os.path.join("/app/mcp-server/", filename),
        os.path.join(os.path.dirname(__file__), filename)
    ]
    for p in paths:
        if os.path.exists(p):
            with open(p, 'r') as f: return f.read()
    print(f"⚠️ Warning: Could not find {filename}", file=sys.stderr)
    return ""

ROLE = load_text_file("assistant-role.md")


@mcp.prompt("geospatial-analyst")
def analyst_persona() -> str:
    return ROLE

# -------------------------------------------------------------------------
# 3. THE MODE GATE
# -------------------------------------------------------------------------
# The assistant's standing instructions used to be one document, held in the system
# prompt for every turn of every conversation: how to search the docs, how to read a
# step's inputs, the five steps of launching a run, how to read a failed one. Most of it
# was wrong for whatever the user had actually asked. Someone asking what a bboxCRS is
# carried the launch procedure; someone launching BII carried the installation notes.
#
# So the standing instructions are now a routing table -- assistant-role.md, about a
# dozen lines -- and the procedure for one kind of question arrives as the result of
# asking for it. It is in context for the turn that needs it and absent from the rest.
#
# Nothing persists between turns: the UI resends only the user and assistant text, so
# each turn gates again. That is the point, not a limitation.
MODES = {
    "documentation": "about the platform itself -- an input type, a selector, /userdata/, "
                     "the editor, installing, contributing",
    "catalogue": "what pipelines or scripts exist on this instance",
    "step_details": "what one named pipeline or script does, or what inputs it takes",
    "execute": "run a pipeline or script",
    "diagnose": "a run failed, or its results look wrong",
}

# Read once, at startup, so a missing or unreadable playbook is a loud line in the
# container log rather than a tool that quietly returns nothing halfway through a
# conversation. They are a few hundred bytes each; there is nothing to gain by waiting.
PLAYBOOKS = {}
for _kind in MODES:
    _text = load_text_file(os.path.join("modes", f"{_kind}.md")).strip()
    if not _text:
        print(f"[mcp] WARNING: playbook modes/{_kind}.md is missing or empty", file=sys.stderr)
    PLAYBOOKS[_kind] = _text
print(f"[mcp] {sum(1 for t in PLAYBOOKS.values() if t)} of {len(MODES)} playbooks loaded",
      file=sys.stderr)


def _kinds_list():
    return "\n".join(f"- `{kind}` — {why}" for kind, why in MODES.items())


@mcp.tool()
def start_task(kind: str) -> str:
    """Get the procedure for one kind of question. Call this first, before anything else.

    Your instructions hold only the routing table; the procedure lives here, so each
    conversation carries the one it needs instead of all five. What comes back is what to
    do, in order, including which other tools to call.

    Args:
        kind: One of `documentation` (the platform itself: input types, selectors,
            /userdata/, the editor, installing), `catalogue` (what exists here),
            `step_details` (what one named step does or takes), `execute` (run one),
            `diagnose` (a run failed or looks wrong).

    Returns:
        The procedure to follow.
    """
    playbook = PLAYBOOKS.get((kind or "").strip().lower().replace("-", "_"))
    if playbook is None:
        return (
            f"There is no task kind called {kind!r}. Call `start_task` again with one "
            "of:\n" + _kinds_list()
        )
    if not playbook:
        # Only reachable if the file is missing from the image, which the startup warning
        # above will already have said. Do not leave the model with an empty string and
        # no idea why.
        return (
            f"The `{kind}` procedure is not installed on this server. Work from the tool "
            "descriptions instead, and tell the user the assistant is misconfigured."
        )
    return playbook


# -------------------------------------------------------------------------
# 4. DOCUMENTATION SEARCH
# -------------------------------------------------------------------------
# The thing this reads is not part of the API, so it cannot come from the spec. The
# prompt used to hand the model the docs site's URL and stop there, which told it the
# answer existed somewhere it had no way to reach.
DOCS_INDEX = docs_search.load_index()
print(f"[docs] {len(DOCS_INDEX)} documentation passages indexed", file=sys.stderr)


@mcp.tool()
def search_documentation(query: str, max_results: int = 3) -> str:
    """Search the BON in a Box user and contributor documentation.

    Covers the platform: input types and selectors, /userdata/, the editor, run history,
    installing, contributing. Not individual scripts or pipelines -- use get_info for one
    of those.

    Args:
        query: What you want to know. Prefer the platform's own vocabulary.
        max_results: Passages to return, 1-5. Keep it low; each one costs context.

    Returns:
        The matching passages, each citing the page it came from.
    """
    try:
        return DOCS_INDEX.search(query, max_results=max(1, min(5, max_results)))
    except Exception as exc:  # a doc lookup must never be what kills a chat turn
        print(f"[docs] search failed for {query!r}: {exc}", file=sys.stderr)
        return f"The documentation search failed ({exc}). Answer without it."


# -------------------------------------------------------------------------
# 5. FINDING A STEP
# -------------------------------------------------------------------------
# Replaces the generated `getListOf`, which returns {path: name} for all 99 steps and
# nothing else -- so the only way to use it is to read the whole catalogue and guess a
# path from a name. See step_search.py.
STEP_INDEX = step_search.CachedStepIndex(client)


@mcp.tool()
async def find_step(query: str = "", stepType: str = "pipeline", max_results: int = 8) -> str:
    """Find the pipelines or scripts on this instance, by what they do.

    The only list of what is installed, which differs between instances. Never name a
    pipeline that did not come back from here.

    Args:
        query: What you are looking for -- "forest cover loss". Empty gives the full
            list by name, for "what can this instance do?".
        stepType: "pipeline", "script" or "any". Pipelines by default.
        max_results: Matches to return, 1-20.

    Returns:
        Matching steps: name, one-line summary, and the path `get_info` and `run_step`
        take. Deprecated steps are left out.
    """
    try:
        index = await STEP_INDEX.get()
        return index.search(
            query,
            type=None if stepType in ("any", "", None) else stepType,
            max_results=max(1, min(20, max_results)),
        )
    except Exception as exc:
        print(f"[steps] search failed for {query!r}: {exc}", file=sys.stderr)
        return (
            f"The list of scripts and pipelines could not be read ({exc}). Say so rather "
            "than naming one from memory."
        )


# -------------------------------------------------------------------------
# 5b. READING ONE STEP
# -------------------------------------------------------------------------
# Hand-written rather than generated from the spec, for two reasons that both come down
# to the name and the schema being someone else's to choose.
#
# The name: every tool this file defines is snake_case -- start_task, find_step, run_step,
# get_run_report, search_documentation -- and the generated ones carry the spec's
# camelCase operationIds. A 9B model given both writes the majority convention, called
# `get_info`, and the bridge answers `ValueError: Tool biab.get_info not found` from
# inside the streaming response, which reaches the user as "Error in input stream" with
# the turn already half generated. It is not a wrong answer, it is a dead chat.
#
# The schema: FastMCP derives an outputSchema from the spec's `components.schemas.info`,
# which types every input's `example` as string, number, boolean or array
# (inputs.additionalProperties.example.oneOf). All 16 pipelines in pipeline-repo declare
# `example: null` on at least one input -- a bboxCRS selector and an optional text field
# have no meaningful example -- so the client rejected a response the server was right to
# send, for every pipeline on the instance. A tool returning str has no outputSchema to
# disagree with, so the mismatch cannot come back. Widening that oneOf in
# script-server/api/openapi.yaml remains worth doing for the generated API clients.
@mcp.tool()
async def get_info(stepType: str, descriptionPath: str) -> str:
    """What one pipeline or script does, and the inputs it takes.

    The `inputs` block is the answer to "what does this take?". Each entry gives the
    input's label, type, description, example, and for `options` inputs the values it
    accepts. Its keys are the keys `run_step` takes.

    Args:
        stepType: "pipeline" or "script".
        descriptionPath: The path `find_step` gives, e.g. `BII>BII.json`.

    Returns:
        The step's metadata as JSON: description, inputs, outputs, author, license.
    """
    try:
        response = await client.get(f"/{stepType}/{descriptionPath}/info", timeout=30)
        response.raise_for_status()
    except Exception as exc:
        print(f"[steps] no info for {stepType} {descriptionPath!r}: {exc}", file=sys.stderr)
        return (
            f"Could not read {descriptionPath!r} ({exc}). Check the path with `find_step` "
            "-- it must be one that came back from there."
        )
    return json.dumps(response.json(), indent=2)


# -------------------------------------------------------------------------
# 6. RUN DIAGNOSIS
# -------------------------------------------------------------------------
@mcp.tool()
def get_run_report(runId: str, max_log_lines: int = 30) -> str:
    """Report on one run: the inputs it was given, whether it failed, and why.

    `getHistory` says THAT a run failed; only this says why, because the step's error and
    log are not otherwise reachable. The inputs come back exactly as `run_step` takes them.

    Args:
        runId: From `run_step` or `getHistory` -- e.g. `BII>BIIChange>7f3a…`.
        max_log_lines: Log lines per failed step, 1-100.

    Returns:
        The run's inputs and status, and the error and log tail of any failed step.
    """
    try:
        return run_report.report(runId, max_log_lines=max(1, min(100, max_log_lines)))
    except ValueError as exc:
        return f"Cannot read that run: {exc}"
    except Exception as exc:
        print(f"[run] report failed for {runId!r}: {exc}", file=sys.stderr)
        return f"Could not read the run's files ({exc})."


# -------------------------------------------------------------------------
# 7. LAUNCHING A RUN
# -------------------------------------------------------------------------
# Replaces the generated `run` tool, whose body parameter is a JSON-encoded string with
# an object for an example and no hint of the key format. See run_step.py. `run` is off
# the allowlist above, so it is already gone by the time this file gets here.


@mcp.tool()
async def run_step(stepType: str, descriptionPath: str, inputs: dict | None = None) -> str:
    """Start a pipeline or script. This is the only way to launch a run.

    Call `get_info` first: its `inputs` block gives both the keys this takes and what they
    mean. Keys are `{step id}|{input name}` as `get_info` returns them --
    `data>loadFromStac.yml@56|t0`, not `t0` -- plus bare `pipeline@NN` keys. Anything you
    leave out is sent at the step's own example, so set only what the user asked to change.

    It returns as soon as the engine accepts the run, which then takes minutes to hours.

    Args:
        stepType: "pipeline" or "script".
        descriptionPath: The path `find_step` gives, e.g. `BII>BII.json`.
        inputs: An object keyed by full input key. Omit to run entirely on examples.

    Returns:
        The run id and the links to follow it, or -- if a key is wrong -- the keys this
        step actually accepts.
    """
    try:
        info = await client.get(f"/{stepType}/{descriptionPath}/info")
        info.raise_for_status()
        declared = (info.json() or {}).get("inputs") or {}
    except Exception as exc:
        print(f"[run] could not describe {descriptionPath!r}: {exc}", file=sys.stderr)
        return (
            f"Could not read the description of {descriptionPath!r} ({exc}). Check the "
            "path with `find_step` before running it."
        )

    if not declared:
        return (
            f"{descriptionPath!r} declares no inputs, which usually means the path is "
            "wrong. Check it with `find_step`."
        )

    try:
        body, notes = run_step_helper.prepare(declared, inputs)
    except ValueError as exc:
        return str(exc)

    try:
        started = await client.post(
            f"/{stepType}/{descriptionPath}/run",
            content=json.dumps(body),
            headers={"Content-Type": "application/json"},
            timeout=60,
        )
        started.raise_for_status()
    except Exception as exc:
        print(f"[run] launch failed for {descriptionPath!r}: {exc}", file=sys.stderr)
        return f"The engine refused to start {descriptionPath!r}: {exc}"

    return run_step_helper.launch_summary(stepType, started.text.strip(), notes)


async def tool_budget():
    """What every registered tool costs, in characters of JSON schema.

    The whole point of the allowlist and the mode gate is a number, and this is the
    number. Run it after changing either.

        python server.py --tool-budget

    Two columns, because the bridge does not forward everything it receives. `mcp` is the
    full tool definition it reads from this server; `ollama` is the {name, description,
    parameters} it puts in front of the model, which is the figure that competes with the
    conversation for the context window. They differ by outputSchema, which the generated
    tools carry and the hand-written ones do not: a response schema costs nothing where it
    matters, so optimising against the first column is optimising against the wrong number.
    """
    tools = await mcp.get_tools()
    rows = []
    for name, tool in sorted(tools.items()):
        # Measure what actually goes over the wire where that is available, rather than
        # a reconstruction of it that could drift from the real payload.
        try:
            wire = tool.to_mcp_tool().model_dump(exclude_none=True)
        except Exception:
            wire = {
                "name": name,
                "description": tool.description or "",
                "inputSchema": getattr(tool, "parameters", None),
            }
        forwarded = {
            "type": "function",
            "function": {
                "name": name,
                "description": wire.get("description", ""),
                "parameters": wire.get("inputSchema"),
            },
        }
        rows.append(
            (
                len(json.dumps(forwarded, default=str)),
                len(json.dumps(wire, default=str)),
                name,
            )
        )

    width = max(len(name) for _, _, name in rows)
    print(f"  {'tool':<{width}}  {'mcp':>7} {'ollama':>8}")
    for forwarded, wire, name in sorted(rows, reverse=True):
        print(f"  {name:<{width}}  {wire:>7} {forwarded:>8}")
    total_wire = sum(wire for _, wire, _ in rows)
    total_forwarded = sum(forwarded for forwarded, _, _ in rows)
    # Four characters to the token is the usual rule of thumb and is close enough for a
    # figure whose only job is to be compared against the one before the change.
    print(
        f"\n  {len(rows)} tools, {total_wire} chars over MCP, {total_forwarded} reaching "
        f"the model -- roughly {total_forwarded // 4} tokens per request."
    )


if __name__ == "__main__":
    if "--tool-budget" in sys.argv:
        asyncio.run(tool_budget())
    else:
        mcp.run(transport="http", host="0.0.0.0", port=8002)
