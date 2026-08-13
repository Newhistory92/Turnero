import { aplicarComando, type ComandoTurnoBox, type ResultadoComando } from "./comandoTurno"

export function marcarAusente(cmd: ComandoTurnoBox): Promise<ResultadoComando> {
  return aplicarComando(cmd, "ausente")
}
