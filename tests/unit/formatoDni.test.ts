import { describe, it, expect } from "vitest"
import { formatearDni, dniEsValido, MAX_DIGITOS_DNI } from "@/lib/kiosco/dni"

describe("formatearDni", () => {
  it("agrupa de a tres desde la derecha", () => {
    expect(formatearDni("20123456")).toBe("20.123.456")
  })
  it("formatea parciales sin romperse", () => {
    expect(formatearDni("2")).toBe("2")
    expect(formatearDni("2012")).toBe("2.012")
  })
  it("con string vacío devuelve vacío", () => {
    expect(formatearDni("")).toBe("")
  })
})

describe("dniEsValido", () => {
  it("acepta de 7 a 9 dígitos", () => {
    expect(dniEsValido("1234567")).toBe(true)
    expect(dniEsValido("20123456")).toBe(true)
    expect(dniEsValido("201234567")).toBe(true)
  })
  it("rechaza menos de 7", () => {
    expect(dniEsValido("123456")).toBe(false)
  })
  it("rechaza vacío", () => {
    expect(dniEsValido("")).toBe(false)
  })
  it("el máximo de dígitos es 9", () => {
    expect(MAX_DIGITOS_DNI).toBe(9)
  })
})
