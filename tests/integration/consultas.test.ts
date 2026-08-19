import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { turnosDelRango, colaActual } from "@/lib/estadisticas/consultas"
import type { Alcance } from "@/lib/estadisticas/tipos"

const REQUEST_PREFIJO = "sp5-consultas-"

async function limpiar() {
  const turnos = await prisma.turno.findMany({
    where: { requestId: { startsWith: REQUEST_PREFIJO } },
    select: { id: true },
  })
  const ids = turnos.map((t) => t.id)
  if (ids.length > 0) {
    await prisma.turnoEvento.deleteMany({ where: { turnoId: { in: ids } } })
    await prisma.turno.deleteMany({ where: { id: { in: ids } } })
  }
}

async function crearTurno(tramiteId: string, sufijo: string) {
  const turno = await prisma.turno.create({
    data: {
      numero: `ZZ${sufijo}`,
      fecha: new Date(),
      tramiteId,
      estado: "esperando",
      requestId: `${REQUEST_PREFIJO}${sufijo}`,
    },
  })
  await prisma.turnoEvento.create({ data: { turnoId: turno.id, tipo: "generado" } })
  return turno
}

function hoy() {
  const desde = new Date()
  desde.setHours(0, 0, 0, 0)
  const hasta = new Date()
  hasta.setHours(23, 59, 59, 999)
  return { desde, hasta }
}

describe("consultas con alcance", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("con alcance total trae los turnos de todos los trámites", async () => {
    const [t1, t2] = await prisma.tramite.findMany({ take: 2 })
    await crearTurno(t1.id, "a")
    await crearTurno(t2.id, "b")

    const filas = await turnosDelRango({ tipo: "todos" }, hoy())
    const mios = filas.filter((f) => f.numero.startsWith("ZZ"))
    expect(mios).toHaveLength(2)
  })

  // El caso que importa es el negativo: que lo de afuera del alcance NO
  // aparezca. Que lo de adentro aparezca es la parte facil.
  it("el alcance limitado deja afuera los otros trámites", async () => {
    const [t1, t2] = await prisma.tramite.findMany({ take: 2 })
    await crearTurno(t1.id, "a")
    await crearTurno(t2.id, "b")

    const alcance: Alcance = { tipo: "limitado", tramiteIds: [t1.id] }
    const filas = await turnosDelRango(alcance, hoy())
    const mios = filas.filter((f) => f.numero.startsWith("ZZ"))

    expect(mios).toHaveLength(1)
    expect(mios[0].tramiteId).toBe(t1.id)
  })

  // Denegar por defecto: el supervisor sin configurar no ve NADA, ni
  // siquiera un total agregado del que pueda deducir volumen.
  it("el alcance vacío no devuelve ninguna fila", async () => {
    const t1 = await prisma.tramite.findFirstOrThrow()
    await crearTurno(t1.id, "a")

    const filas = await turnosDelRango({ tipo: "limitado", tramiteIds: [] }, hoy())
    expect(filas).toHaveLength(0)
  })

  it("trae los eventos de cada turno para poder medir tiempos", async () => {
    const t1 = await prisma.tramite.findFirstOrThrow()
    await crearTurno(t1.id, "a")

    const filas = await turnosDelRango({ tipo: "todos" }, hoy())
    const mia = filas.find((f) => f.numero === "ZZa")
    expect(mia).toBeDefined()
    expect(mia!.eventos.some((e) => e.tipo === "generado")).toBe(true)
    expect(mia!.umbralMinutos).toBe(t1.duracionMinimaEsperada)
  })

  it("la cola actual también respeta el alcance", async () => {
    const [t1, t2] = await prisma.tramite.findMany({ take: 2 })
    await crearTurno(t1.id, "a")
    await crearTurno(t2.id, "b")

    const lineas = await colaActual({ tipo: "limitado", tramiteIds: [t1.id] })
    expect(lineas.every((l) => l.tramiteId === t1.id)).toBe(true)
    expect(lineas.find((l) => l.tramiteId === t2.id)).toBeUndefined()
  })

  it("la cola vacía por alcance no devuelve líneas", async () => {
    const t1 = await prisma.tramite.findFirstOrThrow()
    await crearTurno(t1.id, "a")
    expect(await colaActual({ tipo: "limitado", tramiteIds: [] })).toEqual([])
  })
})
