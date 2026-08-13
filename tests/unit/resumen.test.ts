import { describe, it, expect } from "vitest"
import { resumirCola } from "@/lib/queue/resumen"
import type { TurnoDominio, BoxDominio } from "@/lib/queue/tipos"

const box: BoxDominio = {
  id: "box-1",
  activo: true,
  tramiteIds: ["carnet", "expedientes", "aportes"],
  horaApertura: "08:00",
  horaCierre: "13:00",
  diasSemana: "1111100",
}

const nombres = new Map([
  ["carnet", { tramite: "Carnet", categoria: "Afiliaciones" }],
  ["expedientes", { tramite: "Recepción de Expedientes", categoria: "Afiliaciones" }],
  ["aportes", { tramite: "Aportes", categoria: "Afiliaciones" }],
  ["protesis", { tramite: "Prótesis", categoria: "Auditoría Médica" }],
])

function turno(id: string, tramiteId: string, minutosAtras: number): TurnoDominio {
  return {
    id,
    numero: id,
    tramiteId,
    estado: "esperando",
    boxId: null,
    createdAt: new Date(Date.now() - minutosAtras * 60 * 1000),
    derivadoDeId: null,
  }
}

describe("resumirCola", () => {
  it("cuenta el total de los que esperan", () => {
    const r = resumirCola([turno("a", "carnet", 5), turno("b", "aportes", 3)], box, nombres)
    expect(r.total).toBe(2)
  })

  it("desglosa por trámite, no por categoría", () => {
    const turnos = [
      turno("a", "carnet", 10), turno("b", "carnet", 8),
      turno("c", "expedientes", 5),
    ]
    const r = resumirCola(turnos, box, nombres)
    expect(r.lineas).toEqual([
      { tramiteId: "carnet", tramiteNombre: "Carnet", categoriaNombre: "Afiliaciones", cuantos: 2 },
      { tramiteId: "expedientes", tramiteNombre: "Recepción de Expedientes", categoriaNombre: "Afiliaciones", cuantos: 1 },
    ])
  })

  it("ordena las líneas de mayor a menor", () => {
    const turnos = [
      turno("a", "aportes", 9),
      turno("b", "carnet", 8), turno("c", "carnet", 7), turno("d", "carnet", 6),
    ]
    const r = resumirCola(turnos, box, nombres)
    expect(r.lineas[0].tramiteId).toBe("carnet")
    expect(r.lineas[0].cuantos).toBe(3)
  })

  it("no cuenta trámites que el box no atiende", () => {
    const r = resumirCola([turno("a", "protesis", 5)], box, nombres)
    expect(r.total).toBe(0)
    expect(r.lineas).toEqual([])
  })

  it("no cuenta los que ya no esperan", () => {
    const llamado = { ...turno("a", "carnet", 5), estado: "llamado" as const }
    const r = resumirCola([llamado, turno("b", "carnet", 3)], box, nombres)
    expect(r.total).toBe(1)
  })

  it("informa hace cuántos minutos espera el más viejo", () => {
    const ahora = new Date()
    const r = resumirCola([turno("a", "carnet", 40), turno("b", "carnet", 5)], box, nombres, ahora)
    expect(r.esperaMasVieja).toBe(40)
  })

  it("con la cola vacía no inventa una espera", () => {
    const r = resumirCola([], box, nombres)
    expect(r.total).toBe(0)
    expect(r.esperaMasVieja).toBeNull()
  })

  it("omite las líneas en cero: el operador ve lo que hay, no lo que falta", () => {
    const r = resumirCola([turno("a", "carnet", 5)], box, nombres)
    expect(r.lineas).toHaveLength(1)
  })
})
