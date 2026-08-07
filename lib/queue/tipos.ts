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
  | "fuera_de_horario"
  | "sin_boxes"

export interface Disponibilidad {
  disponible: boolean
  ventanaEfectiva: Ventana | null
  motivo: MotivoNoDisponible | null
}
