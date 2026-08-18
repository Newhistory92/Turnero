import { prisma } from "@/lib/db"
import { invalidarCatalogo } from "@/lib/catalogo"
import { emitirATodos } from "@/server/io"
import { puedeEditarCatalogo, type Actor } from "./acceso"
import {
  validarNombre,
  validarEntero,
  validarFranja,
  validarDiasSemana,
  validarIcono,
  validarPrefijo,
  type ErrorCampo,
} from "./validaciones"
import { contarReferencias, sePuedeBorrar, type Entidad } from "./referencias"

export type { ErrorCampo }

export type Resultado = { ok: true } | { ok: false; errores: ErrorCampo[] }

const SIN_PERMISO: ErrorCampo = {
  campo: "rol",
  mensaje: "Tu usuario no puede modificar el catálogo",
}

/** Adapta un validador que devuelve string|undefined a ErrorCampo|null */
function campo(nombre: string, msg: string | undefined): ErrorCampo | null {
  return msg != null ? { campo: nombre, mensaje: msg } : null
}

function fallo(...errores: (ErrorCampo | null | undefined)[]): Resultado | null {
  const reales = errores.filter((e): e is ErrorCampo => e != null)
  return reales.length > 0 ? { ok: false, errores: reales } : null
}

/**
 * Invalidar va ANTES de emitir. Al reves, un cliente rapido podria pedir el
 * catalogo y recibir el cache viejo, quedandose vencido hasta el proximo
 * cambio.
 */
function propagar(): void {
  invalidarCatalogo()
  emitirATodos("CATALOGO_ACTUALIZADO", {})
}

export interface DatosTramite {
  id: string | null
  categoriaId: string
  nombre: string
  subtitulo: string
  icono: string
  prefijo: string
  destinoAlaId: string
  destinoPisoId: string
  horaApertura: string
  horaCierre: string
  diasSemana: string
  duracionMinimaEsperada: number
  orden: number
  boxIds: string[]
}

/** Los prefijos activos que no son el del tramite que se esta editando. */
async function prefijosTomados(excluirId: string | null): Promise<string[]> {
  const otros = await prisma.tramite.findMany({
    where: { activo: true, ...(excluirId ? { id: { not: excluirId } } : {}) },
    select: { prefijo: true },
  })
  return otros.map((t) => t.prefijo)
}

/**
 * validarPrefijo solo valida formato; la unicidad se verifica aqui contra la
 * lista de prefijos activos que viene de la DB.
 */
function validarPrefijoUnico(prefijo: string, tomados: string[]): ErrorCampo | null {
  const err = validarPrefijo(prefijo)
  if (err) return { campo: "prefijo", mensaje: err }
  if (tomados.includes(prefijo)) {
    return { campo: "prefijo", mensaje: "Ese prefijo ya lo usa otro tramite activo" }
  }
  return null
}

export async function guardarTramite(
  actor: Actor,
  d: DatosTramite
): Promise<Resultado> {
  if (!puedeEditarCatalogo(actor.rol)) return { ok: false, errores: [SIN_PERMISO] }

  const malo = fallo(
    campo("nombre", validarNombre(d.nombre)),
    campo("subtitulo", validarNombre(d.subtitulo)),
    campo("icono", validarIcono(d.icono)),
    validarPrefijoUnico(d.prefijo, await prefijosTomados(d.id)),
    campo("franja", validarFranja(d.horaApertura, d.horaCierre)),
    campo("diasSemana", validarDiasSemana(d.diasSemana)),
    campo("duracionMinimaEsperada", validarEntero(d.duracionMinimaEsperada, 0, 10080)),
    campo("orden", validarEntero(d.orden, 0, 9999))
  )
  if (malo) return malo

  const campos = {
    categoriaId: d.categoriaId,
    nombre: d.nombre.trim(),
    subtitulo: d.subtitulo.trim(),
    icono: d.icono,
    prefijo: d.prefijo,
    destinoAlaId: d.destinoAlaId,
    destinoPisoId: d.destinoPisoId,
    horaApertura: d.horaApertura,
    horaCierre: d.horaCierre,
    diasSemana: d.diasSemana,
    duracionMinimaEsperada: d.duracionMinimaEsperada,
    orden: d.orden,
  }

  const id = d.id
    ? (await prisma.tramite.update({ where: { id: d.id }, data: campos })).id
    : (await prisma.tramite.create({ data: { ...campos, activo: true } })).id

  // La asignacion se reemplaza entera: es mas simple que diferenciar y el
  // volumen es de decenas de filas.
  await prisma.boxTramite.deleteMany({ where: { tramiteId: id } })
  if (d.boxIds.length > 0) {
    await prisma.boxTramite.createMany({
      data: d.boxIds.map((boxId) => ({ boxId, tramiteId: id })),
    })
  }

  propagar()
  return { ok: true }
}

