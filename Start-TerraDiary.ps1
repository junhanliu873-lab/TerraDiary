$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$port = 8000
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
try {
  $listener.Start()
  $listener.Stop()
} catch {
  Write-Host "Port $port is already in use. Stop the existing server or edit this script to choose another port." -ForegroundColor Yellow
  exit 1
}
Write-Host "TerraDiary is available at http://localhost:$port/" -ForegroundColor Green
Write-Host 'Keep this window open while using the site. Press Ctrl+C to stop.'
if (Get-Command python -ErrorAction SilentlyContinue) {
  python -m http.server $port --bind 127.0.0.1
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  py -3 -m http.server $port --bind 127.0.0.1
} else {
  $bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
  if (Test-Path -LiteralPath $bundledPython) { & $bundledPython -m http.server $port --bind 127.0.0.1 }
  else { Write-Host 'Python is required. Install Python, then run this script again.' -ForegroundColor Red }
}
