#!/bin/bash

docker compose -f .server/compose.yml -f .server/compose.prod.yml -f compose.env.yml down