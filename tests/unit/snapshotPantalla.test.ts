import { describe, it, expect } from "vitest"
import { proyectarLlamados, type FilaLlamado } from "@/server/snapshotPantalla"

const fila = (over: Partial<FilaLlamado> = {}): FilaLlamado => ({
  eventoId: "e1",
  numero: "P01",
  boxNombre: "Box 3",
  nombreAfiliado: "González, María",
  dni: "20123456",
  timestamp: new Date("2026-08-14T14:32:00Z"),
  estadoTurno: "llamado",
  ...over,
})

describe("proyectarLlamados", () => {
  it("sin llamados, no hay actual ni anteriores", () => {
    const s = proyectarLlamados("Norte", [])
    expect(s.ala).toBe("Norte")
    expect(s.actual).toBeNull()
    expect(s.ultimos).toEqual([])
  })

  it("la primera fila es el llamado actual", () => {
    const s = proyectarLlamados("Norte", [fila({ eventoId: "e9", numero: "T04" })])
    expect(s.actual?.eventoId).toBe("e9")
    expect(s.actual?.numero).toBe("T04")
    expect(s.ultimos).toEqual([])
  })

  it("los anteriores son los que siguen, tope de cuatro", () => {
    const filas = ["e1", "e2", "e3", "e4", "e5", "e6", "e7"].map((id) => fila({ eventoId: id }))
    const s = proyectarLlamados("Norte", filas)
    expect(s.actual?.eventoId).toBe("e1")
    expect(s.ultimos.map((l) => l.eventoId)).toEqual(["e2", "e3", "e4", "e5"])
  })

  it("identifica por nombre cuando el afiliado está en el padrón", () => {
    const s = proyectarLlamados("Norte", [fila()])
    expect(s.actual?.identificacion).toBe("González, María")
  })

  it("cae al DNI cuando no hay nombre cargado", () => {
    const s = proyectarLlamados("Norte", [fila({ nombreAfiliado: null })])
    expect(s.actual?.identificacion).toBe("20123456")
  })

  it("sin nombre ni DNI, la identificación queda vacía", () => {
    const s = proyectarLlamados("Norte", [fila({ nombreAfiliado: null, dni: null })])
    expect(s.actual?.identificacion).toBeNull()
  })

  it("nunca expone el trámite: la pantalla es pública", () => {
    const s = proyectarLlamados("Norte", [fila()])
    expect(Object.keys(s.actual!).sort()).toEqual(
      ["boxNombre", "eventoId", "identificacion", "llamadoEn", "numero"]
    )
  })

  it("atendido deja de ser el actual y baja a los anteriores", () => {
    const s = proyectarLlamados("Norte", [
      fila({ eventoId: "e1", numero: "P01", estadoTurno: "atendiendo" }),
      fila({ eventoId: "e2", numero: "T04" }),
    ])
    expect(s.actual).toBeNull()
    expect(s.ultimos.map((l) => l.numero)).toEqual(["P01", "T04"])
  })

  it("ausente y derivado tampoco siguen llamandose", () => {
    for (const e of ["ausente", "derivado", "finalizado"]) {
      const s = proyectarLlamados("Norte", [fila({ estadoTurno: e })])
      expect(s.actual, `estado ${e}`).toBeNull()
      expect(s.ultimos).toHaveLength(1)
    }
  })

  it("finalizar no revive el llamado", () => {
    // El bug: el turno pasaba por atendiendo, se finalizaba, y el numero volvia
    // a aparecer llamando en grande porque la proyeccion trataba todo estado
    // que no fuera "atendiendo" como si el turno siguiera esperando.
    const s = proyectarLlamados("Norte", [fila({ numero: "P01", estadoTurno: "finalizado" })])
    expect(s.actual).toBeNull()
  })

  it("sin actual, los anteriores igual topean en cuatro", () => {
    const filas = ["e1", "e2", "e3", "e4", "e5"].map((id) => fila({ eventoId: id }))
    filas[0].estadoTurno = "atendiendo"
    const s = proyectarLlamados("Norte", filas)
    expect(s.actual).toBeNull()
    expect(s.ultimos.map((l) => l.eventoId)).toEqual(["e1", "e2", "e3", "e4"])
  })

  it("el nombre y el DNI nunca aparecen juntos", () => {
    const s = proyectarLlamados("Norte", [fila()])
    expect(s.actual?.identificacion).not.toContain("20123456")
  })
})
