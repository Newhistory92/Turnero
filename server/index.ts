import type { Server as IoServer, Socket } from "socket.io"
import { parseCookie } from "cookie"
import { generarTurno } from "./handlers/generarTurno"
import { llamarTurno } from "./handlers/llamarTurno"
import { rellamarTurno } from "./handlers/rellamarTurno"
import { marcarAusente } from "./handlers/marcarAusente"
import { iniciarAtencion } from "./handlers/iniciarAtencion"
import { finalizarAtencion } from "./handlers/finalizarAtencion"
import { derivarTurno } from "./handlers/derivarTurno"
import { registrarLatido } from "./handlers/latido"
import { destinatarios, roomAla, roomBox, TODOS, type EventoTurnero } from "./rooms"
import { obtenerCatalogo } from "@/lib/catalogo"
import { leerCookie, NOMBRE_COOKIE, sesionActiva, renovarLatido } from "@/lib/auth/sesion"
import { armarSnapshot } from "./snapshot"
import { armarSnapshotPantalla } from "./snapshotPantalla"

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

/** El socket saca la sesion de la misma cookie que el HTTP. */
async function sesionDelSocket(socket: Socket) {
  const cabecera = socket.handshake.headers.cookie
  if (!cabecera) return null
  const sesionId = leerCookie(parseCookie(cabecera)[NOMBRE_COOKIE])
  return sesionId ? await sesionActiva(sesionId) : null
}

export function montarTurnero(io: IoServer): void {
  io.on("connection", (socket: Socket) => {
    socket.on("SUSCRIBIR", ({ room }: { room: string }, ack?: () => void) => {
      socket.join(room)
      ack?.()
    })

    socket.on("LATIDO_KIOSCO", async (cmd) => {
      await registrarLatido(cmd)
    })

    socket.on("GENERAR_TURNO", async (cmd, ack?: (r: unknown) => void) => {
      const r = await generarTurno(cmd)
      ack?.(r)
      if (r.ok) await emitir(io, "TURNO_GENERADO", { turno: r.turno }, r.turno.tramiteId, null)
    })

    // --- Operador ---

    socket.on("ENTRAR_BOX", async (_datos, ack?: (r: unknown) => void) => {
      const sesion = await sesionDelSocket(socket)
      if (!sesion) {
        ack?.({ ok: false, codigo: "SIN_SESION", mensaje: "Iniciá sesión de nuevo" })
        return
      }
      socket.join(roomBox(sesion.boxId))
      socket.data.sesion = sesion
      ack?.({ ok: true, snapshot: await armarSnapshot(sesion.boxId) })
    })

    socket.on("LATIDO_OPERADOR", async () => {
      const sesion = socket.data.sesion
      if (sesion) await renovarLatido(sesion.id)
    })

    // llamarTurno devuelve ResultadoLlamado y los otros cuatro ResultadoComando.
    // Sin este tipo comun, Object.entries produce una union de funciones que
    // TypeScript no deja invocar. Los dos resultados comparten lo que se usa aca.
    type Manejador = (cmd: {
      turnoId: string
      boxId: string
      empleadoId?: string | null
    }) => Promise<
      { ok: true; turno: { tramiteId: string; boxId: string | null } } | { ok: false }
    >

    const comandos: Record<string, { fn: Manejador; evento: EventoTurnero }> = {
      LLAMAR_TURNO: { fn: llamarTurno, evento: "TURNO_LLAMADO" },
      RELLAMAR_TURNO: { fn: rellamarTurno, evento: "TURNO_RELLAMADO" },
      MARCAR_AUSENTE: { fn: marcarAusente, evento: "TURNO_AUSENTE" },
      INICIAR_ATENCION: { fn: iniciarAtencion, evento: "TURNO_INICIADO" },
      FINALIZAR_ATENCION: { fn: finalizarAtencion, evento: "TURNO_FINALIZADO" },
    }

    for (const [nombre, { fn, evento }] of Object.entries(comandos)) {
      socket.on(nombre, async (cmd, ack?: (r: unknown) => void) => {
        const sesion = socket.data.sesion
        if (!sesion) {
          ack?.({ ok: false, codigo: "SIN_SESION", mensaje: "Iniciá sesión de nuevo" })
          return
        }
        // El box y el empleado salen de la sesion, nunca del cliente.
        const r = await fn({
          turnoId: cmd.turnoId,
          boxId: sesion.boxId,
          empleadoId: sesion.empleadoId,
        })
        ack?.(r)
        if (r.ok) await emitir(io, evento, { turno: r.turno }, r.turno.tramiteId, r.turno.boxId)
      })
    }

    socket.on("DERIVAR_TURNO", async (cmd, ack?: (r: unknown) => void) => {
      const sesion = socket.data.sesion
      if (!sesion) {
        ack?.({ ok: false, codigo: "SIN_SESION", mensaje: "Iniciá sesión de nuevo" })
        return
      }
      const r = await derivarTurno({
        turnoId: cmd.turnoId,
        boxId: sesion.boxId,
        tramiteDestinoId: cmd.tramiteDestinoId,
        empleadoId: sesion.empleadoId,
      })
      ack?.(r)
      if (r.ok) {
        await emitir(io, "TURNO_DERIVADO", { turno: r.origen }, r.origen.tramiteId, r.origen.boxId)
        // El destino entra a otra cola: los boxes de ese tramite tienen que verlo.
        await emitir(io, "TURNO_GENERADO", { turno: r.destino }, r.destino.tramiteId, null)
      }
    })

    // --- Pantallas de ala ---

    // Sin sesion, a diferencia de ENTRAR_BOX: la TV es una pantalla publica sin
    // login. Por eso el snapshot expone solo numero, nombre y box, que es lo
    // que ya esta a la vista de cualquiera que mire el televisor.
    socket.on(
      "ENTRAR_PANTALLA",
      async ({ ala }: { ala: string }, ack?: (r: unknown) => void) => {
        socket.join(roomAla(ala))
        ack?.({ ok: true, snapshot: await armarSnapshotPantalla(ala) })
      }
    )
  })
}
