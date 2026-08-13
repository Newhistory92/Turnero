import { aplicarComando, type ComandoTurnoBox, type ResultadoComando } from "./comandoTurno"

// Sin umbral de duracion: el hallazgo 4 del diseño general era que solo se
// registraban atenciones de 7 minutos o mas, y eso sesgaba las estadisticas.
export function finalizarAtencion(cmd: ComandoTurnoBox): Promise<ResultadoComando> {
  return aplicarComando(cmd, "finalizado")
}
