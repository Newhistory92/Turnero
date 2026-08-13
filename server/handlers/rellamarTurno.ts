import { aplicarComando, type ComandoTurnoBox, type ResultadoComando } from "./comandoTurno"

export type { ComandoTurnoBox, ResultadoComando }

export function rellamarTurno(cmd: ComandoTurnoBox): Promise<ResultadoComando> {
  return aplicarComando(cmd, "rellamado")
}
