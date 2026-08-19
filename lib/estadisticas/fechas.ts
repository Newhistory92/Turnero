/**
 * Fecha local en YYYY-MM-DD. No pasa por toISOString a proposito: en -03:00
 * un turno de las 22:00 ya es del dia siguiente en UTC y se contaria en el
 * dia equivocado.
 *
 * Vive en su propio archivo porque lo necesitan volumen.ts y rango.ts, y
 * dos copias se desincronizarian la primera vez que alguien toque una.
 */
export function aClaveFecha(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  const dia = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mes}-${dia}`
}
