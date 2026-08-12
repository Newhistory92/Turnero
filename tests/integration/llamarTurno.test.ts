import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { generarTurno } from "@/server/handlers/generarTurno"
import { llamarTurno } from "@/server/handlers/llamarTurno"

async function escenario() {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()

  const tramite = await prisma.tramite.findFirstOrThrow({
    where: { nombre: "Planes Especiales" },
    include: { boxes: true },
  })
  const r = await generarTurno({ tramiteId: tramite.id, dni: null, requestId: "x1" })
  if (!r.ok) throw new Error("no se pudo generar")
  return { turno: r.turno, boxA: tramite.boxes[0].boxId, boxB: tramite.boxes[1].boxId }
}

describe("llamarTurno", () => {
  let ctx: Awaited<ReturnType<typeof escenario>>
  beforeEach(async () => { ctx = await escenario() })

  it("pasa el turno a llamado y le asigna el box", async () => {
    const r = await llamarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.turno.estado).toBe("llamado")
      expect(r.turno.boxId).toBe(ctx.boxA)
    }
  })

  it("escribe el evento llamado con el box", async () => {
    await llamarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA })
    const ev = await prisma.turnoEvento.findFirstOrThrow({
      where: { turnoId: ctx.turno.id, tipo: "llamado" },
    })
    expect(ev.boxId).toBe(ctx.boxA)
  })

  it("si dos boxes llaman a la vez, solo uno gana", async () => {
    const [a, b] = await Promise.all([
      llamarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA }),
      llamarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxB }),
    ])
    const ganadores = [a, b].filter((r) => r.ok)
    const perdedores = [a, b].filter((r) => !r.ok)
    expect(ganadores).toHaveLength(1)
    expect(perdedores).toHaveLength(1)
    expect((perdedores[0] as any).codigo).toBe("YA_LLAMADO")
  })

  it("el segundo llamado informa qué box se lo quedó", async () => {
    await llamarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA })
    const r = await llamarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxB })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.boxQueLoTiene).toBe(ctx.boxA)
  })
})
