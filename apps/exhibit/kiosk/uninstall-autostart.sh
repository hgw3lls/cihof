#!/bin/sh
# Stops the exhibit starting automatically.
case "$(uname -s)" in
  Darwin)
    plist="$HOME/Library/LaunchAgents/org.cihof.exhibit.plist"
    launchctl unload "$plist" 2>/dev/null
    rm -f "$plist"
    ;;
  *)
    rm -f "${XDG_CONFIG_HOME:-$HOME/.config}/autostart/cihof-exhibit.desktop"
    ;;
esac
echo "The exhibit will no longer start automatically."
