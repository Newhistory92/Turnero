import { prisma } from "@/lib/db"
import type { Turno } from "@prisma/client"

export interface ComandoLlamarTurno {
  turnoId: string
  boxId: string
  empleadoId?: string | null
}

export type ResultadoLlamado =
  | { ok: true; turno: Turno }
  | {
      ok: false
      codigo: "YA_LLAMADO" | "TURNO_INEXISTENTE" | "ERROR_BASE"
      mensaje: string
      boxQueLoTiene?: string | null
      detalle?: string
    }

export async function llamarTurno(cmd: ComandoLlamarTurno): Promise<ResultadoLlamado> {
  try {
    return await prisma.$transaction(async (tx) => {
      // La condicion en el WHERE es la garantia: si otro box ya lo llamo,
      // esto afecta cero filas y no hay carrera posible.
      const afectadas = await tx.$executeRaw`
        UPDATE [Turno]
        SET estado = 'llamado', boxId = ${cmd.boxId}
        WHERE id = ${cmd.turnoId} AND estado IN ('esperando', 'ausente')
      `

      if (afectadas === 0) {
        const actual = await tx.turno.findUnique({ where: { id: cmd.turnoId } })
        if (!actual) {
          return {
            ok: false as const,
            codigo: "TURNO_INEXISTENTE" as const,
            mensaje: "Ese turno no existe",
          }
        }
        return {
          ok: false as const,
          codigo: "YA_LLAMADO" as const,
          mensaje: "Ese turno ya fue llamado",
          boxQueLoTiene: actual.boxId,
        }
      }

      await tx.turnoEvento.create({
        data: {
          turnoId: cmd.turnoId,
          tipo: "llamado",
          boxId: cmd.boxId,
          empleadoId: cmd.empleadoId ?? null,
        },
      })

      const turno = await tx.turno.findUniqueOrThrow({ where: { id: cmd.turnoId } })
      return { ok: true as const, turno }
    })
  } catch (e) {
    return {
      ok: false,
      codigo: "ERROR_BASE",
      mensaje: "No se pudo llamar el turno",
      detalle: e instanceof Error ? e.message : String(e),
    }
  }
}
