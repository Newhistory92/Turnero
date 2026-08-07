import { describe, it, expect } from "vitest"
import { CATALOGO_FIXTURE } from "@/lib/catalogo/fixture"

describe("CATALOGO_FIXTURE", () => {
  it("tiene las mismas cantidades que el seed real: 4 categorías, 15 trámites, 11 boxes", () => {
    expect(CATALOGO_FIXTURE.categorias).toHaveLength(4)
    expect(CATALOGO_FIXTURE.tramites).toHaveLength(15)
    expect(CATALOGO_FIXTURE.boxes).toHaveLength(11)
  })

  it("asigna Planes Especiales a dos boxes", () => {
    const t = CATALOGO_FIXTURE.tramites.find((x) => x.nombre === "Planes Especiales")
    expect(t?.boxes).toHaveLength(2)
  })

  it("manda DAI y Otros Trámites a la misma mesa del Ala Norte, Planta Alta", () => {
    const dai = CATALOGO_FIXTURE.tramites.find((x) => x.nombre === "DAI")
    const otros = CATALOGO_FIXTURE.tramites.find((x) => x.nombre === "Otros Trámites")
    expect(dai?.destino).toEqual({ ala: "Norte", piso: "Planta Alta" })
    expect(dai?.boxes[0]?.id).toBe(otros?.boxes[0]?.id)
  })

  it("todos los ids son únicos", () => {
    const ids = CATALOGO_FIXTURE.tramites.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
