"use server"

import { revalidatePath } from "next/cache"
import { actorActual } from "./acceso"
import {
  guardarTramite,
  guardarBox,
  guardarSimple,
  guardarAlcance,
  cambiarActivo,
  borrar,
  type EntidadSimple,
  type Resultado,
} from "./mutaciones"
import { guardarUsuario } from "./usuarios"
import type { Entidad } from "./referencias"
import { type EstadoFormulario } from "./estadoFormulario"

const NO_AUTENTICADO: EstadoFormulario = {
  errores: [{ campo: "rol", mensaje: "Tu sesión venció. Volvé a entrar" }],
  guardado: false,
}

function aEstado(r: Resultado): EstadoFormulario {
  return r.ok ? { errores: [], guardado: true } : { errores: r.errores, guardado: false }
}

function texto(fd: FormData, clave: string): string {
  return String(fd.get(clave) ?? "")
}

function entero(fd: FormData, clave: string): number {
  return Number.parseInt(texto(fd, clave), 10)
}

function idOpcional(fd: FormData): string | null {
  const v = texto(fd, "id")
  return v === "" ? null : v
}

function varios(fd: FormData, clave: string): string[] {
  return fd.getAll(clave).map(String).filter((v) => v !== "")
}

/** Una casilla sin marcar no se envia: ausencia es false. */
function booleano(fd: FormData, clave: string): boolean {
  return fd.get(clave) !== null
}

function refrescar(): void {
  revalidatePath("/admin", "layout")
  // El kiosco tambien lee el catalogo y su pagina es un Server Component.
  revalidatePath("/kiosco")
}

export async function accionGuardarTramite(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const r = await guardarTramite(actor, {
    id: idOpcional(fd),
    categoriaId: texto(fd, "categoriaId"),
    nombre: texto(fd, "nombre"),
    subtitulo: texto(fd, "subtitulo"),
    icono: texto(fd, "icono"),
    prefijo: texto(fd, "prefijo").toUpperCase(),
    destinoAlaId: texto(fd, "destinoAlaId"),
    destinoPisoId: texto(fd, "destinoPisoId"),
    horaApertura: texto(fd, "horaApertura"),
    horaCierre: texto(fd, "horaCierre"),
    diasSemana: varios(fd, "dia").sort().join(""),
    duracionMinimaEsperada: entero(fd, "duracionMinimaEsperada"),
    orden: entero(fd, "orden"),
    boxIds: varios(fd, "boxId"),
  })

  if (r.ok) refrescar()
  return aEstado(r)
}

export async function accionGuardarBox(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const r = await guardarBox(actor, {
    id: idOpcional(fd),
    alaId: texto(fd, "alaId"),
    pisoId: texto(fd, "pisoId"),
    numero: entero(fd, "numero"),
    nombre: texto(fd, "nombre"),
    horaApertura: texto(fd, "horaApertura"),
    horaCierre: texto(fd, "horaCierre"),
    diasSemana: varios(fd, "dia").sort().join(""),
    tramiteIds: varios(fd, "tramiteId"),
  })

  if (r.ok) refrescar()
  return aEstado(r)
}

export async function accionGuardarSimple(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const entidad = texto(fd, "entidad") as EntidadSimple
  const r = await guardarSimple(actor, entidad, {
    id: idOpcional(fd),
    nombre: texto(fd, "nombre"),
    posicion: entero(fd, "posicion"),
    sedeId: texto(fd, "sedeId") || undefined,
    icono: texto(fd, "icono") || undefined,
  })

  if (r.ok) refrescar()
  return aEstado(r)
}

export async function accionCambiarActivo(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const r = await cambiarActivo(
    actor,
    texto(fd, "entidad") as Entidad,
    texto(fd, "id"),
    texto(fd, "activo") === "1"
  )

  if (r.ok) refrescar()
  return aEstado(r)
}

export async function accionGuardarAlcance(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const r = await guardarAlcance(actor, {
    empleadoId: texto(fd, "empleadoId"),
    tramiteIds: varios(fd, "tramiteId"),
  })

  if (r.ok) revalidatePath("/admin/alcance")
  return aEstado(r)
}

export async function accionGuardarUsuario(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const r = await guardarUsuario(actor, {
    empleadoId: texto(fd, "empleadoId"),
    rol: texto(fd, "rol"),
    activo: booleano(fd, "activo"),
    boxIds: varios(fd, "boxId"),
  })

  if (r.ok) revalidatePath("/admin/usuarios")
  return aEstado(r)
}

export async function accionBorrar(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const r = await borrar(actor, texto(fd, "entidad") as Entidad, texto(fd, "id"))

  if (r.ok) refrescar()
  return aEstado(r)
}
