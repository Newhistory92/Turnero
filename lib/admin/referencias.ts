import { prisma } from "@/lib/db"

export type Entidad = "sede" | "ala" | "piso" | "box" | "categoria" | "tramite"

export interface Referencias {
  turnos: number
  sesiones: number
  tramites: number
  boxes: number
}

export function sePuedeBorrar(refs: Referencias): boolean {
  return Object.values(refs).every((n) => n === 0)
}

/**
 * Cuenta lo que quedaria huerfano. Se llama en el momento de borrar, no solo
 * al decidir si se pinta el boton: entre que la pagina se renderizo y que
 * alguien apreto pueden haber entrado turnos.
 */
export async function contarReferencias(
  entidad: Entidad,
  id: string
): Promise<Referencias> {
  switch (entidad) {
    case "tramite":
      return {
        turnos: await prisma.turno.count({ where: { tramiteId: id } }),
        sesiones: 0,
        tramites: 0,
        boxes: 0,
      }
    case "box":
      return {
        turnos: await prisma.turno.count({ where: { boxId: id } }),
        sesiones: await prisma.sesionOperador.count({ where: { boxId: id } }),
        tramites: 0,
        boxes: 0,
      }
    case "categoria":
      return {
        turnos: 0,
        sesiones: 0,
        tramites: await prisma.tramite.count({ where: { categoriaId: id } }),
        boxes: 0,
      }
    case "ala":
      return {
        turnos: 0,
        sesiones: 0,
        tramites: await prisma.tramite.count({ where: { destinoAlaId: id } }),
        boxes: await prisma.box.count({ where: { alaId: id } }),
      }
    case "piso":
      return {
        turnos: 0,
        sesiones: 0,
        tramites: await prisma.tramite.count({ where: { destinoPisoId: id } }),
        boxes: await prisma.box.count({ where: { pisoId: id } }),
      }
    case "sede":
      const sedeBoxes = await prisma.box.count({
        where: {
          OR: [
            { ala: { sedeId: id } },
            { piso: { sedeId: id } },
          ],
        },
      })
      const sedeTramites = await prisma.tramite.count({
        where: {
          OR: [
            { destinoAla: { sedeId: id } },
            { destinoPiso: { sedeId: id } },
          ],
        },
      })
      return {
        turnos: 0,
        sesiones: 0,
        tramites: sedeTramites,
        boxes: sedeBoxes,
      }
  }
}
