import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { generarTurno } from "@/server/handlers/generarTurno"
import { llamarTurno } from "@/server/handlers/llamarTurno"
import { iniciarAtencion } from "@/server/handlers/iniciarAtencion"
import { marcarAbandonados } from "@/server/jobs/abandonados"
import { borrarDniVencidos } from "@/server/jobs/retencionDni"

async function escenario() {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()

  const tramite = await prisma.tramite.findFirstOrThrow({
    where: { nombre: "Planes Especiales" },
    include: { boxes: true },
  })
  return { tramiteId: tramite.id, boxA: tramite.boxes[0].boxId }
}

describe("job de abandonados", () => {
  let ctx: Awaited<ReturnType<typeof escenario>>
  beforeEach(async () => { ctx = await escenario() })

  it("pasa a abandonado lo que quedó esperando", async () => {
    const g = await generarTurno({ tramiteId: ctx.tramiteId, dni: null, requestId: "j1" })
    if (!g.ok) throw new Error("no se pudo generar")

    const r = await marcarAbandonados()
    expect(r.abandonados).toBe(1)

    const t = await prisma.turno.findUniqueOrThrow({ where: { id: g.turno.id } })
    expect(t.estado).toBe("abandonado")
  })

  it("no toca los finalizados ni los llamados", async () => {
    const g = await generarTurno({ tramiteId: ctx.tramiteId, dni: null, requestId: "j2" })
    if (!g.ok) throw new Error("no se pudo generar")
    await llamarTurno({ turnoId: g.turno.id, boxId: ctx.boxA })

    await marcarAbandonados()
    const t = await prisma.turno.findUniqueOrThrow({ where: { id: g.turno.id } })
    expect(t.estado).toBe("llamado")
  })

  it("cierra los atendiendo huérfanos y los marca con un evento de revisión", async () => {
    const g = await generarTurno({ tramiteId: ctx.tramiteId, dni: null, requestId: "j3" })
    if (!g.ok) throw new Error("no se pudo generar")
    await llamarTurno({ turnoId: g.turno.id, boxId: ctx.boxA })
    await iniciarAtencion({ turnoId: g.turno.id, boxId: ctx.boxA })

    const r = await marcarAbandonados()
    expect(r.huerfanos).toBe(1)

    const t = await prisma.turno.findUniqueOrThrow({ where: { id: g.turno.id } })
    expect(t.estado).toBe("finalizado")

    const ev = await prisma.turnoEvento.findFirst({
      where: { turnoId: g.turno.id, tipo: "revision" },
    })
    expect(ev).not.toBeNull()
  })

  it("es idempotente", async () => {
    await generarTurno({ tramiteId: ctx.tramiteId, dni: null, requestId: "j4" })
    await marcarAbandonados()
    const segunda = await marcarAbandonados()
    expect(segunda.abandonados).toBe(0)
    expect(segunda.huerfanos).toBe(0)
  })
})

describe("job de retención de DNI", () => {
  let ctx: Awaited<ReturnType<typeof escenario>>
  beforeEach(async () => { ctx = await escenario() })

  it("borra el DNI de los turnos vencidos y deja el turno", async () => {
    const g = await generarTurno({ tramiteId: ctx.tramiteId, dni: "20123456", requestId: "r1" })
    if (!g.ok) throw new Error("no se pudo generar")

    const hace100Dias = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
    await prisma.turno.update({
      where: { id: g.turno.id },
      data: { createdAt: hace100Dias },
    })

    const r = await borrarDniVencidos()
    expect(r.borrados).toBe(1)

    const t = await prisma.turno.findUniqueOrThrow({ where: { id: g.turno.id } })
    expect(t.dni).toBeNull()
    expect(t.numero).toBe(g.turno.numero)
  })

  it("no toca los turnos dentro del plazo", async () => {
    const g = await generarTurno({ tramiteId: ctx.tramiteId, dni: "20123456", requestId: "r2" })
    if (!g.ok) throw new Error("no se pudo generar")

    await borrarDniVencidos()
    const t = await prisma.turno.findUniqueOrThrow({ where: { id: g.turno.id } })
    expect(t.dni).toBe("20123456")
  })

  it("es idempotente", async () => {
    const g = await generarTurno({ tramiteId: ctx.tramiteId, dni: "20123456", requestId: "r3" })
    if (!g.ok) throw new Error("no se pudo generar")
    await prisma.turno.update({
      where: { id: g.turno.id },
      data: { createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) },
    })

    await borrarDniVencidos()
    const segunda = await borrarDniVencidos()
    expect(segunda.borrados).toBe(0)
  })
})
