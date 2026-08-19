import type { Clasificacion } from "./tipos"
import { mediana, promedio } from "./volumen"

export interface AtencionEmpleado {
  empleadoId: string
  empleadoNombre: string
  tramiteId: string
  atencionSegundos: number | null
  clasificacion: Clasificacion | null
}

export interface LineaProductividad {
  empleadoId: string
  empleadoNombre: string
  atendidos: number
  validas: number
  breves: number
  anomalias: number
  tiempoTotalSegundos: number
  promedioSegundos: number | null
  /**
   * Promedio de (atencion - mediana del mismo tramite) sobre las validas.
   * Positivo = mas lento que la mediana; negativo = mas rapido.
   */
  desvioContraMedianaSegundos: number | null
}

/**
 * Mediana de cada tramite sobre sus atenciones validas. Incluir breves y
 * anomalias la arrastraria hacia abajo y todo el mundo pareceria lento
 * contra ella.
 */
export function medianasPorTramite(atenciones: AtencionEmpleado[]): Map<string, number> {
  const porTramite = new Map<string, number[]>()

  for (const at of atenciones) {
    if (at.clasificacion !== "valida" || at.atencionSegundos === null) continue
    const lista = porTramite.get(at.tramiteId) ?? []
    lista.push(at.atencionSegundos)
    porTramite.set(at.tramiteId, lista)
  }

  const medianas = new Map<string, number>()
  for (const [tramiteId, valores] of porTramite) {
    const m = mediana(valores)
    if (m !== null) medianas.set(tramiteId, m)
  }
  return medianas
}

export function porEmpleado(atenciones: AtencionEmpleado[]): LineaProductividad[] {
  const medianas = medianasPorTramite(atenciones)
  const acumulado = new Map<string, LineaProductividad>()
  const desvios = new Map<string, number[]>()

  for (const at of atenciones) {
    const linea = acumulado.get(at.empleadoId) ?? {
      empleadoId: at.empleadoId,
      empleadoNombre: at.empleadoNombre,
      atendidos: 0,
      validas: 0,
      breves: 0,
      anomalias: 0,
      tiempoTotalSegundos: 0,
      promedioSegundos: null,
      desvioContraMedianaSegundos: null,
    }

    linea.atendidos += 1
    if (at.atencionSegundos !== null) linea.tiempoTotalSegundos += at.atencionSegundos
    if (at.clasificacion === "valida") linea.validas += 1
    if (at.clasificacion === "breve") linea.breves += 1
    if (at.clasificacion === "anomalia") linea.anomalias += 1

    acumulado.set(at.empleadoId, linea)

    const medianaTramite = medianas.get(at.tramiteId)
    if (
      at.clasificacion === "valida" &&
      at.atencionSegundos !== null &&
      medianaTramite !== undefined
    ) {
      const lista = desvios.get(at.empleadoId) ?? []
      lista.push(at.atencionSegundos - medianaTramite)
      desvios.set(at.empleadoId, lista)
    }
  }

  // Los tiempos por empleado se promedian sobre las atenciones que tienen
  // tiempo: dividir por `atendidos` incluiria las derivadas sin iniciar y
  // bajaria el promedio sin motivo.
  for (const [empleadoId, linea] of acumulado) {
    const conTiempo = atenciones
      .filter((at) => at.empleadoId === empleadoId)
      .map((at) => at.atencionSegundos)
    linea.promedioSegundos = promedio(conTiempo)
    linea.desvioContraMedianaSegundos = promedio(desvios.get(empleadoId) ?? [])
  }

  return [...acumulado.values()].sort(
    (a, b) => b.atendidos - a.atendidos || a.empleadoNombre.localeCompare(b.empleadoNombre)
  )
}
