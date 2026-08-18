import { describe, it, expect } from "vitest"
import { esRol, puedeVerCatalogo, puedeEditarCatalogo, ROLES } from "@/lib/admin/acceso"

describe("vocabulario de roles", () => {
  it("son exactamente tres", () => {
    expect([...ROLES]).toEqual(["operador", "supervisor", "admin"])
  })

  it("reconoce los válidos", () => {
    expect(esRol("admin")).toBe(true)
    expect(esRol("supervisor")).toBe(true)
    expect(esRol("operador")).toBe(true)
  })

  // El script de importacion escribe "operador" en minuscula. Cualquier otra
  // cosa en la columna es dato corrupto y no debe habilitar nada.
  it("rechaza cualquier otra cosa", () => {
    expect(esRol("Admin")).toBe(false)
    expect(esRol("root")).toBe(false)
    expect(esRol("")).toBe(false)
  })
})

describe("qué habilita cada rol", () => {
  it("admin ve y edita", () => {
    expect(puedeVerCatalogo("admin")).toBe(true)
    expect(puedeEditarCatalogo("admin")).toBe(true)
  })

  // El rol existe con significado real desde SP4a en vez de ser una etiqueta
  // que no habilita nada hasta SP4c.
  it("supervisor ve pero no edita", () => {
    expect(puedeVerCatalogo("supervisor")).toBe(true)
    expect(puedeEditarCatalogo("supervisor")).toBe(false)
  })

  it("operador no entra", () => {
    expect(puedeVerCatalogo("operador")).toBe(false)
    expect(puedeEditarCatalogo("operador")).toBe(false)
  })
})
