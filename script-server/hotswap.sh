
# Hotswap broke with Java 26. Falling back on container restart for now.
cd .. && ./dev-server.sh restart script-server && cd -
#docker exec -it biab-script-server sh -c "cd /home/gradle/project/ && gradle assemble"


# optional
# Since Auto-reload detects changes in output files, we can enable automatic project rebuilding.
# To do this, execute the following command in a repository's root directory:
#./gradlew -t :autoreload-engine-main:build
