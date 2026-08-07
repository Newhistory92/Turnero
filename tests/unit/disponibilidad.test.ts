import { describe, it, expect } from "vitest"
import { estaDisponible } from "@/lib/queue/disponibilidad"
import type { BoxDominio, TramiteDominio } from "@/lib/queue/tipos"

const tramite: TramiteDominio = {
  id: "tr1",
  activo: true,
  horaApertura: "08:00",
  horaCierre: "13:00",
  diasSemana: "12345",
}

const box: BoxDominio = {
  id: "b1",
  activo: true,
  horaApertura: "08:00",
  horaCierre: "12:00",
  diasSemana: "12345",
  tramiteIds: ["tr1"],
}

// 2026-08-05 es miercoles (dia ISO 3)
const miercoles = (hhmm: string) => new Date(`2026-08-05T${hhmm}:00`)
const domingo = (hhmm: string) => new Date(`2026-08-09T${hhmm}:00`)

describe("estaDisponible", () => {
  it("la ventana efectiva es la intersección de trámite y box", () => {
    const r = estaDisponible(tramite, [box], miercoles("10:00"))
    expect(r.disponible).toBe(true)
    expect(r.ventanaEfectiva).toEqual({ desde: "08:00", hasta: "12:00" })
  })

  it("no emite a las 12:30 aunque el trámite cierre a las 13:00", () => {
    const r = estaDisponible(tramite, [box], miercoles("12:30"))
    expect(r.disponible).toBe(false)
    expect(r.motivo).toBe("fuera_de_horario")
    expect(r.ventanaEfectiva).toEqual({ desde: "08:00", hasta: "12:00" })
  })

  it("emite en el minuto exacto de apertura", () => {
    expect(estaDisponible(tramite, [box], miercoles("08:00")).disponible).toBe(true)
  })

  it("no emite en el minuto exacto de cierre", () => {
    expect(estaDisponible(tramite, [box], miercoles("12:00")).disponible).toBe(false)
  })

  it("no emite un día no habilitado", () => {
    const r = estaDisponible(tramite, [box], domingo("10:00"))
    expect(r.disponible).toBe(false)
    expect(r.motivo).toBe("fuera_de_horario")
  })

  it("no emite si el trámite está inactivo", () => {
    const r = estaDisponible({ ...tramite, activo: false }, [box], miercoles("10:00"))
    expect(r.disponible).toBe(false)
    expect(r.motivo).toBe("tramite_inactivo")
  })

  it("no emite si no hay boxes asignados", () => {
    const r = estaDisponible(tramite, [], miercoles("10:00"))
    expect(r.disponible).toBe(false)
    expect(r.motivo).toBe("sin_boxes")
  })

  it("no emite si todos los boxes están desactivados", () => {
    const r = estaDisponible(tramite, [{ ...box, activo: false }], miercoles("10:00"))
    expect(r.disponible).toBe(false)
    expect(r.motivo).toBe("sin_boxes")
  })

  it("con dos boxes toma la ventana más amplia", () => {
    const tarde: BoxDominio = { ...box, id: "b2", horaApertura: "09:00", horaCierre: "13:00" }
    const r = estaDisponible(tramite, [box, tarde], miercoles("12:30"))
    expect(r.disponible).toBe(true)
    expect(r.ventanaEfectiva).toEqual({ desde: "08:00", hasta: "13:00" })
  })
})
