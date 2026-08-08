#Requires -RunAsAdministrator
param(
  [Parameter(Mandatory)][string]$UrlTurnero,
  [Parameter(Mandatory)][string]$IdKiosco,
  [string]$Usuario = "kiosco",
  [Parameter(Mandatory)][securestring]$Clave
)

Write-Host "1/5 Creando el usuario dedicado..."
if (-not (Get-LocalUser -Name $Usuario -ErrorAction SilentlyContinue)) {
  New-LocalUser -Name $Usuario -Password $Clave -PasswordNeverExpires -AccountNeverExpires
  Add-LocalGroupMember -Group "Users" -Member $Usuario
}

Write-Host "2/5 Copiando el shell..."
New-Item -ItemType Directory -Force "C:\kiosco" | Out-Null
Copy-Item "$PSScriptRoot\shell-kiosco.ps1" "C:\kiosco\shell-kiosco.ps1" -Force

Write-Host "3/5 Configurando el shell del usuario..."
$sid = (Get-LocalUser -Name $Usuario).SID.Value
$claveShell = "Registry::HKEY_USERS\$sid\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
New-Item -Path $claveShell -Force | Out-Null
Set-ItemProperty -Path $claveShell -Name "Shell" `
  -Value "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\kiosco\shell-kiosco.ps1"

Write-Host "4/5 Variables de entorno del kiosco..."
[Environment]::SetEnvironmentVariable("TURNERO_URL", $UrlTurnero, "Machine")
[Environment]::SetEnvironmentVariable("TURNERO_KIOSCO_ID", $IdKiosco, "Machine")

Write-Host "5/5 Deshabilitando el administrador de tareas..."
$claveSistema = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
New-Item -Path $claveSistema -Force | Out-Null
Set-ItemProperty -Path $claveSistema -Name "DisableTaskMgr" -Value 1 -Type DWord

Write-Host ""
Write-Host "Listo. Falta a mano:"
Write-Host "  - Editar politicas-chrome.reg con la URL real e importarlo"
Write-Host "  - Configurar el inicio de sesion automatico del usuario '$Usuario'"
Write-Host "  - Poner la impresora termica como predeterminada de ese usuario"
Write-Host "  - Reiniciar"
