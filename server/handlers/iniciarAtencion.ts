import { aplicarComando, type ComandoTurnoBox, type ResultadoComando } from "./comandoTurno"

export function iniciarAtencion(cmd: ComandoTurnoBox): Promise<ResultadoComando> {
  return aplicarComando(cmd, "iniciado")
}
