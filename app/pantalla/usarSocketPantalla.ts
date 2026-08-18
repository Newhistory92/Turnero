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

    // Ante cualquiera de estos se pide el snapshot completo: una sola
    // proyeccion, sin deltas que se desincronicen del servidor.
    //
    // Los dos primeros traen un llamado nuevo al tope. Los tres siguientes lo
    // sacan, y por eso tienen que estar: sin ellos la TV se queda llamando a
    // alguien que ya fue atendido. Ninguno de los tres hace sonar la
    // campanilla, porque el eventoId del tope no avanza a uno nuevo.
    for (const evento of [
      "TURNO_LLAMADO",
      "TURNO_RELLAMADO",
      "TURNO_INICIADO",
      "TURNO_AUSENTE",
      "TURNO_DERIVADO",
    ]) {
      s.on(evento, () => refrescar(s))
    }

    return () => {
      s.close()
    }
  }, [refrescar])

  return { snapshot, conectado }
}
