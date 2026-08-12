"use client"

import type { Socket } from "socket.io-client"

export const INTERVALO_LATIDO_MS = 30_000

export function iniciarLatido(socket: Socket, idKiosco: string, version: string) {
  const enviar = () => socket.emit("LATIDO_KIOSCO", { id: idKiosco, version })
  enviar()
  const i = setInterval(enviar, INTERVALO_LATIDO_MS)
  return () => clearInterval(i)
}

export function idKioscoDesdeUrl(busqueda: string): string {
  return new URLSearchParams(busqueda).get("id") ?? "kiosco-sin-id"
}
