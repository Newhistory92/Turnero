# Shell del usuario dedicado del kiosco. Reemplaza a explorer.exe.
# Sin Explorer no hay escritorio ni barra de tareas: no hay a donde minimizar.

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$url    = $env:TURNERO_URL
$idK    = $env:TURNERO_KIOSCO_ID

if (-not $url)  { $url  = "http://servidor:3000/kiosco" }
if (-not $idK)  { $idK  = "kiosco-1" }

$flags = @(
  "--kiosk"
  "--kiosk-printing"
  "--noerrdialogs"
  "--disable-pinch"
  "--overscroll-history-navigation=0"
  "--disable-session-crashed-bubble"
  "--no-first-run"
  "--disable-infobars"
  "--user-data-dir=C:\kiosco\perfil"
  "$url`?id=$idK"
)

while ($true) {
  Start-Process -FilePath $chrome -ArgumentList $flags -Wait
  Start-Sleep -Seconds 2
}
