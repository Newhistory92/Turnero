import { describe, it, expect } from "vitest"
import { accionDeTecla } from "@/app/operador/usarAtajos"

describe("atajos del panel", () => {
  it("Enter recorre el camino feliz según el estado", () => {
    expect(accionDeTecla("Enter", "sin-turno")).toBe("llamar")
    expect(accionDeTecla("Enter", "llamado")).toBe("iniciar")
    expect(accionDeTecla("Enter", "atendiendo")).toBe("finalizar")
  })

  it("las letras disparan las acciones secundarias", () => {
    expect(accionDeTecla("r", "llamado")).toBe("rellamar")
    expect(accionDeTecla("a", "llamado")).toBe("ausente")
    expect(accionDeTecla("d", "llamado")).toBe("derivar")
  })

  it("acepta mayúsculas", () => {
    expect(accionDeTecla("R", "llamado")).toBe("rellamar")
  })

  it("no permite rellamar ni marcar ausente lo que ya se está atendiendo", () => {
    expect(accionDeTecla("r", "atendiendo")).toBeNull()
    expect(accionDeTecla("a", "atendiendo")).toBeNull()
  })

  it("sin turno, sólo se puede llamar", () => {
    expect(accionDeTecla("r", "sin-turno")).toBeNull()
    expect(accionDeTecla("a", "sin-turno")).toBeNull()
    expect(accionDeTecla("d", "sin-turno")).toBeNull()
  })

  it("Enter nunca dispara ausente ni derivar: no se pueden deshacer", () => {
    for (const estado of ["sin-turno", "llamado", "atendiendo"] as const) {
      const accion = accionDeTecla("Enter", estado)
      expect(accion).not.toBe("ausente")
      expect(accion).not.toBe("derivar")
    }
  })

  it("ignora teclas que no son atajos", () => {
    expect(accionDeTecla("z", "llamado")).toBeNull()
    expect(accionDeTecla(" ", "llamado")).toBeNull()
  })
})
