import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { generarTurno } from "@/server/handlers/generarTurno"
import { llamarTurno } from "@/server/handlers/llamarTurno"
import { rellamarTurno } from "@/server/handlers/rellamarTurno"
import { marcarAusente } from "@/server/handlers/marcarAusente"
import { iniciarAtencion } from "@/server/handlers/iniciarAtencion"
import { finalizarAtencion } from "@/server/handlers/finalizarAtencion"

async function escenario() {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()

  const tramite = await prisma.tramite.findFirstOrThrow({
    where: { nombre: "Planes Especiales" },
    include: { boxes: true },
  })
  const boxA = tramite.boxes[0].boxId
  const boxB = tramite.boxes[1].boxId

  const g = await generarTurno({ tramiteId: tramite.id, dni: null, requestId: "at-1" })
  if (!g.ok) throw new Error("no se pudo generar")
  await llamarTurno({ turnoId: g.turno.id, boxId: boxA })
  return { turnoId: g.turno.id, boxA, boxB }
}

describe("handlers de atención", () => {
  let ctx: Awaited<ReturnType<typeof escenario>>
  beforeEach(async () => { ctx = await escenario() })

  it("rellamar deja el turno en llamado y suma un evento", async () => {
    const r = await rellamarTurno({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("llamado")
    expect(await prisma.turnoEvento.count({
      where: { turnoId: ctx.turnoId, tipo: "rellamado" },
    })).toBe(1)
  })

  it("cada rellamado queda como evento propio", async () => {
    await rellamarTurno({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    await rellamarTurno({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(await prisma.turnoEvento.count({
      where: { turnoId: ctx.turnoId, tipo: "rellamado" },
    })).toBe(2)
  })

  it("marcar ausente saca el turno de la cola activa", async () => {
    const r = await marcarAusente({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("ausente")
  })

  it("un ausente se puede volver a llamar", async () => {
    await marcarAusente({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    const r = await llamarTurno({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(r.ok).toBe(true)
  })

  it("iniciar pasa a atendiendo", async () => {
    const r = await iniciarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("atendiendo")
  })

  it("finalizar pasa a finalizado desde atendiendo", async () => {
    await iniciarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    const r = await finalizarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("finalizado")
  })

  it("no se puede finalizar lo que no se inició", async () => {
    const r = await finalizarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("TRANSICION_INVALIDA")
  })

  it("registra las atenciones cortas: el sesgo de ≥7 min era el hallazgo 4", async () => {
    await iniciarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    await finalizarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(await prisma.turnoEvento.count({
      where: { turnoId: ctx.turnoId, tipo: "finalizado" },
    })).toBe(1)
  })

  it("un box ajeno no puede operar sobre el turno de otro", async () => {
    const r = await iniciarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxB })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("BOX_AJENO")
  })

  it("un turno inexistente no explota, devuelve error tipado", async () => {
    const r = await iniciarAtencion({ turnoId: "no-existe", boxId: ctx.boxA })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("TURNO_INEXISTENTE")
  })
})
