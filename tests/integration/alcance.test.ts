import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import type { Actor } from "@/lib/admin/acceso"
import { alcanceDe, sinAlcance, filtroTramiteId } from "@/lib/estadisticas/alcance"

const DNI_PRUEBA = "99999902"

async function limpiar() {
  await prisma.alcanceMetrica.deleteMany({
    where: { empleado: { dniInstitucional: DNI_PRUEBA } },
  })
  await prisma.empleado.deleteMany({ where: { dniInstitucional: DNI_PRUEBA } })
}

async function supervisorCon(tramiteIds: string[]): Promise<Actor> {
  const empleado = await prisma.empleado.create({
    data: { dniInstitucional: DNI_PRUEBA, nombre: "Super Prueba", rol: "supervisor" },
  })
  if (tramiteIds.length > 0) {
    await prisma.alcanceMetrica.createMany({
      data: tramiteIds.map((tramiteId) => ({ empleadoId: empleado.id, tramiteId })),
    })
  }
  return { empleadoId: empleado.id, nombre: empleado.nombre, rol: "supervisor" }
}

describe("alcanceDe", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("director y admin ven todos los trámites", async () => {
    const director: Actor = { empleadoId: "x", nombre: "Dire", rol: "director" }
    const admin: Actor = { empleadoId: "y", nombre: "Admin", rol: "admin" }
    expect(await alcanceDe(director)).toEqual({ tipo: "todos" })
    expect(await alcanceDe(admin)).toEqual({ tipo: "todos" })
  })

  it("el supervisor queda limitado a los trámites asignados", async () => {
    const tramites = await prisma.tramite.findMany({ take: 2 })
    const actor = await supervisorCon(tramites.map((t) => t.id))

    const alcance = await alcanceDe(actor)
    expect(alcance.tipo).toBe("limitado")
    if (alcance.tipo !== "limitado") throw new Error("tipo inesperado")
    expect([...alcance.tramiteIds].sort()).toEqual(tramites.map((t) => t.id).sort())
  })

  // Denegar por defecto: sin configuracion no ve nada, y el tipo obliga a
  // distinguirlo de "todos" en vez de confundirlo con acceso total.
  it("el supervisor sin asignar queda limitado a nada", async () => {
    const actor = await supervisorCon([])
    const alcance = await alcanceDe(actor)
    expect(alcance).toEqual({ tipo: "limitado", tramiteIds: [] })
    expect(sinAlcance(alcance)).toBe(true)
  })
})

describe("helpers de alcance", () => {
  it("sinAlcance sólo es cierto para el limitado vacío", () => {
    expect(sinAlcance({ tipo: "todos" })).toBe(false)
    expect(sinAlcance({ tipo: "limitado", tramiteIds: ["a"] })).toBe(false)
    expect(sinAlcance({ tipo: "limitado", tramiteIds: [] })).toBe(true)
  })

  // undefined es como Prisma expresa "sin filtro"; el limitado vacio produce
  // { in: [] }, que no matchea nada. Los dos casos son opuestos a proposito.
  it("filtroTramiteId traduce a un where de Prisma", () => {
    expect(filtroTramiteId({ tipo: "todos" })).toBeUndefined()
    expect(filtroTramiteId({ tipo: "limitado", tramiteIds: ["a", "b"] })).toEqual({
      in: ["a", "b"],
    })
    expect(filtroTramiteId({ tipo: "limitado", tramiteIds: [] })).toEqual({ in: [] })
  })
})
