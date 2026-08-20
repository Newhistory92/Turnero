import { prisma } from "@/lib/db"
import { esRol, puedeEditarCatalogo, type Actor } from "./acceso"
import type { Resultado } from "./mutaciones"

export interface UsuarioFila {
  id: string
  dniInstitucional: string
  nombre: string
  rol: string
  activo: boolean
  boxIds: string[]
}

/**
 * Incluye a los inactivos a proposito: dar de baja no es esconder, y si no
 * aparecieran no habria forma de reactivarlos desde la pantalla.
 */
export async function listarUsuarios(): Promise<UsuarioFila[]> {
  const filas = await prisma.empleado.findMany({
    include: { boxes: { select: { boxId: true } } },
    orderBy: { nombre: "asc" },
  })

  return filas.map((e) => ({
    id: e.id,
    dniInstitucional: e.dniInstitucional,
    nombre: e.nombre,
    rol: e.rol,
    activo: e.activo,
    boxIds: e.boxes.map((b) => b.boxId),
  }))
}

export interface DatosUsuario {
  empleadoId: string
  rol: string
  activo: boolean
  boxIds: string[]
}

export async function guardarUsuario(actor: Actor, d: DatosUsuario): Promise<Resultado> {
  // Repartir roles es la misma autoridad que editar el catalogo: si un
  // supervisor pudiera, se ascenderia a si mismo.
  if (!puedeEditarCatalogo(actor.rol)) {
    return {
      ok: false,
      errores: [{ campo: "rol", mensaje: "No tenes permiso para editar usuarios" }],
    }
  }

  const empleado = await prisma.empleado.findUnique({ where: { id: d.empleadoId } })
  if (!empleado) {
    return {
      ok: false,
      errores: [{ campo: "empleadoId", mensaje: "Ese empleado ya no existe" }],
    }
  }

  // Tu propia fila: los boxes si, el rol y el activo no. Hace imposible que
  // alguien se deje afuera del panel. La pantalla ya los muestra
  // deshabilitados, asi que un envio con esos campos cambiados viene de un
  // formulario manipulado: se guarda lo legitimo y se ignora el resto.
  const esMiFila = d.empleadoId === actor.empleadoId

  // El orden importa. Validar el rol antes del guard haria fallar la edicion
  // de tus propios boxes si el formulario manipulado trajera ademas un rol
  // invalido, cuando lo correcto es descartar ese rol y guardar los boxes.
  if (!esMiFila && !esRol(d.rol)) {
    return { ok: false, errores: [{ campo: "rol", mensaje: "Ese rol no existe" }] }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (!esMiFila) {
        await tx.empleado.update({
          where: { id: d.empleadoId },
          data: { rol: d.rol, activo: d.activo },
        })
      }

      // EmpleadoBox no tiene mas campos que las dos claves, asi que reemplazar
      // es equivalente a diferenciar y mas simple de leer.
      await tx.empleadoBox.deleteMany({ where: { empleadoId: d.empleadoId } })
      if (d.boxIds.length > 0) {
        await tx.empleadoBox.createMany({
          data: d.boxIds.map((boxId) => ({ empleadoId: d.empleadoId, boxId })),
        })
      }
    })
  } catch {
    return {
      ok: false,
      errores: [{ campo: "boxId", mensaje: "No se pudo guardar el usuario" }],
    }
  }

  return { ok: true }
}
