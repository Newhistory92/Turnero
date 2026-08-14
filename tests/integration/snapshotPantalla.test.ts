import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { armarSnapshotPantalla } from "@/server/snapshotPantalla"

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
  datos: { nombreAfiliado?: string | null; dni?: string | null } = {}
) {
  const turno = await prisma.turno.create({
    data: {
      numero,
      fecha: hoyFecha(),
      tramiteId,
      estado: "llamado",
      boxId,
      dni: datos.dni ?? null,
      nombreAfiliado: datos.nombreAfiliado ?? null,
      requestId: `int-${numero}-${Date.now()}-${Math.random()}`,
    },
  })
  await prisma.turnoEvento.create({ data: { turnoId: turno.id, tipo, boxId } })
  return turno
}

describe("armarSnapshotPantalla", () => {
  beforeEach(limpiar)
  afterAll(async () => {
    await limpiar()
    await prisma.$disconnect()
  })

  it("devuelve el último llamado del ala como actual", async () => {
    const box = await prisma.box.findFirstOrThrow({ include: { ala: true } })
    const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: box.id } })

    await sembrarLlamado(box.id, bt.tramiteId, "A01", "llamado")
    await sembrarLlamado(box.id, bt.tramiteId, "A02", "llamado", {
      nombreAfiliado: "González, María",
    })

    const s = await armarSnapshotPantalla(box.ala.nombre)
    expect(s.actual?.numero).toBe("A02")
    expect(s.actual?.identificacion).toBe("González, María")
    expect(s.actual?.boxNombre).toBe(box.nombre)
    expect(s.ultimos.map((l) => l.numero)).toEqual(["A01"])
  })

  it("no muestra llamados de la otra ala", async () => {
    const boxes = await prisma.box.findMany({ include: { ala: true } })
    const norte = boxes.find((b) => b.ala.nombre === "Norte")
    const sur = boxes.find((b) => b.ala.nombre === "Sur")
    if (!norte || !sur) return

    const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: norte.id } })
    await sembrarLlamado(norte.id, bt.tramiteId, "N01", "llamado")

    const s = await armarSnapshotPantalla("Sur")
    expect(s.actual).toBeNull()
  })

  it("un rellamado vuelve a poner el turno arriba", async () => {
    const box = await prisma.box.findFirstOrThrow({ include: { ala: true } })
    const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: box.id } })

    const primero = await sembrarLlamado(box.id, bt.tramiteId, "B01", "llamado")
    await sembrarLlamado(box.id, bt.tramiteId, "B02", "llamado")
    await prisma.turnoEvento.create({
      data: { turnoId: primero.id, tipo: "rellamado", boxId: box.id },
    })

    const s = await armarSnapshotPantalla(box.ala.nombre)
    expect(s.actual?.numero).toBe("B01")
  })
})
