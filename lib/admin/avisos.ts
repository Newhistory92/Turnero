/**
 * Aviso, no error. Tramite.destinoAla y el ala de los boxes que lo atienden
 * son redundantes a proposito: si el tramite se queda momentaneamente sin
 * boxes abiertos, el ticket igual tiene que decir adonde ir. Por eso una
 * discrepancia se muestra y no se bloquea, y por eso un tramite sin boxes no
 * genera ningun aviso.
 */
export function avisoDestino(
  destinoAla: string,
  alasDeBoxes: string[]
): string | null {
  const ajenas = [...new Set(alasDeBoxes.filter((a) => a !== destinoAla))]
  if (ajenas.length === 0) return null

  return `El ticket dice ${destinoAla}, pero hay boxes en ${ajenas.join(", ")}`
}
