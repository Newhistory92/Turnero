import { describe, it, expect, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { contarReferencias, sePuedeBorrar } from "@/lib/admin/referencias"

function hoyFecha(): Date {
  const a = new Date()
  return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()))
}

describe("contarReferencias", () => {
  afterAll(async () => {
    await prisma.turno.deleteMany({ where: { requestId: { startsWith: "ref-" } } })
    await prisma.$disconnect()
  })

  it("una categoría recién creada se puede borrar", async () => {
    const c = await prisma.categoria.create({
      data: { nombre: "Temporal", icono: "Activity", orden: 99 },
    })
    expect(sePuedeBorrar(await contarReferencias("categoria", c.id))).toBe(true)
    await prisma.categoria.delete({ where: { id: c.id } })
  })

  it("una categoría con trámites no se puede borrar", async () => {
    const t = await prisma.tramite.findFirstOrThrow()
    const refs = await contarReferencias("categoria", t.categoriaId)
    expect(refs.tramites).toBeGreaterThan(0)
    expect(sePuedeBorrar(refs)).toBe(false)
  })

  // El caso que motiva toda la regla: un tramite con un solo turno de hace
  // dos años sigue siendo la unica forma de resolver el nombre de ese turno.
  it("un trámite con un turno queda bloqueado", async () => {
    const t = await prisma.tramite.findFirstOrThrow()
    await prisma.turno.create({
      data: {
        numero: "REF01",
        fecha: hoyFecha(),
        tramiteId: t.id,
        estado: "finalizado",
        requestId: `ref-${Date.now()}`,
      },
    })
    const refs = await contarReferencias("tramite", t.id)
    expect(refs.turnos).toBeGreaterThan(0)
    expect(sePuedeBorrar(refs)).toBe(false)
  })

  it("un ala con boxes no se puede borrar", async () => {
    const b = await prisma.box.findFirstOrThrow()
    const refs = await contarReferencias("ala", b.alaId)
    expect(refs.boxes).toBeGreaterThan(0)
    expect(sePuedeBorrar(refs)).toBe(false)
  })
})
