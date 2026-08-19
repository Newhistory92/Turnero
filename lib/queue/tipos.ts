export type EstadoTurno =
  | "esperando"
  | "llamado"
  | "atendiendo"
  | "finalizado"
  | "derivado"
  | "ausente"
  | "abandonado"

export type TipoEvento =
  | "generado"
  | "llamado"
  | "rellamado"
  | "ausente"
  | "iniciado"
  | "finalizado"
  | "derivado"
  | "abandonado"

export interface TurnoDominio {
  id: string
  numero: string
  tramiteId: string
  estado: EstadoTurno
  boxId: string | null
  createdAt: Date
  derivadoDeId: string | null
}

export interface HorarioDominio {
  horaApertura: string
  horaCierre: string
  diasSemana: string
}

export interface BoxDominio extends HorarioDominio {
  id: string
  activo: boolean
  tramiteIds: string[]
}

export interface TramiteDominio extends HorarioDominio {
  id: string
  activo: boolean
}

export interface Ventana {
  desde: string
  hasta: string
}

export type MotivoNoDisponible =
  | "tramite_inactivo"
  /** Hoy no se atiende, o estamos en un hueco entre boxes no contiguos. */
  | "fuera_de_horario"
  /** Hoy se atendio y ya paso la ultima hora de cierre. */
  | "cerrado_por_hoy"
  | "sin_boxes"

export interface Disponibilidad {
  disponible: boolean
  ventanaEfectiva: Ventana | null
  motivo: MotivoNoDisponible | null
  /**
   * El turno se emite aunque todavia no haya abierto: la persona llego antes
   * y espera. El kiosco le avisa el horario en la pantalla del resultado.
   */
  anticipado: boolean
}
