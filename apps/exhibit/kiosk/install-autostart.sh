#!/bin/sh
# Starts the exhibit automatically when this account signs in.
# macOS: a LaunchAgent. Linux: a desktop autostart entry.
here="$(cd "$(dirname "$0")" && pwd)"
case "$(uname -s)" in
  Darwin)
    plist="$HOME/Library/LaunchAgents/org.cihof.exhibit.plist"
    mkdir -p "$(dirname "$plist")"
    cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>org.cihof.exhibit</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>$here/start-kiosk.sh</string></array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
PLIST
    launchctl unload "$plist" 2>/dev/null
    launchctl load "$plist"
    echo "The exhibit will start when this account signs in."
    echo "Set Energy Saver / Lock Screen to never turn off the display."
    ;;
  *)
    entry="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/cihof-exhibit.desktop"
    mkdir -p "$(dirname "$entry")"
    cat > "$entry" <<DESKTOP
[Desktop Entry]
Type=Application
Name=CIHOF Exhibit
Exec="$here/start-kiosk.sh"
X-GNOME-Autostart-enabled=true
DESKTOP
    echo "The exhibit will start when this account signs in."
    echo "Turn off screen blanking and suspend in the system settings."
    ;;
esac
