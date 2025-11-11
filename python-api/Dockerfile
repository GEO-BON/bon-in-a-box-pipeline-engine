
FROM ghcr.io/developmentseed/titiler:0.18.9 AS builder

RUN apt update
RUN apt install -y libgdal-dev
RUN pip install uv

ENV VIRTUAL_ENV=/opt/venv
RUN uv venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app/

RUN uv pip install fastapi "uvicorn[standard]" requests duckdb pandas geopandas pandas_geojson shapely pygadm

COPY . .

FROM ghcr.io/developmentseed/titiler:0.18.9 AS runtime

# Set up virtual environment path
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy virtual environment and application code from builder stage
COPY --from=builder $VIRTUAL_ENV $VIRTUAL_ENV
COPY --from=builder /app /app
WORKDIR /app

CMD uvicorn main:app --proxy-headers --port 8001 --host 0.0.0.0
