import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"

const DNI_PRUEBA = "99999901"

async function limpiar() {
  await prisma.alcanceMetrica.deleteMany({
    where: { empleado: { dniInstitucional: DNI_PRUEBA } },
  })
  await prisma.empleado.deleteMany({ where: { dniInstitucional: DNI_PRUEBA } })
}

describe("AlcanceMetrica", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("asocia un empleado con varios trámites", async () => {
    const empleado = await prisma.empleado.create({
      data: { dniInstitucional: DNI_PRUEBA, nombre: "Super Prueba", rol: "supervisor" },
    })
    const tramites = await prisma.tramite.findMany({ take: 2 })
    expect(tramites.length).toBe(2)

    await prisma.alcanceMetrica.createMany({
      data: tramites.map((t) => ({ empleadoId: empleado.id, tramiteId: t.id })),
    })

    const filas = await prisma.alcanceMetrica.findMany({
      where: { empleadoId: empleado.id },
    })
    expect(filas).toHaveLength(2)
  })

  // La clave compuesta es lo que impide asignar dos veces el mismo tramite
  // al mismo supervisor y que despues el conteo lo cuente doble.
  it("rechaza el par duplicado", async () => {
    const empleado = await prisma.empleado.create({
      data: { dniInstitucional: DNI_PRUEBA, nombre: "Super Prueba", rol: "supervisor" },
    })
    const tramite = await prisma.tramite.findFirstOrThrow()

    await prisma.alcanceMetrica.create({
      data: { empleadoId: empleado.id, tramiteId: tramite.id },
    })

    await expect(
      prisma.alcanceMetrica.create({
        data: { empleadoId: empleado.id, tramiteId: tramite.id },
      })
    ).rejects.toThrow()
  })

  // Si se borra al supervisor su alcance se va con el: dejar filas huerfanas
  // apuntando a un empleado inexistente no le sirve a nadie.
  it("borra el alcance en cascada al borrar el empleado", async () => {
    const empleado = await prisma.empleado.create({
      data: { dniInstitucional: DNI_PRUEBA, nombre: "Super Prueba", rol: "supervisor" },
    })
    const tramite = await prisma.tramite.findFirstOrThrow()
    await prisma.alcanceMetrica.create({
      data: { empleadoId: empleado.id, tramiteId: tramite.id },
    })

    await prisma.empleado.delete({ where: { id: empleado.id } })

    const filas = await prisma.alcanceMetrica.findMany({
      where: { empleadoId: empleado.id },
    })
    expect(filas).toHaveLength(0)
  })
})
