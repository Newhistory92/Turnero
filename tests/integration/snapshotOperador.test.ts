import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { armarSnapshot } from "@/server/snapshot"

async function limpiar() {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()
}

function hoyFecha(): Date {
  const a = new Date()
  return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()))
}

async function sembrarLlamado(
  boxId: string,
  tramiteId: string,
  numero: string,
  tipo: "llamado" | "rellamado",
  estado = "llamado",
  datos: { nombreAfiliado?: string | null; dni?: string | null } = {}
) {
  const turno = await prisma.turno.create({
    data: {
      numero,
      fecha: hoyFecha(),
      tramiteId,
      estado,
      boxId,
      nombreAfiliado: datos.nombreAfiliado ?? null,
      dni: datos.dni ?? null,
      requestId: `int-${numero}-${Date.now()}-${Math.random()}`,
    },
  })
  await prisma.turnoEvento.create({ data: { turnoId: turno.id, tipo, boxId } })
  return turno
}

describe("armarSnapshot — ultimoLlamado", () => {
  beforeEach(limpiar)
  afterAll(async () => {
    await limpiar()
    await prisma.$disconnect()
  })

  it("es null cuando el box nunca llamo a nadie hoy", async () => {
    const box = await prisma.box.findFirstOrThrow()
    const s = await armarSnapshot(box.id)
    expect(s.ultimoLlamado).toBeNull()
  })

  it("devuelve el ultimo llamado aunque ya haya sido finalizado", async () => {
    const box = await prisma.box.findFirstOrThrow()
    const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: box.id } })

    await sembrarLlamado(box.id, bt.tramiteId, "Z01", "llamado", "finalizado")

    const s = await armarSnapshot(box.id)
    expect(s.activo).toBeNull()
    expect(s.ultimoLlamado?.numero).toBe("Z01")
  })

  it("con dos llamados devuelve el mas reciente", async () => {
    const box = await prisma.box.findFirstOrThrow()
    const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: box.id } })

    await sembrarLlamado(box.id, bt.tramiteId, "Z02", "llamado", "finalizado")
    await sembrarLlamado(box.id, bt.tramiteId, "Z03", "llamado")

    const s = await armarSnapshot(box.id)
    expect(s.ultimoLlamado?.numero).toBe("Z03")
  })

  it("un rellamado sobre el mas viejo lo vuelve a poner como ultimo", async () => {
    const box = await prisma.box.findFirstOrThrow()
    const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: box.id } })

    const primero = await sembrarLlamado(box.id, bt.tramiteId, "Z04", "llamado", "finalizado")
    await sembrarLlamado(box.id, bt.tramiteId, "Z05", "llamado", "finalizado")
    await prisma.turnoEvento.create({
      data: { turnoId: primero.id, tipo: "rellamado", boxId: box.id },
    })

    const s = await armarSnapshot(box.id)
    expect(s.ultimoLlamado?.numero).toBe("Z04")
  })

  it("incluye nombre y dni del afiliado, para cuando el operador tenga dudas", async () => {
    const box = await prisma.box.findFirstOrThrow()
    const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: box.id } })

    await sembrarLlamado(box.id, bt.tramiteId, "Z07", "llamado", "finalizado", {
      nombreAfiliado: "Pérez, Juan",
      dni: "12345678",
    })

    const s = await armarSnapshot(box.id)
    expect(s.ultimoLlamado?.nombreAfiliado).toBe("Pérez, Juan")
    expect(s.ultimoLlamado?.dni).toBe("12345678")
  })

  it("no toma llamados de otro box", async () => {
    const boxes = await prisma.box.findMany()
    if (boxes.length < 2) return
    const [boxA, boxB] = boxes
    const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: boxB.id } })

    await sembrarLlamado(boxB.id, bt.tramiteId, "Z06", "llamado")

    const s = await armarSnapshot(boxA.id)
    expect(s.ultimoLlamado).toBeNull()
  })
})
