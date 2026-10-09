# BON in a Box MCP server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives the
chat assistant access to this instance's pipelines, scripts, runs and documentation.

It runs inside the python-api container, started in the background by `app/startup.sh`,
and serves streamable HTTP on port 8002. `ollama-mcp-bridge` connects to it at
`http://127.0.0.1:8002/mcp` (see `app/bridge/mcp-servers.json`) and executes its tools
between rounds of inference.

```bash
python server.py                 # serve on :8002
python server.py --tool-budget   # what the toolset costs per request
```

## The context budget is the design

The bridge sends every registered tool's schema and the whole system prompt on **every
request**, and it makes one request per tool-call round. The model is given a 16k window
to hold all of that plus the conversation and every tool result in the turn. So the
resident context is kept deliberately small, in two ways.

**A small toolset.** `GENERATED_TOOLS_KEPT` in `server.py` is an allowlist: of the 27
operations in the OpenAPI spec, five are registered. The file manager and the cluster
endpoints answer none of the questions the assistant handles, and were costing most of
the schema budget to sit unused. The web UI still exposes all of them.

**A mode gate.** The system prompt (`assistant-role.md`, served to the UI by
`/assistant/prompt`) is only a routing table. The procedure for one kind of question
lives in `modes/` and reaches the model as the result of its `start_task` call, so a
conversation carries the one procedure it needs rather than all five. Nothing persists
between turns — the UI resends only user and assistant text, so each turn gates again.

## Tools

Generated from `script-server/api/openapi.yaml`:

| tool | for |
|---|---|
| `getHistory` | which runs exist, and their run ids |
| `getCountriesList` | ISO3 codes. Long; the playbook says to avoid it |
| `getRegionsList` | adm1 codes for one country's regions |
| `getCountryRegionBbox` | the selector object a `bboxCRS` input takes |

Hand-written, because what they read is not in the API or because the generated version
was unusable:

| tool | why not generated |
|---|---|
| `start_task` | the mode gate; returns one file from `modes/` |
| `get_info` | replaces the generated `getInfo`, which the model called as `get_info` — the majority convention here — and the bridge answered `Tool not found` mid-stream. Its spec schema also forbids the `example: null` every pipeline declares |
| `find_step` | `getListOf` returns 99 bare names, so a caller has to guess a path from a name. `step_search.py` ranks name, path and description with BM25 |
| `search_documentation` | the Quarto docs index is not part of the API. `docs_search.py` |
| `get_run_report` | a step's error and log are only on disk, not in the API. `run_report.py` |
| `run_step` | replaces `run`, whose body is a `text/plain` string that is really JSON, with no hint that keys are `{step id}\|{input name}`. `run_step.py` |

## Files

| | |
|---|---|
| `server.py` | the toolset: what is registered, what is pruned, what is hand-written |
| `assistant-role.md` | the routing table, and the whole system prompt |
| `modes/*.md` | one procedure per kind of question, returned by `start_task` |
| `bm25.py` | ranking, shared by the two searches |
| `docs_search.py`, `step_search.py` | the two corpora |
| `run_step.py`, `run_report.py` | launching a run, and reading a failed one |
| `openapi.yaml` | copied from `script-server/api/` by the build; bind-mounted in dev |
| `docs-search.json` | copied from `docs/search.json` by the build; bind-mounted in dev |

The last two are staged into the image rather than fetched at startup, and both are
untracked here. `docs_search.py` and `step_search.py` are runnable on their own:

```bash
python docs_search.py "what does bboxCRS mean"
BIAB_API_BASE=http://localhost python step_search.py "species distribution"
```

## License

MIT License — See repository for details
