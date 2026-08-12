import type { Server as IoServer, Socket } from "socket.io"
import { generarTurno } from "./handlers/generarTurno"
import { llamarTurno } from "./handlers/llamarTurno"
import { destinatarios, TODOS, type EventoTurnero } from "./rooms"
import { obtenerCatalogo } from "@/lib/catalogo"

async function contextoDe(tramiteId: string, boxId: string | null) {
  const catalogo = await obtenerCatalogo()
  const tramite = catalogo.tramites.find((t) => t.id === tramiteId)
  return {
    ala: tramite?.destino.ala ?? "",
    piso: tramite?.destino.piso ?? "",
    boxId,
    tramiteBoxIds: tramite?.boxes.map((b) => b.id) ?? [],
  }
}

async function emitir(
  io: IoServer,
  evento: EventoTurnero,
  datos: unknown,
  tramiteId: string,
  boxId: string | null
) {
  const rooms = destinatarios(evento, await contextoDe(tramiteId, boxId))
  if (rooms.includes(TODOS)) {
    io.emit(evento, datos)
    return
  }
  for (const room of rooms) io.to(room).emit(evento, datos)
}

export function montarTurnero(io: IoServer): void {
  io.on("connection", (socket: Socket) => {
    socket.on("SUSCRIBIR", ({ room }: { room: string }, ack?: () => void) => {
      socket.join(room)
      ack?.()
    })

    socket.on("GENERAR_TURNO", async (cmd, ack?: (r: unknown) => void) => {
      const r = await generarTurno(cmd)
      ack?.(r)
      if (r.ok) await emitir(io, "TURNO_GENERADO", { turno: r.turno }, r.turno.tramiteId, null)
    })

    socket.on("LLAMAR_TURNO", async (cmd, ack?: (r: unknown) => void) => {
      const r = await llamarTurno(cmd)
      ack?.(r)
      if (r.ok) {
        await emitir(io, "TURNO_LLAMADO", { turno: r.turno }, r.turno.tramiteId, r.turno.boxId)
      }
    })
  })
}
