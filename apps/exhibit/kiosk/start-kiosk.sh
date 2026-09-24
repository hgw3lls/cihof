#!/bin/sh
# Starts the exhibit's local server. Keep this window open while the exhibit runs.
# Then open http://localhost:8080/ in the display browser (see README.txt).
cd "$(dirname "$0")" || exit 1
exec node server.mjs "$@"