export interface DatosBox {
  id: string | null
  alaId: string
  pisoId: string
  numero: number
  nombre: string
  horaApertura: string
  horaCierre: string
  diasSemana: string
  tramiteIds: string[]
}

export async function guardarBox(actor: Actor, d: DatosBox): Promise<Resultado> {
  if (!puedeEditarCatalogo(actor.rol)) return { ok: false, errores: [SIN_PERMISO] }

  const malo = fallo(
    campo("nombre", validarNombre(d.nombre)),
    campo("numero", validarEntero(d.numero, 1, 9999)),
    campo("franja", validarFranja(d.horaApertura, d.horaCierre)),
    campo("diasSemana", validarDiasSemana(d.diasSemana))
  )
  if (malo) return malo

  // @@unique([alaId, numero]) lo garantiza en la base, pero el mensaje de
  // Prisma no es legible para quien carga.
  const choca = await prisma.box.findFirst({
    where: { alaId: d.alaId, numero: d.numero, ...(d.id ? { id: { not: d.id } } : {}) },
  })
  if (choca) {
    return {
      ok: false,
      errores: [{ campo: "numero", mensaje: "Ya hay un box con ese numero en el ala" }],
    }
  }

  const camposBox = {
    alaId: d.alaId,
    pisoId: d.pisoId,
    numero: d.numero,
    nombre: d.nombre.trim(),
    horaApertura: d.horaApertura,
    horaCierre: d.horaCierre,
    diasSemana: d.diasSemana,
  }

  const id = d.id
    ? (await prisma.box.update({ where: { id: d.id }, data: camposBox })).id
    : (await prisma.box.create({ data: { ...camposBox, activo: true } })).id

  await prisma.boxTramite.deleteMany({ where: { boxId: id } })
  if (d.tramiteIds.length > 0) {
    await prisma.boxTramite.createMany({
      data: d.tramiteIds.map((tramiteId) => ({ boxId: id, tramiteId })),
    })
  }

  propagar()
  return { ok: true }
}

export type EntidadSimple = "sede" | "ala" | "piso" | "categoria"

export interface DatosSimple {
  id: string | null
  nombre: string
  /** orden en Ala y Categoria, nivel en Piso. Sede lo ignora. */
  posicion: number
  /** Sede no lo usa; Ala y Piso lo necesitan. */
  sedeId?: string
  /** Categoria lo necesita. */
  icono?: string
}

