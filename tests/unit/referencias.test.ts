import { describe, it, expect } from "vitest"
import { sePuedeBorrar } from "@/lib/admin/referencias"

describe("sePuedeBorrar", () => {
  it("sin referencias, se puede", () => {
    expect(sePuedeBorrar({ turnos: 0, sesiones: 0, tramites: 0, boxes: 0 })).toBe(true)
  })

  it("sin ninguna clave, se puede", () => {
    expect(sePuedeBorrar({})).toBe(true)
  })

  it("una sola referencia alcanza para bloquear", () => {
    expect(sePuedeBorrar({ turnos: 1, sesiones: 0, tramites: 0, boxes: 0 })).toBe(false)
  })

  it("bloquea aunque la referencia esté en la última clave", () => {
    expect(sePuedeBorrar({ turnos: 0, sesiones: 0, tramites: 0, boxes: 3 })).toBe(false)
  })
})
