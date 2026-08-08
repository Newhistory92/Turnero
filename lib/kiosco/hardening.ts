const TECLAS_SUELTAS = new Set(["F5", "F11", "F12"])
const TECLAS_CON_CTRL = new Set(["w", "n", "t", "p", "r"])

export function hardeningActivo(
  ctx: { env: string | undefined; busqueda: string } = {
    env: process.env.NEXT_PUBLIC_KIOSCO_HARDENING,
    busqueda: typeof window === "undefined" ? "" : window.location.search,
  }
): boolean {
  if (ctx.env === "on") return true
  return new URLSearchParams(ctx.busqueda).get("hardening") === "1"
}

export function esTeclaBloqueada(e: { key: string; ctrlKey: boolean }): boolean {
  if (TECLAS_SUELTAS.has(e.key)) return true
  return e.ctrlKey && TECLAS_CON_CTRL.has(e.key.toLowerCase())
}

/** Aplica la capa 4. Devuelve la funcion de limpieza. No hace nada si el flag esta apagado. */
export function aplicarHardening(): () => void {
  if (!hardeningActivo()) return () => {}

  const alTeclear = (e: KeyboardEvent) => {
    if (esTeclaBloqueada(e)) e.preventDefault()
  }
  const alMenuContextual = (e: Event) => e.preventDefault()

  const pedirPantallaCompleta = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  window.addEventListener("keydown", alTeclear, { capture: true })
  window.addEventListener("contextmenu", alMenuContextual)
  window.addEventListener("pointerdown", pedirPantallaCompleta)

  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    navigator.serviceWorker.register("/sw-kiosco.js").catch(() => {})
  }

  return () => {
    window.removeEventListener("keydown", alTeclear, { capture: true })
    window.removeEventListener("contextmenu", alMenuContextual)
    window.removeEventListener("pointerdown", pedirPantallaCompleta)
  }
}
