import { describe, it, expect } from "vitest"
import { transicion, TRANSICIONES } from "@/lib/queue/estado"
import type { TurnoDominio } from "@/lib/queue/tipos"

const base: TurnoDominio = {
  id: "t1",
  numero: "PM01",
  tramiteId: "tr1",
  estado: "esperando",
  boxId: null,
  createdAt: new Date("2026-08-05T10:00:00Z"),
  derivadoDeId: null,
}

describe("transicion", () => {
  it("lleva de esperando a llamado con box", () => {
    const r = transicion({ ...base }, "llamado", { boxId: "b1" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.turno.estado).toBe("llamado")
      expect(r.turno.boxId).toBe("b1")
    }
  })

  it("rechaza llamar sin box", () => {
    const r = transicion({ ...base }, "llamado", {})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("BOX_REQUERIDO")
  })

  it("rechaza cualquier transición desde finalizado", () => {
    for (const tipo of TRANSICIONES.map((t) => t.evento)) {
      const r = transicion({ ...base, estado: "finalizado" }, tipo, { boxId: "b1" })
      expect(r.ok).toBe(false)
    }
  })

  it("permite rellamar un turno llamado sin cambiar de estado", () => {
    const r = transicion({ ...base, estado: "llamado", boxId: "b1" }, "rellamado", { boxId: "b1" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("llamado")
  })

  it("permite recuperar un ausente volviéndolo a llamar", () => {
    const r = transicion({ ...base, estado: "ausente" }, "llamado", { boxId: "b2" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("llamado")
  })

  it("rechaza iniciar atención de un turno que no fue llamado", () => {
    const r = transicion({ ...base }, "iniciado", { boxId: "b1" })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("TRANSICION_INVALIDA")
  })

  it("solo abandona turnos en espera", () => {
    expect(transicion({ ...base }, "abandonado", {}).ok).toBe(true)
    expect(
      transicion({ ...base, estado: "atendiendo" }, "abandonado", {}).ok
    ).toBe(false)
  })

  it("finaliza un turno que está siendo atendido", () => {
    const r = transicion({ ...base, estado: "atendiendo" }, "finalizado", {})
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("finalizado")
  })

  it("rechaza finalizar un turno que no está siendo atendido", () => {
    const r = transicion({ ...base, estado: "esperando" }, "finalizado", {})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("TRANSICION_INVALIDA")
  })

  it("rechaza un evento desconocido", () => {
    const r = transicion({ ...base }, "algo_invalido" as any, {})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("EVENTO_DESCONOCIDO")
  })
})

describe("derivación", () => {
  it("deriva un turno en atención", () => {
    const r = transicion({ ...base, estado: "atendiendo", boxId: "b1" }, "derivado", { boxId: "b1" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("derivado")
  })

  it("deriva también un turno recién llamado, antes de iniciar la atención", () => {
    const r = transicion({ ...base, estado: "llamado", boxId: "b1" }, "derivado", { boxId: "b1" })
    expect(r.ok).toBe(true)
  })

  it("no deriva un turno que todavía está esperando", () => {
    const r = transicion({ ...base }, "derivado", { boxId: "b1" })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("TRANSICION_INVALIDA")
  })

  it("derivado es terminal: no se sale de ahí", () => {
    for (const evento of TRANSICIONES.map((t) => t.evento)) {
      const r = transicion({ ...base, estado: "derivado" }, evento, { boxId: "b1" })
      expect(r.ok).toBe(false)
    }
  })

  it("derivar exige box: es el operador quien deriva", () => {
    const r = transicion({ ...base, estado: "atendiendo" }, "derivado", {})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("BOX_REQUERIDO")
  })
})
