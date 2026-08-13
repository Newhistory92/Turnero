import { describe, it, expect } from "vitest"
import { roomAla, roomPisoAla, roomBox, destinatarios } from "@/server/rooms"

describe("nombres de room", () => {
  it("normaliza el nombre del ala a minúsculas", () => {
    expect(roomAla("Norte")).toBe("ala:norte")
    expect(roomAla("Sur")).toBe("ala:sur")
  })

  it("arma la room de piso + ala", () => {
    expect(roomPisoAla("Planta Alta", "Norte")).toBe("piso:planta-alta:ala:norte")
  })

  it("arma la room del box", () => {
    expect(roomBox("abc")).toBe("box:abc")
  })
})

describe("destinatarios", () => {
  const contexto = { ala: "Norte", piso: "Planta Baja", boxId: "b1", tramiteBoxIds: ["b1", "b2"] }

  it("TURNO_LLAMADO va al ala, al piso+ala y al box", () => {
    const r = destinatarios("TURNO_LLAMADO", contexto)
    expect(r).toContain("ala:norte")
    expect(r).toContain("piso:planta-baja:ala:norte")
    expect(r).toContain("box:b1")
  })

  it("TURNO_LLAMADO del Norte nunca incluye al Sur", () => {
    const r = destinatarios("TURNO_LLAMADO", contexto)
    expect(r).not.toContain("ala:sur")
    expect(r.some((x) => x.includes("sur"))).toBe(false)
  })

  it("TURNO_GENERADO va al kiosco y a todos los boxes que atienden el trámite", () => {
    const r = destinatarios("TURNO_GENERADO", contexto)
    expect(r).toContain("kiosco")
    expect(r).toContain("box:b1")
    expect(r).toContain("box:b2")
  })

  it("CATALOGO_ACTUALIZADO va a todos", () => {
    expect(destinatarios("CATALOGO_ACTUALIZADO", contexto)).toEqual(["*"])
  })

  it("admin recibe todos los eventos de turno", () => {
    for (const ev of ["TURNO_GENERADO", "TURNO_LLAMADO", "TURNO_FINALIZADO"] as const) {
      expect(destinatarios(ev, contexto)).toContain("admin")
    }
  })
})

describe("ruteo de TURNO_DERIVADO", () => {
  it("avisa al box que derivó y a los que atienden el trámite destino", () => {
    const rooms = destinatarios("TURNO_DERIVADO", {
      ala: "Sur",
      piso: "Planta Baja",
      boxId: "box-origen",
      tramiteBoxIds: ["box-destino-1", "box-destino-2"],
    })
    expect(rooms).toContain("box:box-origen")
    expect(rooms).toContain("box:box-destino-1")
    expect(rooms).toContain("box:box-destino-2")
    expect(rooms).toContain("admin")
  })
})
