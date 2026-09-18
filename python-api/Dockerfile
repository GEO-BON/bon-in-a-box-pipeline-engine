ARG TITILER_VERSION=2.0.1

FROM ghcr.io/developmentseed/titiler:${TITILER_VERSION} AS builder

RUN set -ex; \
    apt-get update; \
    apt-get install -y --no-install-recommends libgdal-dev; \
    apt-get clean all; \
    rm -rf /var/lib/apt/lists/*
RUN pip install uv

ENV VIRTUAL_ENV=/opt/venv
RUN uv venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app/

# added python-multipart and clamav-client
RUN uv pip install fastapi "uvicorn[standard]" requests duckdb pandas geopandas pandas_geojson shapely pygadm fiona python-multipart clamav-client

COPY app /app

RUN uv pip install -r /app/requirements.txt

# The chat bridge gets a venv of its own rather than joining the one above.
#
# It pins fastapi~=0.119, uvicorn>=0.38,<0.45 and typer~=0.24, and requirements.txt
# already records what letting an optional feature move this image's dependencies
# costs: a resolver picking mcp 2.x killed the MCP server on import and took the
# tiler, the region API and the file manager down with it. A second venv is a few MB
# and removes the whole class of problem -- nothing the bridge needs can reach titiler
# or main_api, and nothing they need can reach the bridge.
#
# Pinned exactly because bridge/sitecustomize.py patches two of its internals
# (MCPManager.call_tool, ProxyService._proxy_with_tools_streaming). An unpinned bump
# could rename either and quietly cost us the fix.
RUN uv venv /opt/bridge-venv \
 && uv pip install --python /opt/bridge-venv/bin/python ollama-mcp-bridge==0.12.1

FROM ghcr.io/developmentseed/titiler:${TITILER_VERSION} AS runtime

# Set up virtual environment path
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy virtual environment and application code from builder stage
COPY --from=builder $VIRTUAL_ENV $VIRTUAL_ENV
COPY --from=builder /opt/bridge-venv /opt/bridge-venv
COPY --from=builder /app /app
RUN mkdir /app/ddb_home && chmod -R 777 /app/ddb_home
WORKDIR /app

ENV MODULE_NAME=
ENV VARIABLE_NAME=app
ENV HOST=0.0.0.0
ENV PORT=8000
ENV WEB_CONCURRENCY=1
# No CLAMAV_* default on purpose. clamd is a shared service now, not a process in this
# container, and an unset CLAMAV_ADDRESS means "no scanning" -- so a default here would
# silently switch the feature on and point it at nothing. See app/main_api.py.

ARG BIAB_VERSION
RUN echo $BIAB_VERSION > /version.txt

ARG TARGETPLATFORM
RUN echo "Architecture: ${TARGETPLATFORM}" >> /version.txt

ARG TITILER_VERSION
ENV TITILER_VERSION=${TITILER_VERSION}

CMD sh ./startup.sh