#!/usr/bin/env bash

set -e

usage() {
  echo "Usage: $0 -m \"commit message\""
  exit 1
}

# Parse options
while getopts ":m:" opt; do
  case $opt in
    m)
      COMMIT_MSG="$OPTARG"
      ;;
    *)
      usage
      ;;
  esac
done

# Require commit message
if [ -z "$COMMIT_MSG" ]; then
  usage
fi

git add .
git commit -m "$COMMIT_MSG"
git push

