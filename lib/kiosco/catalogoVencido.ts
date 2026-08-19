/**
 * Si el kiosco puede recargar el catalogo ahora mismo sin arruinarle el
 * tramite a nadie. Recargar de golpe a alguien que esta en el medio del
 * wizard le borra lo que hizo y lo devuelve al inicio sin explicacion; el
 * cambio se aplica cuando termina o cuando salta la inactividad.
 */
export function sePuedeRefrescar(paso: string, dni: string): boolean {
  if (paso === "error") return true
  return paso === "dni" && dni === ""
}
