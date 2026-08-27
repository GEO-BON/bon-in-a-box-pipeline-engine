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

# main_api last and in the foreground: it serves /fm-api/, /region/ and the
# assistant's prompt, it is what the UI calls on load, and it is the port the
# Kubernetes readiness probe watches. The container should live exactly as long as
# this does.
exec uvicorn main_api:app --proxy-headers --port 8001 --host 0.0.0.0 --reload
