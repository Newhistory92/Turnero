import { describe, it, expect } from "vitest"
import {
  esRol,
  puedeVerCatalogo,
  puedeEditarCatalogo,
  puedeVerTablero,
  puedeVerProductividad,
  ROLES,
} from "@/lib/admin/acceso"

describe("vocabulario de roles", () => {
  it("son exactamente cuatro", () => {
    expect([...ROLES]).toEqual(["operador", "supervisor", "director", "admin"])
  })

  it("reconoce los válidos", () => {
    expect(esRol("admin")).toBe(true)
    expect(esRol("director")).toBe(true)
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

describe("quién entra al tablero", () => {
  it("supervisor, director y admin entran", () => {
    expect(puedeVerTablero("supervisor")).toBe(true)
    expect(puedeVerTablero("director")).toBe(true)
    expect(puedeVerTablero("admin")).toBe(true)
  })

  it("el operador no entra", () => {
    expect(puedeVerTablero("operador")).toBe(false)
  })
})

describe("quién ve productividad por operador", () => {
  it("director y admin la ven", () => {
    expect(puedeVerProductividad("director")).toBe(true)
    expect(puedeVerProductividad("admin")).toBe(true)
  })

  // Mide personas: el supervisor ve volumen y derivaciones de su area,
  // pero no el rendimiento individual de quienes atienden.
  it("el supervisor no la ve", () => {
    expect(puedeVerProductividad("supervisor")).toBe(false)
    expect(puedeVerProductividad("operador")).toBe(false)
  })
})

describe("el catálogo no cambió", () => {
  // director es un rol de lectura con mas alcance, no un admin con otro
  // nombre: no administra el catalogo.
  it("director no entra al panel de catálogo", () => {
    expect(puedeVerCatalogo("director")).toBe(false)
    expect(puedeEditarCatalogo("director")).toBe(false)
  })

  it("admin ve y edita; supervisor ve pero no edita", () => {
    expect(puedeVerCatalogo("admin")).toBe(true)
    expect(puedeEditarCatalogo("admin")).toBe(true)
    expect(puedeVerCatalogo("supervisor")).toBe(true)
    expect(puedeEditarCatalogo("supervisor")).toBe(false)
  })
})
