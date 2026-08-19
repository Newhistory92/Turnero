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
    expect(r.motivo).toBe("cerrado_por_hoy")
    expect(r.ventanaEfectiva).toEqual({ desde: "08:00", hasta: "12:00" })
  })

  it("antes de abrir emite igual, marcado como anticipado y con la ventana del día", () => {
    const r = estaDisponible(tramite, [box], miercoles("07:00"))
    expect(r.disponible).toBe(true)
    expect(r.anticipado).toBe(true)
    expect(r.motivo).toBeNull()
    expect(r.ventanaEfectiva).toEqual({ desde: "08:00", hasta: "12:00" })
  })

  it("dentro del horario emite sin marcar anticipado", () => {
    const r = estaDisponible(tramite, [box], miercoles("10:00"))
    expect(r.disponible).toBe(true)
    expect(r.anticipado).toBe(false)
  })

  it("después del cierre no emite y nunca queda marcado como anticipado", () => {
    const r = estaDisponible(tramite, [box], miercoles("12:30"))
    expect(r.anticipado).toBe(false)
  })

  it("un día no habilitado no cuenta como anticipado", () => {
    const r = estaDisponible(tramite, [box], domingo("07:00"))
    expect(r.disponible).toBe(false)
    expect(r.anticipado).toBe(false)
    expect(r.motivo).toBe("fuera_de_horario")
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

  it("no emite si el box está activo pero su horario no se solapa con el del trámite", () => {
    const sinSolape: BoxDominio = { ...box, horaApertura: "14:00", horaCierre: "15:00" }
    const r = estaDisponible(tramite, [sinSolape], miercoles("14:30"))
    expect(r.disponible).toBe(false)
    expect(r.motivo).toBe("sin_boxes")
    expect(r.ventanaEfectiva).toBeNull()
  })

  it("no emite si el único box con horas solapadas no trabaja hoy (bug de correlación día/horario)", () => {
    // Box A: solapa totalmente con el trámite, pero no trabaja los lunes.
    const boxA: BoxDominio = {
      ...box,
      id: "boxA",
      horaApertura: "08:00",
      horaCierre: "17:00",
      diasSemana: "23456", // martes a sábado
    }
    // Box B: trabaja los lunes, pero sus horas no se solapan con el trámite.
    const boxB: BoxDominio = {
      ...box,
      id: "boxB",
      horaApertura: "20:00",
      horaCierre: "21:00",
      diasSemana: "123456", // lunes a sábado
    }
    // 2026-08-03 es lunes (día ISO 1): boxA cerrado, boxB abierto pero sin horas útiles.
    const lunes = new Date("2026-08-03T10:00:00")
    const r = estaDisponible(tramite, [boxA, boxB], lunes)
    expect(r.disponible).toBe(false)
  })

  it("no emite en el hueco entre dos boxes con horarios no contiguos (bug de merge de ventanas)", () => {
    const boxA: BoxDominio = {
      ...box,
      id: "boxA",
      horaApertura: "08:00",
      horaCierre: "09:00",
    }
    const boxB: BoxDominio = {
      ...box,
      id: "boxB",
      horaApertura: "11:00",
      horaCierre: "12:00",
    }
    const enElHueco = estaDisponible(tramite, [boxA, boxB], miercoles("10:00"))
    expect(enElHueco.disponible).toBe(false)

    const dentroDeA = estaDisponible(tramite, [boxA, boxB], miercoles("08:30"))
    expect(dentroDeA.disponible).toBe(true)

    const dentroDeB = estaDisponible(tramite, [boxA, boxB], miercoles("11:30"))
    expect(dentroDeB.disponible).toBe(true)
  })

  it("el hueco entre boxes no es 'cerrado por hoy' ni anticipado: todavía se vuelve a atender", () => {
    const boxA: BoxDominio = { ...box, id: "boxA", horaApertura: "08:00", horaCierre: "09:00" }
    const boxB: BoxDominio = { ...box, id: "boxB", horaApertura: "11:00", horaCierre: "12:00" }

    const enElHueco = estaDisponible(tramite, [boxA, boxB], miercoles("10:00"))
    expect(enElHueco.disponible).toBe(false)
    expect(enElHueco.anticipado).toBe(false)
    expect(enElHueco.motivo).toBe("fuera_de_horario")

    // Antes del primer grupo sí es anticipado, aunque después haya un hueco.
    const antesDeTodo = estaDisponible(tramite, [boxA, boxB], miercoles("07:00"))
    expect(antesDeTodo.disponible).toBe(true)
    expect(antesDeTodo.anticipado).toBe(true)

    // Después del último grupo sí cerró por hoy.
    const despuesDeTodo = estaDisponible(tramite, [boxA, boxB], miercoles("12:30"))
    expect(despuesDeTodo.disponible).toBe(false)
    expect(despuesDeTodo.motivo).toBe("cerrado_por_hoy")
  })

  it("la ventana efectiva nunca abarca el hueco entre boxes no contiguos", () => {
    const boxA: BoxDominio = { ...box, id: "boxA", horaApertura: "08:00", horaCierre: "09:00" }
    const boxB: BoxDominio = { ...box, id: "boxB", horaApertura: "11:00", horaCierre: "12:00" }

    // En el hueco (10:00): la ventana mostrada es la mas cercana, nunca
    // 08:00-12:00 (eso implicaria cobertura falsa entre 09:00 y 11:00).
    const enElHueco = estaDisponible(tramite, [boxA, boxB], miercoles("10:00"))
    expect(enElHueco.ventanaEfectiva).not.toEqual({ desde: "08:00", hasta: "12:00" })
    expect(enElHueco.ventanaEfectiva).toEqual({ desde: "08:00", hasta: "09:00" })

    // Dentro de A: la ventana mostrada es la de A, no la union con B.
    const dentroDeA = estaDisponible(tramite, [boxA, boxB], miercoles("08:30"))
    expect(dentroDeA.ventanaEfectiva).toEqual({ desde: "08:00", hasta: "09:00" })

    // Dentro de B: la ventana mostrada es la de B, no la union con A.
    const dentroDeB = estaDisponible(tramite, [boxA, boxB], miercoles("11:30"))
    expect(dentroDeB.ventanaEfectiva).toEqual({ desde: "11:00", hasta: "12:00" })
  })
})
