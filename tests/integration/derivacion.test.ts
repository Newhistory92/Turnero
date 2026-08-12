import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { generarTurno } from "@/server/handlers/generarTurno"

beforeEach(async () => {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()
})

describe("modelo de derivación", () => {
  it("el turno derivado conserva número y hora, y no toca el contador destino", async () => {
    const origenTramite = await prisma.tramite.findFirstOrThrow({ where: { nombre: "Planes Especiales" } })
    const destinoTramite = await prisma.tramite.findFirstOrThrow({ where: { nombre: "Bioquímica" } })

    const r = await generarTurno({ tramiteId: origenTramite.id, dni: null, requestId: "orig-1" })
    if (!r.ok) throw new Error("no se pudo generar")

    const derivado = await prisma.turno.create({
      data: {
        numero: r.turno.numero,
        fecha: r.turno.fecha,
        createdAt: r.turno.createdAt,
        tramiteId: destinoTramite.id,
        dni: r.turno.dni,
        estado: "esperando",
        requestId: `derivacion-${r.turno.id}`,
        derivadoDeId: r.turno.id,
      },
    })

    expect(derivado.numero).toBe(r.turno.numero)
    expect(derivado.createdAt.getTime()).toBe(r.turno.createdAt.getTime())

    // El contador de Bioquimica sigue en cero: la derivacion no consume numero.
    const contadorDestino = await prisma.contador.findFirst({
      where: { tramiteId: destinoTramite.id },
    })
    expect(contadorDestino).toBeNull()
  })

  it("se puede recorrer la cadena de derivación", async () => {
    const t = await prisma.tramite.findFirstOrThrow({ where: { nombre: "Planes Especiales" } })
    const r = await generarTurno({ tramiteId: t.id, dni: null, requestId: "orig-2" })
    if (!r.ok) throw new Error("no se pudo generar")

    await prisma.turno.create({
      data: {
        numero: r.turno.numero,
        fecha: r.turno.fecha,
        createdAt: r.turno.createdAt,
        tramiteId: t.id,
        estado: "esperando",
        requestId: `derivacion-${r.turno.id}`,
        derivadoDeId: r.turno.id,
      },
    })

    const origen = await prisma.turno.findUniqueOrThrow({
      where: { id: r.turno.id },
      include: { derivaciones: true },
    })
    expect(origen.derivaciones).toHaveLength(1)
  })
})
