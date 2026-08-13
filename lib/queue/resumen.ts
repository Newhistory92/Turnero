import type { TurnoDominio, BoxDominio } from "./tipos"
import { colaDelBox } from "./seleccion"

export interface LineaResumen {
  tramiteId: string
  tramiteNombre: string
  categoriaNombre: string
  cuantos: number
}

export interface ResumenCola {
  total: number
  lineas: LineaResumen[]
  esperaMasVieja: number | null
}

export function resumirCola(
  turnos: TurnoDominio[],
  box: BoxDominio,
  nombres: Map<string, { tramite: string; categoria: string }>,
  ahora: Date = new Date()
): ResumenCola {
  // colaDelBox ya filtra por estado esperando y por los tramites del box,
  // y devuelve ordenado del mas viejo al mas nuevo.
  const cola = colaDelBox(turnos, box)

  const cuenta = new Map<string, number>()
  for (const t of cola) {
    cuenta.set(t.tramiteId, (cuenta.get(t.tramiteId) ?? 0) + 1)
  }

  const lineas: LineaResumen[] = [...cuenta.entries()]
    .map(([tramiteId, cuantos]) => ({
      tramiteId,
      tramiteNombre: nombres.get(tramiteId)?.tramite ?? tramiteId,
      categoriaNombre: nombres.get(tramiteId)?.categoria ?? "",
      cuantos,
    }))
    .sort((a, b) => b.cuantos - a.cuantos || a.tramiteNombre.localeCompare(b.tramiteNombre))

  const masViejo = cola[0]
  const esperaMasVieja = masViejo
    ? Math.floor((ahora.getTime() - masViejo.createdAt.getTime()) / 60000)
    : null

  return { total: cola.length, lineas, esperaMasVieja }
}
