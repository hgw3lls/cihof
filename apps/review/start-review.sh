#!/bin/sh
# Opens the CIHOF staff review app. Leave this running while you review.
cd "$(dirname "$0")/../.." || exit 1
exec npm run review
