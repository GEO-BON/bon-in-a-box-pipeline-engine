#!/bin/bash

uvicorn main_api:app --proxy-headers --port 8001 --host 0.0.0.0 --reload &
gunicorn -k uvicorn.workers.UvicornWorker titiler.application.main:app --bind 0.0.0.0:8000 --workers 1 &
MCP_PORT=8002 python /app/mcp-server/server.py
