"use client"

import { useCallback, useEffect, useState } from "react"
import { io, type Socket } from "socket.io-client"
import type { SnapshotPantalla } from "@/server/snapshotPantalla"

export function usarSocketPantalla(ala: string) {
  const [snapshot, setSnapshot] = useState<SnapshotPantalla | null>(null)
  const [conectado, setConectado] = useState(false)

  const refrescar = useCallback(
    (s: Socket) => {
      s.emit(
        "ENTRAR_PANTALLA",
        { ala },
        (r: { ok: boolean; snapshot?: SnapshotPantalla }) => {
          // Si falla se conserva lo que ya hay. La pantalla nunca se vacia: en
          // un pasillo, una TV en blanco parece rota y una con un dato viejo
          // sigue sirviendo a quien esta esperando.
          if (r?.ok && r.snapshot) setSnapshot(r.snapshot)
        }
      )
    },
    [ala]
  )

  useEffect(() => {
    const s = io()

    s.on("connect", () => {
      setConectado(true)
      refrescar(s)
    })
    s.on("disconnect", () => setConectado(false))

    // Solo estos dos eventos llegan al room del ala. Ante cualquiera de los dos
    // se pide el snapshot completo: una sola proyeccion, sin deltas que se
    // desincronicen del servidor.
    s.on("TURNO_LLAMADO", () => refrescar(s))
    s.on("TURNO_RELLAMADO", () => refrescar(s))

    return () => {
      s.close()
    }
  }, [refrescar])

  return { snapshot, conectado }
}
