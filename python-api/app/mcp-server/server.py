import httpx
from fastmcp import FastMCP
import yaml
import json
import os
import sys

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

if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=8002)