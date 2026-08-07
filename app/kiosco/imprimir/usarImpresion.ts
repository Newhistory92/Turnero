"use client"

import { useCallback, useRef } from "react"

export type EstadoImpresion = "inactivo" | "imprimiendo" | "listo" | "error"

/**
 * Imprime en un iframe oculto. Reemplaza al window.open() anterior, que abria
 * una ventana, rompia el fullscreen y lo bloqueaba el popup blocker.
 * Con --kiosk-printing de Chrome sale directo a la impresora predeterminada,
 * sin dialogo. El navegador NO informa si falta papel (ver spec 8.6).
 */
export function usarImpresion() {
  const refIframe = useRef<HTMLIFrameElement | null>(null)

  const imprimir = useCallback((html: string, estilos: string) => {
    let iframe = refIframe.current
    if (!iframe) {
      iframe = document.createElement("iframe")
      iframe.setAttribute("aria-hidden", "true")
      iframe.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
      document.body.appendChild(iframe)
      refIframe.current = iframe
    }

    const doc = iframe.contentDocument
    if (!doc) return false

    doc.open()
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>${estilos}</style></head><body>${html}</body></html>`)
    doc.close()

    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      return true
    } catch {
      return false
    }
  }, [])

  return { imprimir }
}
