import type { BoxDominio, TurnoDominio } from "./tipos"

/** Turnos en espera que este box puede atender, del mas antiguo al mas nuevo. */
export function colaDelBox(turnos: TurnoDominio[], box: BoxDominio): TurnoDominio[] {
  return turnos
    .filter((t) => t.estado === "esperando" && box.tramiteIds.includes(t.tramiteId))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

/** FIFO estricta por antiguedad entre todos los tramites del box. */
export function siguienteTurno(
  turnos: TurnoDominio[],
  box: BoxDominio
): TurnoDominio | null {
  return colaDelBox(turnos, box)[0] ?? null
}
