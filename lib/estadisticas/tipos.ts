/**
 * Que tramites puede ver quien esta consultando. El tipo distingue "todos"
 * de "ninguno" a proposito: con un string[] plano, un array vacio se leeria
 * como "sin filtro" por accidente, que es exactamente el error que no
 * queremos cometer en silencio en un limite de autorizacion.
 */
export type Alcance =
  | { tipo: "todos" }
  | { tipo: "limitado"; tramiteIds: string[] }

export interface RangoFechas {
  desde: Date
  hasta: Date
}

export type Clasificacion = "anomalia" | "breve" | "valida"
