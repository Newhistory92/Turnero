"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import type { SnapshotOperador } from "@/server/snapshot"

const MS_LATIDO = 60_000

export interface RespuestaComando {
  ok: boolean
  codigo?: string
  mensaje?: string
}

export function usarSocketOperador() {
  const [snapshot, setSnapshot] = useState<SnapshotOperador | null>(null)
  const [conectado, setConectado] = useState(false)
  const [sinSesion, setSinSesion] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  const refrescar = useCallback((s: Socket) => {
    s.emit("ENTRAR_BOX", {}, (r: { ok: boolean; snapshot?: SnapshotOperador }) => {
      if (r.ok && r.snapshot) {
        setSnapshot(r.snapshot)
        setSinSesion(false)
      } else {
        setSinSesion(true)
      }
    })
  }, [])

  useEffect(() => {
    const s = io()
    socketRef.current = s

    s.on("connect", () => {
      setConectado(true)
      refrescar(s)
    })
    s.on("disconnect", () => setConectado(false))

    // Cualquier delta que toque este box: se pide el snapshot de nuevo. Con una
    // cola de decenas de turnos el costo es despreciable, y evita mantener dos
    // copias de la logica de proyeccion (servidor y cliente) que se desincronizan.
    const eventos = [
      "TURNO_GENERADO", "TURNO_LLAMADO", "TURNO_RELLAMADO",
      "TURNO_AUSENTE", "TURNO_INICIADO", "TURNO_FINALIZADO", "TURNO_DERIVADO",
    ]
    for (const e of eventos) s.on(e, () => refrescar(s))

    const latido = setInterval(() => s.emit("LATIDO_OPERADOR"), MS_LATIDO)

    return () => {
      clearInterval(latido)
      s.close()
    }
  }, [refrescar])

  const enviar = useCallback(
    (comando: string, datos: Record<string, unknown>): Promise<RespuestaComando> =>
      new Promise((resolver) => {
        const s = socketRef.current
        if (!s) {
          resolver({ ok: false, mensaje: "Sin conexión" })
          return
        }
        s.emit(comando, datos, (r: RespuestaComando) => {
          if (r?.codigo === "SIN_SESION") setSinSesion(true)
          resolver(r ?? { ok: false, mensaje: "Sin respuesta del servidor" })
        })
      }),
    []
  )

  return { snapshot, conectado, sinSesion, enviar }
}
