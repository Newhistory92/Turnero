import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/db"

describe("catálogo sembrado", () => {
  it("tiene 15 trámites en 4 categorías", async () => {
    expect(await prisma.tramite.count()).toBe(15)
    expect(await prisma.categoria.count()).toBe(4)
  })

  it("no repite número de box dentro de un ala", async () => {
    const boxes = await prisma.box.findMany({ include: { ala: true } })
    const claves = boxes.map((b) => `${b.alaId}-${b.numero}`)
    expect(new Set(claves).size).toBe(boxes.length)
  })

  it("permite Box 1 en ambas alas", async () => {
    const unos = await prisma.box.findMany({ where: { numero: 1 } })
    expect(unos).toHaveLength(2)
    expect(new Set(unos.map((b) => b.alaId)).size).toBe(2)
  })

  it("asigna Planes Especiales a dos boxes", async () => {
    const t = await prisma.tramite.findFirstOrThrow({
      where: { nombre: "Planes Especiales" },
      include: { boxes: true },
    })
    expect(t.boxes).toHaveLength(2)
  })

  it("manda DAI y Otros Trámites a la misma mesa", async () => {
    const dai = await prisma.tramite.findFirstOrThrow({
      where: { nombre: "DAI" },
      include: { boxes: true },
    })
    const otros = await prisma.tramite.findFirstOrThrow({
      where: { nombre: "Otros Trámites" },
      include: { boxes: true },
    })
    expect(dai.boxes[0].boxId).toBe(otros.boxes[0].boxId)
  })
})
