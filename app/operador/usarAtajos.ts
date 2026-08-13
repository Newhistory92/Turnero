"use client"

import { useEffect } from "react"

export type EstadoPanel = "sin-turno" | "llamado" | "atendiendo"
export type Accion = "llamar" | "iniciar" | "finalizar" | "rellamar" | "ausente" | "derivar"

/**
 * Enter recorre el camino feliz completo: llamar -> iniciar -> finalizar.
 * Ausente y derivar quedan fuera de Enter a proposito: no se pueden deshacer y
 * un Enter de mas no debe dispararlas.
 */
export function accionDeTecla(tecla: string, estado: EstadoPanel): Accion | null {
  if (tecla === "Enter") {
    if (estado === "sin-turno") return "llamar"
    if (estado === "llamado") return "iniciar"
    return "finalizar"
  }

  if (estado !== "llamado") return null

  switch (tecla.toLowerCase()) {
    case "r": return "rellamar"
    case "a": return "ausente"
    case "d": return "derivar"
    default: return null
  }
}

function escribiendo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false
  return (
    destino.tagName === "INPUT" ||
    destino.tagName === "TEXTAREA" ||
    destino.tagName === "SELECT" ||
    destino.isContentEditable
  )
}

export function usarAtajos(
  estado: EstadoPanel,
  activo: boolean,
  alAccionar: (accion: Accion) => void
): void {
  useEffect(() => {
    if (!activo) return

    const alApretar = (e: KeyboardEvent) => {
      // Los atajos no pisan a alguien tipeando en el buscador de derivacion.
      if (escribiendo(e.target) || e.ctrlKey || e.altKey || e.metaKey) return

      const accion = accionDeTecla(e.key, estado)
      if (accion) {
        e.preventDefault()
        alAccionar(accion)
      }
    }

    window.addEventListener("keydown", alApretar)
    return () => window.removeEventListener("keydown", alApretar)
  }, [estado, activo, alAccionar])
}
