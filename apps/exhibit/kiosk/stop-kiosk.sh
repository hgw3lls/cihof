#!/bin/sh
# Stops the exhibit and its browser, and leaves them stopped.
cd "$(dirname "$0")" || exit 1
exec node launch.mjs --stop
