import { describe, it, expect } from "vitest"
import { debeSonar } from "@/app/pantalla/usarCampanilla"

describe("debeSonar", () => {
  it("no suena en la carga inicial, aunque ya haya llamados del día", () => {
    expect(debeSonar(undefined, "e5")).toBe(false)
  })

  it("no suena en la carga inicial sin llamados", () => {
    expect(debeSonar(undefined, null)).toBe(false)
  })

  // Distinto de la carga inicial: acá ya hubo snapshot y estaba vacío.
  it("el primer llamado del día sí suena", () => {
    expect(debeSonar(null, "e1")).toBe(true)
  })

  it("suena cuando entra un llamado nuevo", () => {
    expect(debeSonar("e1", "e2")).toBe(true)
  })

  it("no suena al reconectar si nadie llamó mientras tanto", () => {
    expect(debeSonar("e1", "e1")).toBe(false)
  })

  // Rellamar produce un TurnoEvento nuevo aunque el turno sea el mismo, y el
  // sentido de rellamar es volver a llamar la atención.
  it("suena en el rellamado del mismo turno", () => {
    expect(debeSonar("evento-llamado", "evento-rellamado")).toBe(true)
  })

  it("no suena si el actual queda vacío", () => {
    expect(debeSonar("e1", null)).toBe(false)
  })
})