export async function guardarSimple(
  actor: Actor,
  entidad: EntidadSimple,
  d: DatosSimple
): Promise<Resultado> {
  if (!puedeEditarCatalogo(actor.rol)) return { ok: false, errores: [SIN_PERMISO] }

  const malo = fallo(
    campo("nombre", validarNombre(d.nombre)),
    entidad === "sede" ? null : campo("posicion", validarEntero(d.posicion, 0, 9999)),
    entidad === "categoria" ? campo("icono", validarIcono(d.icono ?? "")) : null
  )
  if (malo) return malo

  const nombre = d.nombre.trim()

  switch (entidad) {
    case "sede":
      d.id
        ? await prisma.sede.update({ where: { id: d.id }, data: { nombre } })
        : await prisma.sede.create({ data: { nombre, activa: true } })
      break
    case "ala": {
      const datos = { nombre, orden: d.posicion, sedeId: d.sedeId! }
      d.id
        ? await prisma.ala.update({ where: { id: d.id }, data: datos })
        : await prisma.ala.create({ data: { ...datos, activa: true } })
      break
    }
    case "piso": {
      const datos = { nombre, nivel: d.posicion, sedeId: d.sedeId! }
      d.id
        ? await prisma.piso.update({ where: { id: d.id }, data: datos })
        : await prisma.piso.create({ data: { ...datos, activa: true } })
      break
    }
    case "categoria": {
      const datos = { nombre, orden: d.posicion, icono: d.icono! }
      d.id
        ? await prisma.categoria.update({ where: { id: d.id }, data: datos })
        : await prisma.categoria.create({ data: { ...datos, activa: true } })
      break
    }
  }

  propagar()
  return { ok: true }
}

export async function cambiarActivo(
  actor: Actor,
  entidad: Entidad,
  id: string,
  activo: boolean
): Promise<Resultado> {
  if (!puedeEditarCatalogo(actor.rol)) return { ok: false, errores: [SIN_PERMISO] }

  // Reactivar es una escritura como cualquier otra: si el prefijo se le
  // asigno a otro tramite mientras estaba de baja, hay que cambiarlo antes.
  if (entidad === "tramite" && activo) {
    const t = await prisma.tramite.findUnique({ where: { id } })
    if (!t) return { ok: false, errores: [{ campo: "id", mensaje: "No existe" }] }
    const err = validarPrefijoUnico(t.prefijo, await prefijosTomados(id))
    if (err) return { ok: false, errores: [err] }
  }

  switch (entidad) {
    case "sede":
      await prisma.sede.update({ where: { id }, data: { activa: activo } })
      break
    case "ala":
      await prisma.ala.update({ where: { id }, data: { activa: activo } })
      break
    case "piso":
      await prisma.piso.update({ where: { id }, data: { activa: activo } })
      break
    case "categoria":
      await prisma.categoria.update({ where: { id }, data: { activa: activo } })
      break
    case "box":
      await prisma.box.update({ where: { id }, data: { activo } })
      break
    case "tramite":
      await prisma.tramite.update({ where: { id }, data: { activo } })
      break
  }

  propagar()
  return { ok: true }
}

export async function borrar(
  actor: Actor,
  entidad: Entidad,
  id: string
): Promise<Resultado> {
  if (!puedeEditarCatalogo(actor.rol)) return { ok: false, errores: [SIN_PERMISO] }

  // Se verifica aca, no solo al pintar el boton: entre que la pagina se
  // renderizo y que alguien apreto pueden haber entrado turnos.
  const refs = await contarReferencias(entidad, id)
  if (!sePuedeBorrar(refs)) {
    const cuales = Object.entries(refs)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${n} ${k}`)
      .join(", ")
    return {
      ok: false,
      errores: [{ campo: "referencias", mensaje: `No se puede borrar: tiene ${cuales}` }],
    }
  }

  switch (entidad) {
    case "sede":
      await prisma.sede.delete({ where: { id } })
      break
    case "ala":
      await prisma.ala.delete({ where: { id } })
      break
    case "piso":
      await prisma.piso.delete({ where: { id } })
      break
    case "categoria":
      await prisma.categoria.delete({ where: { id } })
      break
    case "box":
      await prisma.box.delete({ where: { id } })
      break
    case "tramite":
      await prisma.tramite.delete({ where: { id } })
      break
  }

  propagar()
  return { ok: true }
}
