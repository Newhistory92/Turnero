import { prisma } from "@/lib/db"
import { verificarCredencial, type FilaUsuario } from "./institucional"
import { abrirSesion } from "./sesion"

export type ResultadoLogin =
  | { ok: true; sesionId: string; empleado: { id: string; nombre: string }; boxId: string }
  | {
      ok: false
      codigo:
        | "CREDENCIAL_INVALIDA"
        | "NO_HABILITADO"
        | "BOX_OCUPADO"
        | "BOX_NO_ASIGNADO"
        | "ERROR_BASE"
      mensaje: string
      detalle?: string
    }

type Consulta = (nombreUsuario: string) => Promise<FilaUsuario[]>

export async function login(
  nombreUsuario: string,
  clave: string,
  boxId: string,
  consulta?: Consulta
): Promise<ResultadoLogin> {
  const credencial = await verificarCredencial(nombreUsuario, clave, consulta)
  if (!credencial.ok) {
    return {
      ok: false,
      codigo: credencial.codigo === "ERROR_BASE" ? "ERROR_BASE" : "CREDENCIAL_INVALIDA",
      mensaje: credencial.mensaje,
      detalle: credencial.detalle,
    }
  }

  const empleado = await prisma.empleado.findUnique({
    where: { dniInstitucional: credencial.usuario.documento },
  })

  // Aca el mensaje es especifico: la credencial ya se valido, asi que no se
  // le esta confirmando nada a un desconocido, y le sirve a una persona
  // legitima para saber que tiene que pedir el alta.
  if (!empleado || !empleado.activo) {
    return {
      ok: false,
      codigo: "NO_HABILITADO",
      mensaje: "Tu usuario es válido pero no estás habilitado en el turnero",
    }
  }

  const sesion = await abrirSesion(empleado.id, boxId)
  if (!sesion.ok) {
    return { ok: false, codigo: sesion.codigo, mensaje: sesion.mensaje, detalle: sesion.detalle }
  }

  return {
    ok: true,
    sesionId: sesion.sesionId,
    empleado: { id: empleado.id, nombre: empleado.nombre },
    boxId,
  }
}

/** Los boxes que la persona tiene asignados, para el selector del login. */
export async function boxesDe(documento: string): Promise<{ id: string; nombre: string }[]> {
  const empleado = await prisma.empleado.findUnique({
    where: { dniInstitucional: documento },
    include: { boxes: { include: { box: { include: { ala: true } } } } },
  })
  if (!empleado) return []
  return empleado.boxes.map((eb) => ({
    id: eb.box.id,
    nombre: `${eb.box.nombre} — Ala ${eb.box.ala.nombre}`,
  }))
}
