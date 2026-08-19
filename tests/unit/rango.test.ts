import { describe, it, expect } from "vitest"
import { presetA, parsearRango, aClaveFecha } from "@/lib/estadisticas/rango"

const AHORA = new Date("2026-08-19T15:30:00-03:00")

describe("aClaveFecha", () => {
  it("usa la fecha local, no la UTC", () => {
    // 22:00 en -03:00 ya es el dia siguiente en UTC: si la clave saliera de
    // toISOString, un turno de la tarde se contaria en el dia equivocado.
    expect(aClaveFecha(new Date("2026-08-19T22:00:00-03:00"))).toBe("2026-08-19")
  })
})

describe("presetA", () => {
  it("hoy va del arranque al cierre del día", () => {
    const r = presetA("hoy", AHORA)
    expect(aClaveFecha(r.desde)).toBe("2026-08-19")
    expect(aClaveFecha(r.hasta)).toBe("2026-08-19")
    expect(r.desde.getHours()).toBe(0)
    expect(r.desde.getMinutes()).toBe(0)
    expect(r.hasta.getHours()).toBe(23)
    expect(r.hasta.getMinutes()).toBe(59)
  })

  it("semana son siete días contando hoy", () => {
    const r = presetA("semana", AHORA)
    expect(aClaveFecha(r.desde)).toBe("2026-08-13")
    expect(aClaveFecha(r.hasta)).toBe("2026-08-19")
  })

  it("mes son treinta días contando hoy", () => {
    const r = presetA("mes", AHORA)
    expect(aClaveFecha(r.desde)).toBe("2026-07-21")
    expect(aClaveFecha(r.hasta)).toBe("2026-08-19")
  })
})

describe("parsearRango", () => {
  it("acepta un rango válido sin corregirlo", () => {
    const { rango, corregido } = parsearRango("2026-08-01", "2026-08-10", AHORA)
    expect(corregido).toBe(false)
    expect(aClaveFecha(rango.desde)).toBe("2026-08-01")
    expect(aClaveFecha(rango.hasta)).toBe("2026-08-10")
  })

  it("un solo día es un rango válido", () => {
    const { rango, corregido } = parsearRango("2026-08-05", "2026-08-05", AHORA)
    expect(corregido).toBe(false)
    expect(aClaveFecha(rango.desde)).toBe("2026-08-05")
    expect(rango.hasta.getHours()).toBe(23)
  })

  // Cae al preset "mes" y AVISA. Devolver vacio en silencio haria que el
  // usuario leyera "no hubo turnos" cuando lo que hubo fue un error de tipeo.
  it("un rango invertido cae al mes y se marca corregido", () => {
    const { rango, corregido } = parsearRango("2026-08-10", "2026-08-01", AHORA)
    expect(corregido).toBe(true)
    expect(aClaveFecha(rango.desde)).toBe("2026-07-21")
  })

  it("una fecha ilegible cae al mes y se marca corregido", () => {
    const { corregido } = parsearRango("ayer", "2026-08-10", AHORA)
    expect(corregido).toBe(true)
  })

  it("una fecha inexistente cae al mes", () => {
    const { corregido } = parsearRango("2026-02-31", "2026-08-10", AHORA)
    expect(corregido).toBe(true)
  })

  // Entrar sin parametros es el caso normal, no un error: no se avisa nada.
  it("sin parámetros usa el mes sin marcar corrección", () => {
    const { rango, corregido } = parsearRango(undefined, undefined, AHORA)
    expect(corregido).toBe(false)
    expect(aClaveFecha(rango.desde)).toBe("2026-07-21")
    expect(aClaveFecha(rango.hasta)).toBe("2026-08-19")
  })

  it("un solo parámetro también cae al mes y avisa", () => {
    const { corregido } = parsearRango("2026-08-01", undefined, AHORA)
    expect(corregido).toBe(true)
  })
})
