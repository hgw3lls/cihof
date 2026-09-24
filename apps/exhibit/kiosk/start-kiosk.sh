#!/bin/sh
# Starts the exhibit: its local server and a full-screen browser.
# Leave this running. ./stop-kiosk.sh ends it.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 is not installed. Install it from https://nodejs.org and start again."
  exit 1
fi
while :; do
  node launch.mjs "$@" && exit 0
  echo "The exhibit stopped unexpectedly. Starting it again in 5 seconds..."
  sleep 5
done
