import type { EstadoTurno, TipoEvento, TurnoDominio } from "./tipos"

interface Regla {
  evento: TipoEvento
  desde: EstadoTurno[]
  hacia: EstadoTurno
  requiereBox: boolean
}

export const TRANSICIONES: Regla[] = [
  { evento: "generado", desde: [], hacia: "esperando", requiereBox: false },
  { evento: "llamado", desde: ["esperando", "ausente"], hacia: "llamado", requiereBox: true },
  { evento: "rellamado", desde: ["llamado"], hacia: "llamado", requiereBox: true },
  { evento: "ausente", desde: ["llamado"], hacia: "ausente", requiereBox: false },
  { evento: "iniciado", desde: ["llamado"], hacia: "atendiendo", requiereBox: true },
  { evento: "finalizado", desde: ["atendiendo"], hacia: "finalizado", requiereBox: false },
  { evento: "abandonado", desde: ["esperando"], hacia: "abandonado", requiereBox: false },
]

export type CodigoError = "TRANSICION_INVALIDA" | "BOX_REQUERIDO" | "EVENTO_DESCONOCIDO"

export type ResultadoTransicion =
  | { ok: true; turno: TurnoDominio }
  | { ok: false; codigo: CodigoError; mensaje: string }

export function transicion(
  turno: TurnoDominio,
  evento: TipoEvento,
  datos: { boxId?: string }
): ResultadoTransicion {
  const regla = TRANSICIONES.find((r) => r.evento === evento)
  if (!regla) {
    return { ok: false, codigo: "EVENTO_DESCONOCIDO", mensaje: `Evento ${evento} desconocido` }
  }

  if (!regla.desde.includes(turno.estado)) {
    return {
      ok: false,
      codigo: "TRANSICION_INVALIDA",
      mensaje: `No se puede pasar de ${turno.estado} a ${regla.hacia}`,
    }
  }

  if (regla.requiereBox && !datos.boxId) {
    return { ok: false, codigo: "BOX_REQUERIDO", mensaje: "Falta el box" }
  }

  return {
    ok: true,
    turno: {
      ...turno,
      estado: regla.hacia,
      boxId: datos.boxId ?? turno.boxId,
    },
  }
}
