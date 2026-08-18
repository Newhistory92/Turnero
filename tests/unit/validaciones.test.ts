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
    expect(validarNombre("nombre", "Prótesis")).toBeNull()
  })

  it("rechaza vacío y sólo espacios", () => {
    expect(validarNombre("nombre", "")?.campo).toBe("nombre")
    expect(validarNombre("nombre", "   ")?.campo).toBe("nombre")
  })
})

describe("validarFranja", () => {
  it("acepta una franja normal", () => {
    expect(validarFranja("08:00", "14:00")).toBeNull()
  })

  it("acepta los bordes del día", () => {
    expect(validarFranja("00:00", "23:59")).toBeNull()
  })

  it("rechaza formatos que no son HH:MM", () => {
    expect(validarFranja("8:00", "14:00")).not.toBeNull()
    expect(validarFranja("08:00", "24:00")).not.toBeNull()
    expect(validarFranja("08:60", "14:00")).not.toBeNull()
    expect(validarFranja("0800", "1400")).not.toBeNull()
  })

  // Una franja invertida deja el tramite disponible nunca, sin decirlo.
  it("rechaza cierre anterior o igual a apertura", () => {
    expect(validarFranja("14:00", "08:00")).not.toBeNull()
    expect(validarFranja("08:00", "08:00")).not.toBeNull()
  })
})

describe("validarDiasSemana", () => {
  it("acepta lunes a viernes", () => {
    expect(validarDiasSemana("12345")).toBeNull()
  })

  it("acepta la semana completa", () => {
    expect(validarDiasSemana("0123456")).toBeNull()
  })

  it("rechaza vacío", () => {
    expect(validarDiasSemana("")).not.toBeNull()
  })

  it("rechaza dígitos fuera de 0-6", () => {
    expect(validarDiasSemana("1237")).not.toBeNull()
    expect(validarDiasSemana("12a")).not.toBeNull()
  })

  // disponibilidad.ts usa includes(dia): un dia repetido no rompe, pero
  // delata un error de carga que conviene frenar acá.
  it("rechaza repetidos", () => {
    expect(validarDiasSemana("1223")).not.toBeNull()
  })
})

describe("validarIcono", () => {
  it("acepta uno del mapa", () => {
    expect(validarIcono("Stethoscope")).toBeNull()
  })

  // iconoPorNombre cae a FileQuestion sin avisar: sin esta validacion, un
  // icono mal tipeado se ve como un signo de pregunta en el totem.
  it("rechaza uno que no existe", () => {
    expect(validarIcono("Corazon")).not.toBeNull()
    expect(validarIcono("")).not.toBeNull()
  })
})

describe("validarPrefijo", () => {
  it("acepta uno libre", () => {
    expect(validarPrefijo("PRO", ["TOM", "MAT"])).toBeNull()
  })

  it("acepta de una a tres letras", () => {
    expect(validarPrefijo("P", [])).toBeNull()
    expect(validarPrefijo("PRO", [])).toBeNull()
  })

  it("rechaza más de tres, vacío y no alfabético", () => {
    expect(validarPrefijo("PROT", [])).not.toBeNull()
    expect(validarPrefijo("", [])).not.toBeNull()
    expect(validarPrefijo("P1", [])).not.toBeNull()
  })

  it("exige mayúsculas", () => {
    expect(validarPrefijo("pro", [])).not.toBeNull()
  })

  // Dos tramites con prefijo P generan dos P01 el mismo dia: dos personas
  // con el mismo numero esperando el mismo llamado.
  it("rechaza uno ya tomado", () => {
    const e = validarPrefijo("TOM", ["TOM", "MAT"])
    expect(e).not.toBeNull()
    expect(e?.campo).toBe("prefijo")
  })
})

describe("validarEntero", () => {
  it("acepta un valor válido", () => {
    expect(validarEntero("orden", 3, 0)).toBeNull()
  })

  it("rechaza por debajo del mínimo", () => {
    expect(validarEntero("orden", -1, 0)).not.toBeNull()
  })

  it("rechaza NaN y no enteros", () => {
    expect(validarEntero("orden", Number.NaN, 0)).not.toBeNull()
    expect(validarEntero("orden", 1.5, 0)).not.toBeNull()
  })
})
