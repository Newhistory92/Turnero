import { io, type Socket } from "socket.io-client"

/**
 * Turno tal como vuelve del servidor. Los Date viajan como texto ISO: es lo
 * unico que cambia respecto del modelo de Prisma.
 */
export interface TurnoDelServidor {
  id: string
  numero: string
  tramiteId: string
  estado: string
  createdAt: string
}

export type RespuestaGeneracion =
  | { ok: true; turno: TurnoDelServidor }
  | { ok: false; codigo: string; mensaje: string }

export interface ComandoGeneracion {
  tramiteId: string
  dni: string | null
  nombreAfiliado: string | null
  requestId: string
}

/** Si el servidor no contesta en este plazo, el kiosco muestra el error. */
export const TIMEOUT_GENERACION_MS = 10_000

let socket: Socket | null = null

/**
 * El socket del kiosco, uno solo por pestaña. Lo usa generarTurnoPorSocket y
 * tambien quien necesite escuchar eventos del servidor: abrir una segunda
 * conexion duplicaria los avisos.
 */
export function conexionKiosco(): Socket {
  if (!socket) socket = io({ transports: ["websocket", "polling"] })
  return socket
}

/**
 * Pide el turno al servidor y espera el ack. El numero sale siempre de esta
 * respuesta: el cliente no lo calcula ni lo adivina (regla 1 del proyecto).
 *
 * Un timeout se responde como fallo, no como excepcion, para que el wizard
 * caiga en la pantalla de no disponible en vez de quedarse colgado.
 */
export function generarTurnoPorSocket(
  cmd: ComandoGeneracion
): Promise<RespuestaGeneracion> {
  return new Promise((resolve) => {
    const fallo: RespuestaGeneracion = {
      ok: false,
      codigo: "SIN_RESPUESTA",
      mensaje: "El servidor no respondió a tiempo",
    }

    const t = setTimeout(() => resolve(fallo), TIMEOUT_GENERACION_MS)

    conexionKiosco().emit("GENERAR_TURNO", cmd, (r: RespuestaGeneracion) => {
      clearTimeout(t)
      resolve(r ?? fallo)
    })
  })
}
