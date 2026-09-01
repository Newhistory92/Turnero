/**
 * Autenticacion maquina a maquina para el endpoint de metricas.
 *
 * El endpoint expone el rendimiento individual de cada operador, asi que no
 * puede ser publico como /api/catalogo. Lo consume Backend_RRHH, que no tiene
 * sesion de usuario en Turnero: por eso un token de servicio compartido y no
 * el login de operador.
 */

/**
 * Sin TURNERO_SERVICE_TOKEN configurado devuelve false para todo. Cerrado por
 * omision: un deploy al que se le olvido la variable deja el endpoint mudo, no
 * abierto.
 */
export function tokenDeServicioValido(header: string | null): boolean {
  const esperado = process.env.TURNERO_SERVICE_TOKEN
  if (!esperado) return false
  if (!header) return false
  const prefijo = "Bearer "
  if (!header.startsWith(prefijo)) return false
  return header.slice(prefijo.length) === esperado
}
