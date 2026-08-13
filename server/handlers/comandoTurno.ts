import { prisma } from "@/lib/db"
import type { Turno } from "@prisma/client"
import { transicion } from "@/lib/queue/estado"
import type { TipoEvento, TurnoDominio } from "@/lib/queue/tipos"

export interface ComandoTurnoBox {
  turnoId: string
  boxId: string
  empleadoId?: string | null
}

export type ResultadoComando =
  | { ok: true; turno: Turno }
  | {
      ok: false
      codigo: "TRANSICION_INVALIDA" | "TURNO_INEXISTENTE" | "BOX_AJENO" | "ERROR_BASE"
      mensaje: string
      detalle?: string
    }

/**
 * Tronco de rellamar, ausente, iniciar y finalizar: los cuatro validan contra
 * estado.ts, escriben el evento dentro de la misma transaccion, y devuelven el
 * turno actualizado. La regla de que transiciones son validas vive solo en
 * estado.ts; aca no se duplica.
 */
export async function aplicarComando(
  cmd: ComandoTurnoBox,
  evento: TipoEvento
): Promise<ResultadoComando> {
  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await tx.turno.findUnique({ where: { id: cmd.turnoId } })
      if (!actual) {
        return {
          ok: false as const,
          codigo: "TURNO_INEXISTENTE" as const,
          mensaje: "Ese turno no existe",
        }
      }

      if (actual.boxId && actual.boxId !== cmd.boxId) {
        return {
          ok: false as const,
          codigo: "BOX_AJENO" as const,
          mensaje: "Ese turno lo está atendiendo otro box",
        }
      }

      const dominio: TurnoDominio = {
        id: actual.id,
        numero: actual.numero,
        tramiteId: actual.tramiteId,
        estado: actual.estado as TurnoDominio["estado"],
        boxId: actual.boxId,
        createdAt: actual.createdAt,
        derivadoDeId: actual.derivadoDeId,
      }

      const paso = transicion(dominio, evento, { boxId: cmd.boxId })
      if (!paso.ok) {
        return {
          ok: false as const,
          codigo: "TRANSICION_INVALIDA" as const,
          mensaje: paso.mensaje,
        }
      }

      const turno = await tx.turno.update({
        where: { id: cmd.turnoId },
        data: { estado: paso.turno.estado, boxId: paso.turno.boxId },
      })

      await tx.turnoEvento.create({
        data: {
          turnoId: cmd.turnoId,
          tipo: evento,
          boxId: cmd.boxId,
          empleadoId: cmd.empleadoId ?? null,
        },
      })

      return { ok: true as const, turno }
    })
  } catch (e) {
    return {
      ok: false,
      codigo: "ERROR_BASE",
      mensaje: "No se pudo aplicar el comando",
      detalle: e instanceof Error ? e.message : String(e),
    }
  }
}
