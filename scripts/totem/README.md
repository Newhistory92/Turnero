# Instalación del tótem

Scripts de las capas 1 a 3 del hardening (§8/§10 del spec). Se ejecutan **una vez, en cada
tótem físico** — nada de esto corre en la máquina de desarrollo.

## Requisitos previos

- Windows con Chrome instalado en la ruta por defecto (`C:\Program Files\Google\Chrome\Application\chrome.exe`).
- PowerShell con permisos de administrador.
- Host y puerto reales del servidor Turnero (pendiente externo §12.6 del spec — hoy los
  scripts traen `servidor:3000` como placeholder).
- Impresora térmica ya instalada como dispositivo de Windows.

## Orden de ejecución

1. **Editar `politicas-chrome.reg`**: reemplazar toda ocurrencia de `servidor:3000` por el
   host y puerto reales. Si `URLAllowlist` no coincide con la URL real, el kiosco no carga nada.
2. **Importar `politicas-chrome.reg`** (doble clic o `reg import politicas-chrome.reg`) — aplica
   la capa 2 (políticas de Chrome: sin DevTools, sin incógnito, sin gestor de contraseñas, URL
   restringida a la allowlist).
3. **Correr `instalar-kiosco.ps1`** como administrador:

   ```powershell
   .\instalar-kiosco.ps1 -UrlTurnero "http://<host>:<puerto>/kiosco" -IdKiosco "kiosco-1" -Clave (Read-Host -AsSecureString)
   ```

   Crea el usuario dedicado `kiosco`, copia `shell-kiosco.ps1` a `C:\kiosco\`, lo configura como
   shell de ese usuario (reemplaza a `explorer.exe` — capa 1: sin escritorio ni barra de tareas
   no hay a dónde minimizar), fija las variables de entorno `TURNERO_URL`/`TURNERO_KIOSCO_ID`, y
   deshabilita el Administrador de tareas (capa 3).

4. **A mano, después del script** (no se automatiza a propósito):
   - Configurar el inicio de sesión automático del usuario `kiosco`. Automatizarlo implicaría
     guardar una contraseña en el registro; lo hace una persona, con criterio.
   - Poner la impresora térmica como predeterminada de ese usuario.
   - Reiniciar.

## Cómo revertir

1. Restaurar el shell original del usuario `kiosco`:
   ```powershell
   Set-ItemProperty -Path "Registry::HKEY_USERS\<SID>\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" -Name "Shell" -Value "explorer.exe"
   ```
2. Revertir `politicas-chrome.reg` borrando las claves bajo
   `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome`.
3. Reactivar el Administrador de tareas:
   ```powershell
   Remove-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System" -Name "DisableTaskMgr"
   ```
4. Borrar `C:\kiosco` y el usuario dedicado si ya no se necesita.

## Verificación manual (no automatizable) — spec §10.5

**Impresión, con la térmica física:**
- El ticket sale sin diálogo ni ventana.
- Entra en 80mm sin cortar el ala.
- La hora impresa coincide con la del servidor.
- Es legible a un metro de distancia.
- Si se acaba el papel, el turno igual quedó registrado en la base.

**Hardening, en el tótem con el flag en `on`:**
- `Alt+F4` y `Ctrl+W` no cierran nada.
- Matando el proceso de Chrome, vuelve a abrirse en ~2 segundos.
- No hay barra de tareas ni escritorio detrás de la ventana de Chrome.
- Tras un corte de luz, arranca directo en el kiosco, sin cartel de "sesión interrumpida".
- Escribir otra URL en la barra de direcciones no lleva a ningún lado fuera de la allowlist.
- El latido del kiosco aparece en verde en el panel (Tarea 10).

Ninguna etapa se declara terminada sin la salida del comando pegada
(`superpowers:verification-before-completion`, spec §10.6).
