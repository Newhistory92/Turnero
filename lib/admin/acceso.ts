import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { leerCookie, NOMBRE_COOKIE, sesionActiva } from "@/lib/auth/sesion"

export type Rol = "operador" | "supervisor" | "admin"

export const ROLES = ["operador", "supervisor", "admin"] as const

export function esRol(v: string): v is Rol {
  return (ROLES as readonly string[]).includes(v)
}

export function puedeVerCatalogo(rol: Rol): boolean {
  return rol === "admin" || rol === "supervisor"
}

export function puedeEditarCatalogo(rol: Rol): boolean {
  return rol === "admin"
}

export interface Actor {
  empleadoId: string
  nombre: string
  rol: Rol
}

/**
 * Quien esta pidiendo, resuelto desde la cookie firmada. Devuelve null ante
 * cualquier duda —sin cookie, sesion cerrada, empleado inactivo, rol que no
 * esta en el vocabulario— porque en control de acceso la ausencia de prueba
 * es prueba de ausencia.
 */
export async function actorActual(): Promise<Actor | null> {
  const tarro = await cookies()
  const sesionId = leerCookie(tarro.get(NOMBRE_COOKIE)?.value)
  if (!sesionId) return null

  const sesion = await sesionActiva(sesionId)
  if (!sesion) return null

  const empleado = await prisma.empleado.findUnique({
    where: { id: sesion.empleadoId },
  })
  if (!empleado || !empleado.activo || !esRol(empleado.rol)) return null

  return { empleadoId: empleado.id, nombre: empleado.nombre, rol: empleado.rol }
}
