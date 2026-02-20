import os
import uvicorn
import sys
import requests
from contextlib import contextmanager
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

# -------------------------------------------------------------------------
# 1. INITIALIZATION
# -------------------------------------------------------------------------
mcp = FastMCP(
    "BON in a Box MCP Server (Strict Mode)",
    stateless_http=True,
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False)
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

# -------------------------------------------------------------------------
# 3. CONTEXT INJECTION (PROMPT ENGINEERING)
# -------------------------------------------------------------------------
# We frame this as a "Strict Syntax Guide" rather than just "Context".
# This forces the model to abandon its training on standard "SELECT * FROM table".
TOOL_INJECTED_CONTEXT = f"""
---
### ⚠️ CRITICAL RULES (MUST FOLLOW)
1. **ALWAYS USE THE API:** You MUST use the API for ALL queries.


### 📂 API GUIDE (Source of Truth)
{API_GUIDE}

### ⚡ DOCUMENTATION FOR THE PLATFORM
{DOCUMENTATION}

---
"""

# -------------------------------------------------------------------------
# 5. MCP RESOURCES (BON in a Box Scripts & Pipelines)
# -------------------------------------------------------------------------
BON_IN_A_BOX_API_BASE = os.getenv("BON_IN_A_BOX_API_BASE", "http://biab-script-server:8080")
MAX_TOOL_OUTPUT_CHARS = int(os.getenv("MAX_TOOL_OUTPUT_CHARS", "8000"))


def truncate_output(value: object) -> str:
    """Ensure tool outputs are strings and cap length to avoid oversized prompts."""
    if isinstance(value, str):
        text = value
    else:
        try:
            text = str(value)
        except Exception:
            text = ""
    if MAX_TOOL_OUTPUT_CHARS > 0 and len(text) > MAX_TOOL_OUTPUT_CHARS:
        return text[:MAX_TOOL_OUTPUT_CHARS] + "\n...<truncated>"
    return text

# -------------------------------------------------------------------------
# 4. UTILS & HELPERS
# -------------------------------------------------------------------------


def fetch_step_list(step_type: str) -> dict:
    """ Get the list of available scripts or pipelines from the BON in a Box API. Returns a dict of {path: name}.`    
    `resource_type` should be "script" or "pipeline". """
    base = BON_IN_A_BOX_API_BASE.rstrip("/")
    url = f"{base}/{step_type}/list"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, dict) else {}
    except Exception as exc:
        print(
            f"⚠️ Warning: Could not fetch {step_type} list from {url}: {exc}",
            file=sys.stderr,
        )
        return {}

def format_step_list(title: str, steps: dict) -> str:
    if not steps:
        return f"{title}:\n(no items found)"
    lines = [f"{title}:"]
    for path, name in sorted(steps.items()):
        label = name or path
        lines.append(f"- {label} ({path})")
    return "\n".join(lines)

#@mcp.resource("bon://scripts")
@mcp.tool()
def list_scripts() -> str:
    """
    List all available scripts on the BON in a Box platform.
    
    :return: Description
    :rtype: str
    """
    return format_step_list("Scripts", fetch_step_list("script"))

#@mcp.resource("bon://pipelines")
@mcp.tool()
def list_pipelines() -> str:
    """
    List all available pipelines on the BON in a Box platform.
    
    :return: Description
    :rtype: str
    """
    return format_step_list("Pipelines", fetch_step_list("pipeline"))

#@mcp.resource("bon://list")
@mcp.tool()
def list_scripts_and_pipelines() -> str:
    """
    List all available scripts and pipelines on the BON in a Box platform. 
    This resource is intended to provide a comprehensive overview of the tools at your disposal. 
    Always check this list before attempting to execute any operations, as it contains the most up-to-date information about what is available on the platform.
    
    :return: Description
    :rtype: str
    """
    scripts = format_step_list("Scripts", fetch_step_list("script"))
    pipelines = format_step_list("Pipelines", fetch_step_list("pipeline"))
    return f"{scripts}\n\n{pipelines}"


