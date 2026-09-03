#!/bin/bash

# ClamAV runs here rather than in its own container. Signatures live in the clamav_data
# volume mounted at /var/lib/clamav; a cold volume means a ~350MB download, so the whole
# bootstrap is backgrounded to avoid holding up titiler.
(
  if ! ls /var/lib/clamav/*.c[vl]d >/dev/null 2>&1; then
    echo "[clamav] no signature database yet, downloading..."
    freshclam --stdout
  fi
  clamd &
  freshclam --stdout --daemon
) &

gunicorn -k uvicorn.workers.UvicornWorker titiler.application.main:app --bind 0.0.0.0:8000 --workers 1 &

# The MCP server backs the chat assistant only. It is backgrounded, and its death is
# logged rather than fatal, because it used to be this script's foreground process:
# when a dependency skew made it fail on import, the container exited and took the
# tiler, the region API and the file manager down with it -- core functionality for
# every user, lost to an optional feature. It is also the component most exposed to
# that kind of breakage, since it builds its tools from the OpenAPI spec at startup.
#
# A dead assistant surfaces as 502s on /llm/ and a loud line in these logs. Check
# here first if the chat stops answering while the rest of the platform is fine.
(
  MCP_PORT=8002 python /app/mcp-server/server.py
  echo "[mcp] server exited ($?) -- the chat assistant is DOWN; the rest of python-api is unaffected" >&2
) &

# The chat bridge: Ollama's own API on 8003, with MCP tool calls executed against the
# server above in between rounds. It used to be a container (and, per session, a pod)
# of its own; it lives here because it is an HTTP client with no model and no GPU, and
# a whole pod per session to hold one was not worth it.
#
# Three things keep that consolidation honest, and all three matter:
#
#   - Its own venv (/opt/bridge-venv), so its dependency pins cannot move python-api's.
#   - Backgrounded with its death logged, exactly like the MCP server above: the
#     upstream bridge calls exit(1) when it cannot reach Ollama, and that must cost
#     the chat only, never the tiler or the file manager.
#   - main_api on 8001 stays the foreground process and the readiness probe's target,
#     so a bridge that never starts cannot hold a session on the waiting page. That
#     property used to come from putting the bridge in its own Sablier group.
#
# No OLLAMA_URL means no assistant at all, rather than one that fails on every message.
if [ -n "$OLLAMA_URL" ]; then
  (
    # The bridge connects to its MCP servers once, at startup, and gives up if they
    # are not there. In separate containers depends_on/service_healthy covered this;
    # in one container it is ours to wait for.
    #
    # curl, not bash's /dev/tcp: the Dockerfile runs this with `sh ./startup.sh`, so
    # the bash shebang above is not what interprets it and bash-isms silently fail.
    # Same call the compose healthcheck makes -- no -f, because a bare GET to the MCP
    # endpoint answers 406 and connecting at all is the whole question.
    tries=0
    until curl -s -o /dev/null http://127.0.0.1:8002/mcp; do
      tries=$((tries + 1))
      if [ "$tries" -ge 120 ]; then
        echo "[bridge] MCP server never came up on 8002 -- not starting the chat bridge" >&2
        exit 1
      fi
      sleep 1
    done

    # PYTHONPATH only for this process: `site` imports bridge/sitecustomize.py at
    # interpreter startup, which is what keeps a mid-turn failure from reaching the
    # user as "Error in input stream". See that file.
    PYTHONPATH=/app/bridge /opt/bridge-venv/bin/ollama-mcp-bridge \
      --config /app/bridge/mcp-servers.json \
      --ollama-url "$OLLAMA_URL" \
      --host 0.0.0.0 \
      --port 8003
    echo "[bridge] exited ($?) -- the chat assistant is DOWN; the rest of python-api is unaffected" >&2
  ) &
fi

# main_api last and in the foreground: it serves /fm-api/, /region/ and the
# assistant's prompt, it is what the UI calls on load, and it is the port the
# Kubernetes readiness probe watches. The container should live exactly as long as
# this does.
exec uvicorn main_api:app --proxy-headers --port 8001 --host 0.0.0.0 --reload
