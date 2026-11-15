; Windows Firewall: let the staff connection in (apps/kiosk-app/src/connection.mjs).
;
; It listens only while staff have it open in the admin panel, and refuses
; anything not signed with the pairing code it shows, but Windows still has to
; let the request through, on the museum network or on the display's own Wi-Fi
; hotspot (which Windows counts as a public network). In kiosk mode nobody
; would see Windows' own "allow this app?" prompt, so the installer, which runs
; as an administrator, allows this one app on this one port, and the
; uninstaller takes the rule away again.

!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="CIHOF Exhibit staff connection"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="CIHOF Exhibit staff connection" dir=in action=allow protocol=TCP localport=5190 profile=any program="$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
!macroend

!macro customUnInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="CIHOF Exhibit staff connection"'
!macroend
