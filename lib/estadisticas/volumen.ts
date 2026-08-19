import { aClaveFecha } from "./fechas"

export interface TurnoVolumen {
  id: string
  tramiteId: string
  tramiteNombre: string
  derivadoDeId: string | null
  /** Estado final del turno: `finalizado`, `ausente`, `abandonado`, etc. */
  estado: string
  /** Timestamp del evento `generado`. null si el turno no lo tiene. */
  generadoEn: Date | null
  esperaSegundos: number | null
}

export interface LineaVolumen {
  tramiteId: string
  tramiteNombre: string
  personas: number
  atenciones: number
}

export interface LineaEstado {
  tramiteId: string
  tramiteNombre: string
  cuantos: number
}

/**
 * Una persona derivada deja dos filas en Turno: el origen y el destino. La
 * primera es la llegada real; la segunda es trabajo del segundo box, no una
 * persona nueva.
 */
export function esPersona(t: { derivadoDeId: string | null }): boolean {
  return t.derivadoDeId === null
}

function soloNumeros(valores: (number | null)[]): number[] {
  return valores.filter((v): v is number => v !== null)
}

export function promedio(valores: (number | null)[]): number | null {
  const n = soloNumeros(valores)
  if (n.length === 0) return null
  return n.reduce((a, b) => a + b, 0) / n.length
}

export function mediana(valores: (number | null)[]): number | null {
  const n = soloNumeros(valores).sort((a, b) => a - b)
  if (n.length === 0) return null
  const medio = Math.floor(n.length / 2)
  return n.length % 2 === 1 ? n[medio] : (n[medio - 1] + n[medio]) / 2
}

export function porTramite(turnos: TurnoVolumen[]): LineaVolumen[] {
  const acumulado = new Map<string, LineaVolumen>()

  for (const t of turnos) {
    const linea = acumulado.get(t.tramiteId) ?? {
      tramiteId: t.tramiteId,
      tramiteNombre: t.tramiteNombre,
      personas: 0,
      atenciones: 0,
    }
    linea.atenciones += 1
    if (esPersona(t)) linea.personas += 1
    acumulado.set(t.tramiteId, linea)
  }

  return [...acumulado.values()].sort(
    (a, b) => b.personas - a.personas || a.tramiteNombre.localeCompare(b.tramiteNombre)
  )
}

export function porDia(turnos: TurnoVolumen[]): { fecha: string; personas: number }[] {
  const cuenta = new Map<string, number>()

  for (const t of turnos) {
    if (!esPersona(t) || !t.generadoEn) continue
    const clave = aClaveFecha(t.generadoEn)
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
  }

  return [...cuenta.entries()]
    .map(([fecha, personas]) => ({ fecha, personas }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/**
 * Siempre 24 buckets, incluidos los vacios: si el largo dependiera de los
 * datos, dos rangos seguidos dibujarian ejes distintos y la comparacion
 * visual mentiria.
 */
export function porHora(turnos: TurnoVolumen[]): { hora: number; personas: number }[] {
  const horas = Array.from({ length: 24 }, (_, hora) => ({ hora, personas: 0 }))

  for (const t of turnos) {
    if (!esPersona(t) || !t.generadoEn) continue
    horas[t.generadoEn.getHours()].personas += 1
  }

  return horas
}

/**
 * Ausentes y abandonos por tramite. A diferencia del volumen, aca SI
 * cuentan los derivados: un derivado que no se presenta en el segundo box
 * es una ausencia real de ese box, no un eco de la primera cola.
 */
export function porTramiteYEstado(
  turnos: TurnoVolumen[],
  estados: string[]
): LineaEstado[] {
  const acumulado = new Map<string, LineaEstado>()

  for (const t of turnos) {
    if (!estados.includes(t.estado)) continue
    const linea = acumulado.get(t.tramiteId) ?? {
      tramiteId: t.tramiteId,
      tramiteNombre: t.tramiteNombre,
      cuantos: 0,
    }
    linea.cuantos += 1
    acumulado.set(t.tramiteId, linea)
  }

  return [...acumulado.values()].sort(
    (a, b) => b.cuantos - a.cuantos || a.tramiteNombre.localeCompare(b.tramiteNombre)
  )
}

/**
 * La misma cuenta repartida por hora. Una tasa de ausentes que sube a
 * determinada hora suele significar que la espera paso el punto en que la
 * gente se va a hacer otra cosa.
 */
export function porHoraYEstado(
  turnos: TurnoVolumen[],
  estados: string[]
): { hora: number; cuantos: number }[] {
  const horas = Array.from({ length: 24 }, (_, hora) => ({ hora, cuantos: 0 }))

  for (const t of turnos) {
    if (!estados.includes(t.estado) || !t.generadoEn) continue
    horas[t.generadoEn.getHours()].cuantos += 1
  }

  return horas
}
