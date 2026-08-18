import { NOMBRES_DE_ICONO } from "@/lib/kiosco/iconos"

export interface ErrorCampo {
  campo: string
  mensaje: string
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const PREFIJO = /^[A-Z]{1,3}$/

export function validarNombre(campo: string, v: string): ErrorCampo | null {
  if (v.trim() === "") return { campo, mensaje: "No puede estar vacío" }
  return null
}

export function validarEntero(
  campo: string,
  v: number,
  minimo: number
): ErrorCampo | null {
  if (!Number.isInteger(v)) return { campo, mensaje: "Tiene que ser un número entero" }
  if (v < minimo) return { campo, mensaje: `Tiene que ser ${minimo} o más` }
  return null
}

/**
 * Una franja invertida no rompe nada visible: deja el tramite disponible
 * nunca, en silencio. Por eso se frena en la carga.
 */
export function validarFranja(apertura: string, cierre: string): ErrorCampo | null {
  if (!HORA.test(apertura)) {
    return { campo: "horaApertura", mensaje: "Tiene que ser HH:MM, por ejemplo 08:00" }
  }
  if (!HORA.test(cierre)) {
    return { campo: "horaCierre", mensaje: "Tiene que ser HH:MM, por ejemplo 14:00" }
  }
  if (apertura >= cierre) {
    return { campo: "horaCierre", mensaje: "El cierre tiene que ser posterior a la apertura" }
  }
  return null
}

/**
 * Un conjunto de digitos 0-6, no una mascara de bits: disponibilidad.ts lo
 * consume con diasSemana.includes(dia).
 */
export function validarDiasSemana(v: string): ErrorCampo | null {
  if (v === "") return { campo: "diasSemana", mensaje: "Elegí al menos un día" }
  if (!/^[0-6]+$/.test(v)) {
    return { campo: "diasSemana", mensaje: "Sólo dígitos del 0 al 6" }
  }
  if (new Set(v).size !== v.length) {
    return { campo: "diasSemana", mensaje: "Hay días repetidos" }
  }
  return null
}

/**
 * iconoPorNombre cae a FileQuestion ante un nombre desconocido, sin avisar.
 * Sin esta validacion, un icono mal tipeado llega al totem como un signo de
 * pregunta y nadie se entera hasta que alguien lo ve.
 */
export function validarIcono(v: string): ErrorCampo | null {
  if (!NOMBRES_DE_ICONO.includes(v)) {
    return { campo: "icono", mensaje: "Elegí un icono de la lista" }
  }
  return null
}

/**
 * El numero del turno es prefijo + contador, y Contador es por tramite. Dos
 * tramites con el mismo prefijo generan dos P01 distintos el mismo dia: dos
 * personas con el mismo numero esperando el mismo llamado.
 */
export function validarPrefijo(v: string, tomados: string[]): ErrorCampo | null {
  if (!PREFIJO.test(v)) {
    return { campo: "prefijo", mensaje: "Una a tres letras mayúsculas" }
  }
  if (tomados.includes(v)) {
    return { campo: "prefijo", mensaje: "Ya lo usa otro trámite activo" }
  }
  return null
}
