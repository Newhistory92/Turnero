export interface TurnoDerivacion {
  id: string
  numero: string
  tramiteId: string
  tramiteNombre: string
  derivadoDeId: string | null
}

export interface ParDerivacion {
  origenTramiteId: string
  origenNombre: string
  destinoTramiteId: string
  destinoNombre: string
  cuantas: number
}

export interface Cadena {
  turnoIds: string[]
  numero: string
  tramiteNombres: string[]
}

/**
 * El par sale de la relacion, no del campo `detalle` del evento: el turno
 * destino ya conoce su tramiteId y su derivadoDeId. El detalle queda como
 * respaldo de auditoria, no como fuente de la metrica.
 */
export function pares(turnos: TurnoDerivacion[]): ParDerivacion[] {
  const porId = new Map(turnos.map((t) => [t.id, t]))
  const acumulado = new Map<string, ParDerivacion>()

  for (const destino of turnos) {
    if (!destino.derivadoDeId) continue
    const origen = porId.get(destino.derivadoDeId)
    // El origen puede haber quedado fuera del rango consultado: sin el no
    // se puede nombrar el par, y inventarlo seria peor que omitirlo.
    if (!origen) continue

    const clave = `${origen.tramiteId}->${destino.tramiteId}`
    const par = acumulado.get(clave) ?? {
      origenTramiteId: origen.tramiteId,
      origenNombre: origen.tramiteNombre,
      destinoTramiteId: destino.tramiteId,
      destinoNombre: destino.tramiteNombre,
      cuantas: 0,
    }
    par.cuantas += 1
    acumulado.set(clave, par)
  }

  return [...acumulado.values()].sort(
    (a, b) => b.cuantas - a.cuantas || a.origenNombre.localeCompare(b.origenNombre)
  )
}

/**
 * Cadenas de `minimo` turnos o mas. Solo las hojas generan cadena: contando
 * desde cada nodo, una cadena de cuatro se reportaria tambien como su
 * sub-cadena de tres y el conteo se inflaria.
 */
export function cadenas(turnos: TurnoDerivacion[], minimo = 3): Cadena[] {
  const porId = new Map(turnos.map((t) => [t.id, t]))
  const tienenHijo = new Set(
    turnos.map((t) => t.derivadoDeId).filter((id): id is string => id !== null)
  )

  const resultado: Cadena[] = []

  for (const hoja of turnos) {
    if (tienenHijo.has(hoja.id)) continue

    const camino: TurnoDerivacion[] = []
    let actual: TurnoDerivacion | undefined = hoja
    const vistos = new Set<string>()

    // El guard de `vistos` protege contra un ciclo en los datos: sin el,
    // una fila corrupta que se apunte a si misma colgaria el proceso.
    while (actual && !vistos.has(actual.id)) {
      vistos.add(actual.id)
      camino.unshift(actual)
      actual = actual.derivadoDeId ? porId.get(actual.derivadoDeId) : undefined
    }

    if (camino.length >= minimo) {
      resultado.push({
        turnoIds: camino.map((t) => t.id),
        numero: camino[0].numero,
        tramiteNombres: camino.map((t) => t.tramiteNombre),
      })
    }
  }

  return resultado.sort((a, b) => b.turnoIds.length - a.turnoIds.length)
}
