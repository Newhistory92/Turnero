import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import type { Actor } from "@/lib/admin/acceso"
import { guardarAlcance } from "@/lib/admin/mutaciones"

const DNI_PRUEBA = "99999903"

const ADMIN: Actor = { empleadoId: "x", nombre: "Admin", rol: "admin" }
const SUPERVISOR: Actor = { empleadoId: "y", nombre: "Super", rol: "supervisor" }
const DIRECTOR: Actor = { empleadoId: "z", nombre: "Dire", rol: "director" }

async function limpiar() {
  await prisma.alcanceMetrica.deleteMany({
    where: { empleado: { dniInstitucional: DNI_PRUEBA } },
  })
  await prisma.empleado.deleteMany({ where: { dniInstitucional: DNI_PRUEBA } })
}

async function crearSupervisor() {
  return prisma.empleado.create({
    data: { dniInstitucional: DNI_PRUEBA, nombre: "Super Prueba", rol: "supervisor" },
  })
}

describe("guardarAlcance", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("el admin asigna trámites", async () => {
    const emp = await crearSupervisor()
    const tramites = await prisma.tramite.findMany({ take: 2 })

    const r = await guardarAlcance(ADMIN, {
      empleadoId: emp.id,
      tramiteIds: tramites.map((t) => t.id),
    })
    expect(r.ok).toBe(true)

    const filas = await prisma.alcanceMetrica.findMany({ where: { empleadoId: emp.id } })
    expect(filas).toHaveLength(2)
  })

  // Reemplaza en vez de acumular: si solo agregara, desmarcar una casilla
  // no sacaria nada y el alcance solo podria crecer.
  it("reemplaza el alcance anterior", async () => {
    const emp = await crearSupervisor()
    const tramites = await prisma.tramite.findMany({ take: 2 })

    await guardarAlcance(ADMIN, {
      empleadoId: emp.id,
      tramiteIds: tramites.map((t) => t.id),
    })
    await guardarAlcance(ADMIN, { empleadoId: emp.id, tramiteIds: [tramites[0].id] })

    const filas = await prisma.alcanceMetrica.findMany({ where: { empleadoId: emp.id } })
    expect(filas).toHaveLength(1)
    expect(filas[0].tramiteId).toBe(tramites[0].id)
  })

  it("una lista vacía deja al supervisor sin alcance", async () => {
    const emp = await crearSupervisor()
    const tramite = await prisma.tramite.findFirstOrThrow()
    await guardarAlcance(ADMIN, { empleadoId: emp.id, tramiteIds: [tramite.id] })

    const r = await guardarAlcance(ADMIN, { empleadoId: emp.id, tramiteIds: [] })
    expect(r.ok).toBe(true)
    expect(await prisma.alcanceMetrica.findMany({ where: { empleadoId: emp.id } })).toEqual([])
  })

  // Quien no edita el catalogo tampoco reparte alcance: es la misma
  // autoridad, y un supervisor podria ampliarse el suyo.
  it("ni supervisor ni director pueden asignar", async () => {
    const emp = await crearSupervisor()
    const tramite = await prisma.tramite.findFirstOrThrow()

    for (const actor of [SUPERVISOR, DIRECTOR]) {
      const r = await guardarAlcance(actor, {
        empleadoId: emp.id,
        tramiteIds: [tramite.id],
      })
      expect(r.ok).toBe(false)
    }
    expect(await prisma.alcanceMetrica.findMany({ where: { empleadoId: emp.id } })).toEqual([])
  })

  it("rechaza un empleado inexistente", async () => {
    const tramite = await prisma.tramite.findFirstOrThrow()
    const r = await guardarAlcance(ADMIN, {
      empleadoId: "no-existe",
      tramiteIds: [tramite.id],
    })
    expect(r.ok).toBe(false)
  })
})
