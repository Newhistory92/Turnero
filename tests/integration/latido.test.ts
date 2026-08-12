import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { registrarLatido } from "@/server/handlers/latido"

beforeEach(async () => {
  await prisma.kiosco.deleteMany()
})

describe("registrarLatido", () => {
  it("crea el kiosco la primera vez que late", async () => {
    await registrarLatido({ id: "kiosco-1", version: "1.0.0" })
    const k = await prisma.kiosco.findUniqueOrThrow({ where: { id: "kiosco-1" } })
    expect(k.version).toBe("1.0.0")
    expect(k.ultimoLatido).not.toBeNull()
  })

  it("actualiza la marca en los latidos siguientes", async () => {
    await registrarLatido({ id: "kiosco-1", version: "1.0.0" })
    const primero = await prisma.kiosco.findUniqueOrThrow({ where: { id: "kiosco-1" } })
    await new Promise((r) => setTimeout(r, 30))
    await registrarLatido({ id: "kiosco-1", version: "1.0.0" })
    const segundo = await prisma.kiosco.findUniqueOrThrow({ where: { id: "kiosco-1" } })
    expect(segundo.ultimoLatido!.getTime()).toBeGreaterThan(primero.ultimoLatido!.getTime())
    expect(await prisma.kiosco.count()).toBe(1)
  })

  it("guarda el último error de impresión reportado", async () => {
    await registrarLatido({ id: "kiosco-1", version: "1.0.0", errorImpresion: "sin respuesta" })
    const k = await prisma.kiosco.findUniqueOrThrow({ where: { id: "kiosco-1" } })
    expect(k.ultimoErrorImpresion).toBe("sin respuesta")
  })
})
