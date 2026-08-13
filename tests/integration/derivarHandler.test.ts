import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { generarTurno } from "@/server/handlers/generarTurno"
import { llamarTurno } from "@/server/handlers/llamarTurno"
import { iniciarAtencion } from "@/server/handlers/iniciarAtencion"
import { derivarTurno } from "@/server/handlers/derivarTurno"

async function escenario() {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()

  const origen = await prisma.tramite.findFirstOrThrow({
    where: { nombre: "Planes Especiales" },
    include: { boxes: true },
  })
  const destino = await prisma.tramite.findFirstOrThrow({ where: { nombre: "Bioquímica" } })
  const boxA = origen.boxes[0].boxId

  const g = await generarTurno({ tramiteId: origen.id, dni: "20123456", requestId: "der-1" })
  if (!g.ok) throw new Error("no se pudo generar")
  await llamarTurno({ turnoId: g.turno.id, boxId: boxA })
  return { turno: g.turno, boxA, destinoId: destino.id, origenId: origen.id }
}

describe("derivarTurno", () => {
  let ctx: Awaited<ReturnType<typeof escenario>>
  beforeEach(async () => { ctx = await escenario() })

  it("deja el origen en derivado y crea el destino en esperando", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.origen.estado).toBe("derivado")
      expect(r.destino.estado).toBe("esperando")
      expect(r.destino.tramiteId).toBe(ctx.destinoId)
    }
  })

  it("el número no cambia: el papel que la persona tiene en la mano sigue valiendo", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId,
    })
    if (!r.ok) throw new Error("debería haber derivado")
    expect(r.destino.numero).toBe(ctx.turno.numero)
  })

  it("conserva createdAt, así la FIFO lo ubica por su antigüedad real", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId,
    })
    if (!r.ok) throw new Error("debería haber derivado")
    expect(r.destino.createdAt.getTime()).toBe(ctx.turno.createdAt.getTime())
  })

  it("no toca el contador del trámite destino: la serie no debe saltear números", async () => {
    await derivarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId })
    const contador = await prisma.contador.findFirst({ where: { tramiteId: ctx.destinoId } })
    expect(contador).toBeNull()
  })

  it("encadena con derivadoDeId", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId,
    })
    if (!r.ok) throw new Error("debería haber derivado")
    expect(r.destino.derivadoDeId).toBe(ctx.turno.id)
  })

  it("escribe el evento derivado con el trámite destino en detalle", async () => {
    await derivarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId })
    const ev = await prisma.turnoEvento.findFirstOrThrow({
      where: { turnoId: ctx.turno.id, tipo: "derivado" },
    })
    expect(ev.detalle).toContain(ctx.destinoId)
  })

  it("se puede derivar desde atendiendo, no sólo desde llamado", async () => {
    await iniciarAtencion({ turnoId: ctx.turno.id, boxId: ctx.boxA })
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId,
    })
    expect(r.ok).toBe(true)
  })

  it("arrastra el DNI y el nombre al turno nuevo", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId,
    })
    if (!r.ok) throw new Error("debería haber derivado")
    expect(r.destino.dni).toBe("20123456")
  })

  it("rechaza derivar al mismo trámite", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.origenId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("MISMO_TRAMITE")
  })

  it("rechaza un trámite destino que no existe", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: "no-existe",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("TRAMITE_INEXISTENTE")
  })

  it("si falla, no deja el origen derivado sin destino", async () => {
    await derivarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: "no-existe" })
    const origen = await prisma.turno.findUniqueOrThrow({ where: { id: ctx.turno.id } })
    expect(origen.estado).toBe("llamado")
  })
})
