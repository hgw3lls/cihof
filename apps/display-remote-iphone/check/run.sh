#!/bin/sh
# Builds the iPhone remote's own code (Auth, Display, Describe) for this Mac, optimised as a
# release build is, and checks it against the display's code: npm run test:display-remote-iphone.
set -e
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../.." && pwd)
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
swiftc -O -o "$out/check" \
  "$here/../CIHOFRemote/Auth.swift" "$here/../CIHOFRemote/Display.swift" "$here/../CIHOFRemote/Describe.swift" \
  "$here/main.swift"
"$out/check" "$root"
