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

uvicorn main_api:app --proxy-headers --port 8001 --host 0.0.0.0 --reload &
gunicorn -k uvicorn.workers.UvicornWorker titiler.application.main:app --bind 0.0.0.0:8000 --workers 1
