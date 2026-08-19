import { prisma } from "@/lib/db"
import type { Actor } from "@/lib/admin/acceso"
import type { Alcance } from "./tipos"

export async function alcanceDe(actor: Actor): Promise<Alcance> {
  if (actor.rol === "director" || actor.rol === "admin") return { tipo: "todos" }

  const filas = await prisma.alcanceMetrica.findMany({
    where: { empleadoId: actor.empleadoId },
    select: { tramiteId: true },
  })

  return { tipo: "limitado", tramiteIds: filas.map((f) => f.tramiteId) }
}

/** Supervisor todavia sin configurar: no ve nada y hay que decirselo. */
export function sinAlcance(a: Alcance): boolean {
  return a.tipo === "limitado" && a.tramiteIds.length === 0
}

/**
 * Traduce el alcance a la forma que espera un where de Prisma. undefined es
 * como Prisma expresa "sin filtro"; { in: [] } no matchea nada, que es
 * justo lo que tiene que pasar con un alcance vacio.
 */
export function filtroTramiteId(a: Alcance): { in: string[] } | undefined {
  return a.tipo === "todos" ? undefined : { in: a.tramiteIds }
}
