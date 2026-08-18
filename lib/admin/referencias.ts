import { prisma } from "@/lib/db"

export type Entidad = "sede" | "ala" | "piso" | "box" | "categoria" | "tramite"

export type Referencias = Record<string, number>

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
        contadores: await prisma.contador.count({ where: { tramiteId: id } }),
        boxes: await prisma.boxTramite.count({ where: { tramiteId: id } }),
      }
    case "box":
      return {
        turnos: await prisma.turno.count({ where: { boxId: id } }),
        eventos: await prisma.turnoEvento.count({ where: { boxId: id } }),
        sesiones: await prisma.sesionOperador.count({ where: { boxId: id } }),
        empleados: await prisma.empleadoBox.count({ where: { boxId: id } }),
        tramites: await prisma.boxTramite.count({ where: { boxId: id } }),
      }
    case "categoria":
      return {
        tramites: await prisma.tramite.count({ where: { categoriaId: id } }),
      }
    case "ala":
      return {
        boxes: await prisma.box.count({ where: { alaId: id } }),
        tramites: await prisma.tramite.count({ where: { destinoAlaId: id } }),
      }
    case "piso":
      return {
        boxes: await prisma.box.count({ where: { pisoId: id } }),
        tramites: await prisma.tramite.count({ where: { destinoPisoId: id } }),
      }
    case "sede":
      return {
        alas: await prisma.ala.count({ where: { sedeId: id } }),
        pisos: await prisma.piso.count({ where: { sedeId: id } }),
      }
  }
}
