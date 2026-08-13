import { prisma } from "@/lib/db"
import type { Turno } from "@prisma/client"
import { transicion } from "@/lib/queue/estado"
import type { TurnoDominio } from "@/lib/queue/tipos"

export interface ComandoDerivar {
  turnoId: string
  boxId: string
  tramiteDestinoId: string
  empleadoId?: string | null
}

export type ResultadoDerivacion =
  | { ok: true; origen: Turno; destino: Turno }
  | {
      ok: false
      codigo:
        | "TRANSICION_INVALIDA" | "TURNO_INEXISTENTE" | "BOX_AJENO"
        | "TRAMITE_INEXISTENTE" | "MISMO_TRAMITE" | "ERROR_BASE"
      mensaje: string
      detalle?: string
    }

/**
 * La derivacion crea un turno nuevo en vez de mutar el original: asi el origen
 * cuenta como atencion del box A con su tiempo real, y el destino cuenta como
 * entrada a la cola del area nueva. Mutando tramiteId se perderia el trabajo
 * del primer box.
 *
 * El numero, la fecha y el createdAt se copian tal cual: la persona conserva el
 * ticket impreso, que es el motivo entero de no volver a imprimir. Y el
 * contador del destino no se toca, porque si se incrementara su serie
 * saltearia numeros.
 */
export async function derivarTurno(cmd: ComandoDerivar): Promise<ResultadoDerivacion> {
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

      if (actual.tramiteId === cmd.tramiteDestinoId) {
        return {
          ok: false as const,
          codigo: "MISMO_TRAMITE" as const,
          mensaje: "El destino tiene que ser un trámite distinto",
        }
      }

      const destinoTramite = await tx.tramite.findUnique({ where: { id: cmd.tramiteDestinoId } })
      if (!destinoTramite) {
        return {
          ok: false as const,
          codigo: "TRAMITE_INEXISTENTE" as const,
          mensaje: "Ese trámite no existe",
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

      const paso = transicion(dominio, "derivado", { boxId: cmd.boxId })
      if (!paso.ok) {
        return {
          ok: false as const,
          codigo: "TRANSICION_INVALIDA" as const,
          mensaje: paso.mensaje,
        }
      }

      const origen = await tx.turno.update({
        where: { id: cmd.turnoId },
        data: { estado: "derivado", boxId: cmd.boxId },
      })

      await tx.turnoEvento.create({
        data: {
          turnoId: cmd.turnoId,
          tipo: "derivado",
          boxId: cmd.boxId,
          empleadoId: cmd.empleadoId ?? null,
          detalle: `destino:${cmd.tramiteDestinoId}`,
        },
      })

      const nuevo = await tx.turno.create({
        data: {
          numero: actual.numero,
          fecha: actual.fecha,
          createdAt: actual.createdAt,
          tramiteId: cmd.tramiteDestinoId,
          dni: actual.dni,
          nombreAfiliado: actual.nombreAfiliado,
          estado: "esperando",
          requestId: `derivacion-${cmd.turnoId}-${cmd.tramiteDestinoId}`,
          derivadoDeId: cmd.turnoId,
        },
      })

      await tx.turnoEvento.create({
        data: { turnoId: nuevo.id, tipo: "generado", detalle: `derivado-de:${cmd.turnoId}` },
      })

      return { ok: true as const, origen, destino: nuevo }
    })
  } catch (e) {
    return {
      ok: false,
      codigo: "ERROR_BASE",
      mensaje: "No se pudo derivar el turno",
      detalle: e instanceof Error ? e.message : String(e),
    }
  }
}
