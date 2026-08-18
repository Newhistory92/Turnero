import { describe, it, expect } from "vitest"
import {
  validarNombre,
  validarFranja,
  validarDiasSemana,
  validarIcono,
  validarPrefijo,
  validarEntero,
} from "@/lib/admin/validaciones"

describe("validarNombre", () => {
  it("acepta un nombre normal", () => {
    expect(validarNombre("Prótesis")).toBeUndefined()
  })

  it("rechaza vacío y sólo espacios", () => {
    expect(validarNombre("")).toBeDefined()
    expect(validarNombre("   ")).toBeDefined()
  })
})

describe("validarFranja", () => {
  it("acepta una franja normal", () => {
    expect(validarFranja("08:00", "14:00")).toBeUndefined()
  })

  it("acepta los bordes del día", () => {
    expect(validarFranja("00:00", "23:59")).toBeUndefined()
  })

  it("rechaza formatos que no son HH:MM", () => {
    expect(validarFranja("8:00", "14:00")).toBeDefined()
    expect(validarFranja("08:00", "24:00")).toBeDefined()
    expect(validarFranja("08:60", "14:00")).toBeDefined()
    expect(validarFranja("0800", "1400")).toBeDefined()
  })

  // Una franja invertida deja el tramite disponible nunca, sin decirlo.
  it("rechaza cierre anterior o igual a apertura", () => {
    expect(validarFranja("14:00", "08:00")).toBeDefined()
    expect(validarFranja("08:00", "08:00")).toBeDefined()
  })
})

describe("validarDiasSemana", () => {
  it("acepta lunes a viernes", () => {
    expect(validarDiasSemana("12345")).toBeUndefined()
  })

  it("acepta la semana completa", () => {
    expect(validarDiasSemana("0123456")).toBeUndefined()
  })

  it("rechaza vacío", () => {
    expect(validarDiasSemana("")).toBeDefined()
  })

  it("rechaza dígitos fuera de 0-6", () => {
    expect(validarDiasSemana("1237")).toBeDefined()
    expect(validarDiasSemana("12a")).toBeDefined()
  })

  // disponibilidad.ts usa includes(dia): un dia repetido no rompe, pero
  // delata un error de carga que conviene frenar acá.
  it("rechaza repetidos", () => {
    expect(validarDiasSemana("1223")).toBeDefined()
  })
})

describe("validarIcono", () => {
  it("acepta uno del mapa", () => {
    expect(validarIcono("Stethoscope")).toBeUndefined()
  })

  // iconoPorNombre cae a FileQuestion sin avisar: sin esta validacion, un
  // icono mal tipeado se ve como un signo de pregunta en el totem.
  it("rechaza uno que no existe", () => {
    expect(validarIcono("Corazon")).toBeDefined()
    expect(validarIcono("")).toBeDefined()
  })
})

describe("validarPrefijo", () => {
  it("acepta uno válido", () => {
    expect(validarPrefijo("PRO")).toBeUndefined()
  })

  it("acepta de una a tres letras", () => {
    expect(validarPrefijo("P")).toBeUndefined()
    expect(validarPrefijo("PRO")).toBeUndefined()
  })

  it("rechaza más de tres, vacío y no alfabético", () => {
    expect(validarPrefijo("PROT")).toBeDefined()
    expect(validarPrefijo("")).toBeDefined()
    expect(validarPrefijo("P1")).toBeDefined()
  })

  it("exige mayúsculas", () => {
    expect(validarPrefijo("pro")).toBeDefined()
  })
})

describe("validarEntero", () => {
  it("acepta un valor válido", () => {
    expect(validarEntero(3, 0, 10)).toBeUndefined()
  })

  it("rechaza por debajo del mínimo", () => {
    expect(validarEntero(-1, 0, 10)).toBeDefined()
  })

  it("rechaza por encima del máximo", () => {
    expect(validarEntero(11, 0, 10)).toBeDefined()
  })

  it("rechaza NaN y no enteros", () => {
    expect(validarEntero(Number.NaN, 0, 10)).toBeDefined()
    expect(validarEntero(1.5, 0, 10)).toBeDefined()
  })
})
