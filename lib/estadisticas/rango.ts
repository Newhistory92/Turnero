import type { RangoFechas } from "./tipos"
import { aClaveFecha } from "./fechas"

// Se reexporta para que las paginas traigan del mismo modulo del que ya
// importan presetA, en vez de tener que conocer dos rutas.
export { aClaveFecha }

export type Preset = "hoy" | "semana" | "mes"

export const PRESETS = ["hoy", "semana", "mes"] as const

/** Cuantos dias abarca cada preset, contando hoy. */
const DIAS: Record<Preset, number> = { hoy: 1, semana: 7, mes: 30 }

const FORMATO = /^\d{4}-\d{2}-\d{2}$/

function arranqueDelDia(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function cierreDelDia(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

export function presetA(preset: Preset, ahora: Date = new Date()): RangoFechas {
  const desde = arranqueDelDia(ahora)
  desde.setDate(desde.getDate() - (DIAS[preset] - 1))
  return { desde, hasta: cierreDelDia(ahora) }
}

/**
 * Construye una fecha local desde YYYY-MM-DD. Devuelve null si el texto no
 * tiene el formato o si describe un dia que no existe (new Date lo
 * corregiria en silencio: "2026-02-31" se volveria marzo).
 */
function aFechaLocal(texto: string): Date | null {
  if (!FORMATO.test(texto)) return null
  const [anio, mes, dia] = texto.split("-").map(Number)
  const d = new Date(anio, mes - 1, dia)
  if (d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null
  return d
}

/**
 * `corregido` distingue "entraste sin parametros" de "lo que mandaste no
 * servia". Solo el segundo caso merece un aviso en pantalla; devolver vacio
 * en silencio haria leer "no hubo turnos" donde hubo un error de tipeo.
 */
export function parsearRango(
  desde: string | undefined,
  hasta: string | undefined,
  ahora: Date = new Date()
): { rango: RangoFechas; corregido: boolean } {
  if (desde === undefined && hasta === undefined) {
    return { rango: presetA("mes", ahora), corregido: false }
  }

  const d = desde ? aFechaLocal(desde) : null
  const h = hasta ? aFechaLocal(hasta) : null

  if (!d || !h || d.getTime() > h.getTime()) {
    return { rango: presetA("mes", ahora), corregido: true }
  }

  // Validar que el rango no exceda 366 dias
  const diasTranscurridos = Math.floor((h.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (diasTranscurridos > 366) {
    return { rango: presetA("mes", ahora), corregido: true }
  }

  return { rango: { desde: arranqueDelDia(d), hasta: cierreDelDia(h) }, corregido: false }
}
