# Use this script to run your docker commands on the server more easily.
# Most probably, you will need
# `./dev-server.sh pull` to pull the docker compose images
# `./dev-server.sh build` to build the UI and script-server images
# `./dev-server.sh up -d` to start the development server
# `./dev-server.sh down` to stop the development server (if started without -d option)

docker compose -f compose.yml -f compose.dev.yml -f pipeline-repo/compose.env.yml --env-file .dev-paths.env $@