#@mcp.resource("bon://pipeline-info/{step_type}/{description_path}")
@mcp.tool()
def pipeline_info(step_type: str, description_path: str) -> str:
    """
    Get detailed information about a specific pipeline, including required input parameters. 
    This resource is essential for understanding how to properly execute a pipeline and what inputs are necessary. 
    Always refer to this information before attempting to run a pipeline to ensure you have the correct parameters and understand the expected outputs.
    
    :param type: The type of resource, either "script" or "pipeline".
    :param description_path: The path to the resource's description file, which provides details about the resource.

    :return: Description
    :rtype: str
    """
    base = BON_IN_A_BOX_API_BASE.rstrip("/")
    url = f"{base}/{step_type}/{description_path}/info"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, dict) else {}
    except Exception as exc:
        print(
            f"⚠️ Warning: Could not fetch {step_type}: {description_path} info from {url}: {exc}",
            file=sys.stderr,
        )
        return {}
    
#@mcp.resource("bon://openapi-docs") 
@mcp.tool()
def swagger_api_docs() -> str:
    """Fetch the OpenPI YAML from the BON in a Box API. 
    This can be useful for understanding the available endpoints and their expected inputs/outputs."""
    base = BON_IN_A_BOX_API_BASE.rstrip("/")
    url = "http://swagger_ui:8080/swagger/openapi.yaml"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.text
    except Exception as exc:
        print(
            f"⚠️ Warning: Could not fetch Swagger API docs from {url}: {exc}",
            file=sys.stderr,
        )
        return "Error fetching API documentation."



# -------------------------------------------------------------------------
# 6. MCP PROMPTS (Personas for Smart Clients)
# -------------------------------------------------------------------------
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
# 7. TOOL DEFINITION & MANUAL REGISTRATION
# -------------------------------------------------------------------------

def get_step_info(step_type: str, description_path: str) -> str:
    """Get detailed information about a script or pipeline, including required input parameters.

    Args:
        step_type: The type of step ('script' or 'pipeline')
        description_path: The path to the step's description file
    """
    base = BON_IN_A_BOX_API_BASE.rstrip("/")
    url = f"{base}/{step_type}/{description_path}/info"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        payload = response.json()
        return truncate_output(payload)
    except Exception as exc:
        return truncate_output(f"Error fetching info for {step_type} at {url}: {str(exc)}")

def execute_step(step_type: str, description_path: str, input_params: dict) -> str:
    """Execute a BON in a Box step or pipeline.
    
    Args:
        step_type: The type of step (e.g., 'script' or 'pipeline')
        description_path: The path to the step's description file
        input_params: JSON object containing input parameters for the step
    
    Returns:
        JSON response from the BON in a Box API containing execution results
    """
    print(f"🔍 Executing {step_type}: {description_path}", file=sys.stderr)
    base = BON_IN_A_BOX_API_BASE.rstrip("/")
    url = f"{base}/{step_type}/{description_path}/run"
    try:
        response = requests.post(url, json=input_params, timeout=10)
        response.raise_for_status()
        payload = response.json()
        return truncate_output(payload)
    except Exception as exc:
        error_msg = f"Error executing {step_type} at {url}: {str(exc)}"
        print(f"⚠️ {error_msg}", file=sys.stderr)
        return truncate_output(error_msg)

execute_step.__doc__ = f"""
Executes queries on the BON in a Box platform through its API. 
STRICTLY FOLLOW THE RULES BELOW.

{TOOL_INJECTED_CONTEXT}
"""

# ®️ REGISTER: Manually register the tool
mcp.tool()(execute_step)

# -------------------------------------------------------------------------
# 8. SERVER START
# -------------------------------------------------------------------------
if __name__ == "__main__":
    # Get the ASGI app from FastMCP
    app = mcp.streamable_http_app()
    
    print("🚀 Starting BON in a Box MCP Server (Strict Mode)...", file=sys.stderr)
    print("📡 MCP Protocol: Stateless HTTP with SSE support", file=sys.stderr)
    print("🌐 Listening on http://0.0.0.0:8002", file=sys.stderr)
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8002,
        proxy_headers=True,
        forwarded_allow_ips="*",
        log_level="info"
    )