
ARG TITILER_VERSION=0.18.9

FROM ghcr.io/developmentseed/titiler:${TITILER_VERSION} AS builder

RUN apt update
RUN apt install -y libgdal-dev
RUN pip install uv

ENV VIRTUAL_ENV=/opt/venv
RUN uv venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app/

RUN uv pip install fastapi "uvicorn[standard]" requests duckdb pandas geopandas pandas_geojson shapely pygadm fiona

COPY . .

FROM ghcr.io/developmentseed/titiler:${TITILER_VERSION} AS runtime

# Set up virtual environment path
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy virtual environment and application code from builder stage
COPY --from=builder $VIRTUAL_ENV $VIRTUAL_ENV
COPY --from=builder /app /app
WORKDIR /app

ENV MODULE_NAME=
ENV VARIABLE_NAME=app
ENV HOST=0.0.0.0
ENV PORT=8000
ENV WEB_CONCURRENCY=1

ARG BIAB_VERSION
RUN echo $BIAB_VERSION "($(date +'%Y-%m-%d %R'))" > /version.txt

CMD sh ./startup.sh