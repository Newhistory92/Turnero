import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { generarTurno } from "@/server/handlers/generarTurno"

async function tramiteDePrueba() {
  return prisma.tramite.findFirstOrThrow({ where: { nombre: "Planes Especiales" } })
}

async function limpiar() {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()
}

describe("generarTurno", () => {
  beforeEach(limpiar)

  it("numera desde 01 con el prefijo del trámite", async () => {
    const t = await tramiteDePrueba()
    const r = await generarTurno({ tramiteId: t.id, dni: "20123456", requestId: "r1" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.numero).toBe("P01")
  })

  it("escribe el evento generado dentro de la misma transacción", async () => {
    const t = await tramiteDePrueba()
    const r = await generarTurno({ tramiteId: t.id, dni: null, requestId: "r2" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const eventos = await prisma.turnoEvento.findMany({ where: { turnoId: r.turno.id } })
      expect(eventos).toHaveLength(1)
      expect(eventos[0].tipo).toBe("generado")
    }
  })

  it("50 generaciones simultáneas producen 50 números distintos", async () => {
    const t = await tramiteDePrueba()
    const resultados = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        generarTurno({ tramiteId: t.id, dni: null, requestId: `concurrente-${i}` })
      )
    )
    const numeros = resultados.filter((r) => r.ok).map((r) => (r as any).turno.numero)
    expect(numeros).toHaveLength(50)
    expect(new Set(numeros).size).toBe(50)
  })

  it("el mismo requestId devuelve el mismo turno, no uno nuevo", async () => {
    const t = await tramiteDePrueba()
    const a = await generarTurno({ tramiteId: t.id, dni: null, requestId: "doble" })
    const b = await generarTurno({ tramiteId: t.id, dni: null, requestId: "doble" })
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) {
      expect(b.turno.id).toBe(a.turno.id)
      expect(b.turno.numero).toBe(a.turno.numero)
    }
    expect(await prisma.turno.count()).toBe(1)
  })

  it("rechaza un trámite inexistente sin dejar basura", async () => {
    const r = await generarTurno({
      tramiteId: "00000000-0000-0000-0000-000000000000",
      dni: null,
      requestId: "fantasma",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("TRAMITE_INEXISTENTE")
    expect(await prisma.turno.count()).toBe(0)
    expect(await prisma.contador.count()).toBe(0)
  })
})
