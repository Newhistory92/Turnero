import { prisma } from "@/lib/db"
import { verificarCredencial, type FilaUsuario } from "./institucional"
import { abrirSesion } from "./sesion"
import { esRol, type Rol } from "@/lib/admin/acceso"

export type ResultadoLogin =
  | {
      ok: true
      sesionId: string
      empleado: { id: string; nombre: string }
      boxId: string | null
      rol: Rol
    }
  | {
      ok: false
      codigo:
        | "CREDENCIAL_INVALIDA"
        | "NO_HABILITADO"
        | "BOX_OCUPADO"
        | "BOX_NO_ASIGNADO"
        | "SIN_PERMISO"
        | "ERROR_BASE"
      mensaje: string
      detalle?: string
    }

type Consulta = (nombreUsuario: string) => Promise<FilaUsuario[]>

export async function login(
  nombreUsuario: string,
  clave: string,
  boxId: string | null,
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

  const rol: Rol = esRol(empleado.rol) ? empleado.rol : "operador"

  // Pedir sesion sin box es pedir entrar al panel. Que la credencial sea
  // valida no alcanza: el rol tiene que habilitarlo.
  if (boxId === null && rol === "operador") {
    return {
      ok: false,
      codigo: "SIN_PERMISO",
      mensaje: "Tu usuario no tiene acceso al panel de administración",
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
    rol,
  }
}

/** Los boxes asignados y el rol, para que el login sepa qué opciones ofrecer. */
export async function accesoDe(
  documento: string
): Promise<{ boxes: { id: string; nombre: string }[]; rol: Rol | null }> {
  const empleado = await prisma.empleado.findUnique({
    where: { dniInstitucional: documento },
    include: { boxes: { include: { box: { include: { ala: true } } } } },
  })
  if (!empleado || !empleado.activo) return { boxes: [], rol: null }

  return {
    boxes: empleado.boxes.map((eb) => ({
      id: eb.box.id,
      nombre: `${eb.box.nombre} — Ala ${eb.box.ala.nombre}`,
    })),
    rol: esRol(empleado.rol) ? empleado.rol : null,
  }
}
