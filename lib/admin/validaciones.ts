import { NOMBRES_DE_ICONO } from "@/lib/kiosco/iconos"

export interface ErrorCampo {
  campo: string
  mensaje: string
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const PREFIJO = /^[A-Z]{1,3}$/

export function validarNombre(v: unknown): string | undefined {
  if (typeof v !== "string") return "Tiene que ser un texto"
  if (v.trim() === "") return "No puede estar vacío"
  return undefined
}

export function validarEntero(v: unknown, min: number, max: number): string | undefined {
  if (typeof v !== "number") return "Tiene que ser un número"
  if (!Number.isInteger(v)) return "Tiene que ser un número entero"
  if (v < min) return `Tiene que ser ${min} o más`
  if (v > max) return `Tiene que ser ${max} o menos`
  return undefined
}

/**
 * Una franja invertida no rompe nada visible: deja el tramite disponible
 * nunca, en silencio. Por eso se frena en la carga.
 */
export function validarFranja(desde: unknown, hasta: unknown): string | undefined {
  if (typeof desde !== "string") return "Apertura tiene que ser HH:MM, por ejemplo 08:00"
  if (typeof hasta !== "string") return "Cierre tiene que ser HH:MM, por ejemplo 14:00"
  if (!HORA.test(desde)) {
    return "Apertura tiene que ser HH:MM, por ejemplo 08:00"
  }
  if (!HORA.test(hasta)) {
    return "Cierre tiene que ser HH:MM, por ejemplo 14:00"
  }
  if (desde >= hasta) {
    return "El cierre tiene que ser posterior a la apertura"
  }
  return undefined
}

/**
 * Un conjunto de digitos 0-6, no una mascara de bits: disponibilidad.ts lo
 * consume con diasSemana.includes(dia).
 */
export function validarDiasSemana(v: unknown): string | undefined {
  if (typeof v !== "string") return "Elegí al menos un día"
  if (v === "") return "Elegí al menos un día"
  if (!/^[0-6]+$/.test(v)) {
    return "Sólo dígitos del 0 al 6"
  }
  if (new Set(v).size !== v.length) {
    return "Hay días repetidos"
  }
  return undefined
}

/**
 * iconoPorNombre cae a FileQuestion ante un nombre desconocido, sin avisar.
 * Sin esta validacion, un icono mal tipeado llega al totem como un signo de
 * pregunta y nadie se entera hasta que alguien lo ve.
 */
export function validarIcono(v: unknown): string | undefined {
  if (typeof v !== "string") return "Elegí un icono de la lista"
  if (!NOMBRES_DE_ICONO.includes(v)) {
    return "Elegí un icono de la lista"
  }
  return undefined
}

/**
 * El numero del turno es prefijo + contador, y Contador es por tramite. Dos
 * tramites con el mismo prefijo generan dos P01 distintos el mismo dia: dos
 * personas con el mismo numero esperando el mismo llamado.
 * La unicidad del prefijo se valida en mutaciones.ts, no aquí.
 */
export function validarPrefijo(v: unknown): string | undefined {
  if (typeof v !== "string") return "Una a tres letras mayúsculas"
  if (!PREFIJO.test(v)) {
    return "Una a tres letras mayúsculas"
  }
  return undefined
}
