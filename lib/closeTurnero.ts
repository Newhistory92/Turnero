export function estaFueraDeHorario(horaApertura: string, horaCierre: string) {
  const ahora = new Date()
  const [horaA, minA] = horaApertura.split(":").map(Number)
  const [horaC, minC] = horaCierre.split(":").map(Number)

  const apertura = new Date(ahora)
  apertura.setHours(horaA, minA, 0, 0)

  const cierre = new Date(ahora)
  cierre.setHours(horaC, minC, 0, 0)

  return ahora < apertura || ahora > cierre
}


