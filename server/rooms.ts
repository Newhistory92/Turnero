export type EventoTurnero =
  | "TURNO_GENERADO"
  | "TURNO_LLAMADO"
  | "TURNO_RELLAMADO"
  | "TURNO_AUSENTE"
  | "TURNO_INICIADO"
  | "TURNO_FINALIZADO"
  | "TURNO_DERIVADO"
  | "CATALOGO_ACTUALIZADO"

export interface ContextoEvento {
  ala: string
  piso: string
  boxId: string | null
  tramiteBoxIds: string[]
}

export const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")

export const ROOM_KIOSCO = "kiosco"
export const ROOM_ADMIN = "admin"
export const TODOS = "*"

export const roomAla = (ala: string) => `ala:${slug(ala)}`
export const roomPisoAla = (piso: string, ala: string) =>
  `piso:${slug(piso)}:ala:${slug(ala)}`
export const roomBox = (boxId: string) => `box:${boxId}`

/** A que rooms se emite cada evento. Unico lugar donde vive esa decision. */
export function destinatarios(
  evento: EventoTurnero,
  ctx: ContextoEvento
): string[] {
  if (evento === "CATALOGO_ACTUALIZADO") return [TODOS]

  const rooms = new Set<string>([ROOM_ADMIN])

  switch (evento) {
    case "TURNO_GENERADO":
      rooms.add(ROOM_KIOSCO)
      ctx.tramiteBoxIds.forEach((id) => rooms.add(roomBox(id)))
      break

    case "TURNO_LLAMADO":
    case "TURNO_RELLAMADO":
      rooms.add(roomAla(ctx.ala))
      rooms.add(roomPisoAla(ctx.piso, ctx.ala))
      if (ctx.boxId) rooms.add(roomBox(ctx.boxId))
      break

    // Los tres eventos que sacan un turno del estado "llamado". La TV del ala
    // los necesita: sin ellos sigue mostrando en grande a alguien que ya esta
    // sentado en el box. TURNO_FINALIZADO no entra porque solo puede venir de
    // "atendiendo", y para entonces el turno ya bajo a la lista de anteriores.
    case "TURNO_INICIADO":
    case "TURNO_AUSENTE":
    case "TURNO_DERIVADO":
      rooms.add(roomAla(ctx.ala))
      if (ctx.boxId) rooms.add(roomBox(ctx.boxId))
      ctx.tramiteBoxIds.forEach((id) => rooms.add(roomBox(id)))
      break

    case "TURNO_FINALIZADO":
      if (ctx.boxId) rooms.add(roomBox(ctx.boxId))
      ctx.tramiteBoxIds.forEach((id) => rooms.add(roomBox(id)))
      break
  }

  return [...rooms]
}
