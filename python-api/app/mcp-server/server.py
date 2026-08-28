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

# Create an HTTP client for your API
client = httpx.AsyncClient(base_url="http://biab-gateway")

# --- The OpenAPI spec, which IS the toolset ------------------------------------
#
# Every tool this server exposes is generated from this document, so failing to load
# it does not degrade the assistant -- it leaves it with nothing at all.
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


async def drop_unfulfillable_output_schemas():
    """Remove the outputSchema from tools that cannot return structured output.

    FastMCP derives an outputSchema from the 200 response of every operation, including
    the three that respond `text/plain` -- `run`, `savePipeline` and `getSystemStatus`.
    Nothing then produces the structured content that schema advertises, so the client
    rejects the result:

        Output validation error: outputSchema defined but no structured output returned

    The call itself has already happened by then. `run` is the one that matters: the
    pipeline starts, the engine returns its run id, and the assistant is handed an error
    instead -- so it retries, starts a second pipeline, still gets an error, and has no
    run id to report or poll. That is what a chat session looks like when it launches
    two runs of the same pipeline and then loops on "the pipeline is running" without
    ever being able to say which one or fetch a result.

    Dropping the schema lets the run id come back as ordinary text content, which is
    what these endpoints have always returned and all the model needs.
    """
    tools = await mcp.get_tools()
    for name in sorted(non_json_operations(spec)):
        tool = tools.get(name)
        if tool is not None and tool.output_schema is not None:
            tool.output_schema = None
            print(f"[mcp] dropped unfulfillable outputSchema on {name}", file=sys.stderr)


asyncio.run(drop_unfulfillable_output_schemas())

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

API_GUIDE = load_text_file("api-guide.md")
DOCUMENTATION = load_text_file("documentation.md")
ROLE_RAW = load_text_file("assistant-role.md")

@mcp.prompt("geospatial-analyst")
def analyst_persona() -> str:
    return f"""
    {ROLE_RAW}
    API GUIDE:
    {API_GUIDE}
    DOCUMENTATION FOR THE PLATFORM:
    {DOCUMENTATION}
    """

# -------------------------------------------------------------------------
# 3. DOCUMENTATION SEARCH
# -------------------------------------------------------------------------
# The one tool here that is not generated from the OpenAPI spec, because the thing it
# reads is not part of the API. The prompt used to hand the model the docs site's URL
# and stop there, which told it the answer existed somewhere it had no way to reach.
DOCS_INDEX = docs_search.load_index()
print(f"[docs] {len(DOCS_INDEX)} documentation passages indexed", file=sys.stderr)


@mcp.tool()
def search_documentation(query: str, max_results: int = 3) -> str:
    """Search the BON in a Box user and contributor documentation.

    Use this whenever a question is about the platform itself rather than about data:
    what an input type means and how to write a value for it (bboxCRS, country, CRS,
    options, text[], MIME types such as image/tiff;application=geotiff), how to refer
    to a file with a /userdata/ path, how pipelines and scripts differ, how the
    pipeline editor and run history work, or how to install the platform.

    It does NOT describe individual scripts or pipelines. For those, and for what one
    specific input of one specific step means, call getInfo on that step instead.

    Args:
        query: What you want to know, in words. Natural questions work; so do
            keywords. Prefer the platform's own vocabulary ("bboxCRS selector",
            "input types", "userdata folder").
        max_results: How many passages to return, 1-5. Keep it low; each one costs
            context that the rest of the conversation needs.

    Returns:
        The matching documentation passages with the URL of the page each came from,
        or a sentence explaining why there is nothing to return.
    """
    try:
        return DOCS_INDEX.search(query, max_results=max(1, min(5, max_results)))
    except Exception as exc:  # a doc lookup must never be what kills a chat turn
        print(f"[docs] search failed for {query!r}: {exc}", file=sys.stderr)
        return f"The documentation search failed ({exc}). Answer without it."


# -------------------------------------------------------------------------
# 4. RUN DIAGNOSIS
# -------------------------------------------------------------------------
@mcp.tool()
def get_run_report(runId: str, max_log_lines: int = 30) -> str:
    """Report on one run: the inputs it was given, whether it failed, and why.

    Call this whenever a run has failed, whenever the user says a result looks wrong,
    and before offering to run anything again. `getHistory` says a run failed;
    only this says what went wrong, because the step's error message and log are not
    otherwise reachable through the API.

    The inputs come back exactly as `run` accepts them, so a run whose inputs were
    filled in wrongly is corrected by editing the offending value in what this returns
    and submitting the whole object again. Say which input was wrong and what it should
    be, and let the user confirm before you re-run.

    Args:
        runId: The id returned by `run`, or a runId from `getHistory` -- for example
            `BII>BIIChange>7f3a…`.
        max_log_lines: Lines of log to include for each failed step, 1-100.

    Returns:
        The run's inputs, its status, and the error and log tail of any step that
        failed to produce output.
    """
    try:
        return run_report.report(runId, max_log_lines=max(1, min(100, max_log_lines)))
    except ValueError as exc:
        return f"Cannot read that run: {exc}"
    except Exception as exc:
        print(f"[run] report failed for {runId!r}: {exc}", file=sys.stderr)
        return f"Could not read the run's files ({exc})."


# -------------------------------------------------------------------------
# 5. LAUNCHING A RUN
# -------------------------------------------------------------------------
# Replaces the generated `run` tool, whose body parameter is a JSON-encoded string with
# an object for an example and no hint of the key format. See run_step.py.
mcp.remove_tool("run")


@mcp.tool()
async def run_step(stepType: str, descriptionPath: str, inputs: dict | None = None) -> str:
    """Start a pipeline or script. This is the only way to launch a run.

    Call `getInfo` on the step first: its `inputs` block gives both the keys this tool
    takes and what each one means. The keys are `{step id}|{input name}` exactly as
    `getInfo` returns them -- `data>loadFromStac.yml@56|t0`, not `t0` -- along with bare
    `pipeline@NN` keys for the pipeline's own selector inputs. Pass them as an object,
    not as a string.

    Any input you leave out is sent at the example value from the step's description,
    which is what the web form starts from, so supplying only what the user actually
    asked to change is correct and is usually the right thing to do.

    It returns as soon as the engine accepts the run; the run itself takes minutes to
    hours. Report the run id and the links, then stop.

    Args:
        stepType: "pipeline" or "script". Prefer pipelines: scripts are pieces of one
            and usually need inputs produced by an earlier step.
        descriptionPath: The step's path as `getListOf` gives it, e.g. `BII>BII.json`.
        inputs: The inputs to set, as an object keyed by full input key. Omit it to run
            entirely on the step's own examples.

    Returns:
        The run id and the links to follow it, or -- if an input key is wrong -- the
        list of keys this step actually accepts.
    """
    try:
        info = await client.get(f"/{stepType}/{descriptionPath}/info")
        info.raise_for_status()
        declared = (info.json() or {}).get("inputs") or {}
    except Exception as exc:
        print(f"[run] could not describe {descriptionPath!r}: {exc}", file=sys.stderr)
        return (
            f"Could not read the description of {descriptionPath!r} ({exc}). Check the "
            "path with `getListOf` before running it."
        )

    if not declared:
        return (
            f"{descriptionPath!r} declares no inputs, which usually means the path is "
            "wrong. Check it with `getListOf`."
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


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=8002)