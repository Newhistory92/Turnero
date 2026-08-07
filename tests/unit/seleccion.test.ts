import { describe, it, expect } from "vitest"
import { siguienteTurno, colaDelBox } from "@/lib/queue/seleccion"
import type { BoxDominio, TurnoDominio } from "@/lib/queue/tipos"

const box: BoxDominio = {
  id: "b1",
  activo: true,
  horaApertura: "08:00",
  horaCierre: "13:00",
  diasSemana: "12345",
  tramiteIds: ["planes", "protesis"],
}

const turno = (
  id: string,
  tramiteId: string,
  minuto: number,
  estado: TurnoDominio["estado"] = "esperando"
): TurnoDominio => ({
  id,
  numero: id.toUpperCase(),
  tramiteId,
  estado,
  boxId: null,
  createdAt: new Date(2026, 7, 5, 10, minuto),
  derivadoDeId: null,
})

describe("colaDelBox", () => {
  it("solo incluye trámites del box y turnos en espera", () => {
    const cola = colaDelBox(
      [
        turno("a", "planes", 1),
        turno("b", "bioquimica", 2),
        turno("c", "protesis", 3),
        turno("d", "planes", 4, "llamado"),
      ],
      box
    )
    expect(cola.map((t) => t.id)).toEqual(["a", "c"])
  })
})

describe("siguienteTurno", () => {
  it("devuelve el más antiguo sin importar el trámite", () => {
    const r = siguienteTurno(
      [turno("nuevo", "planes", 30), turno("viejo", "protesis", 5)],
      box
    )
    expect(r?.id).toBe("viejo")
  })

  it("devuelve null si la cola está vacía", () => {
    expect(siguienteTurno([], box)).toBeNull()
  })

  it("devuelve null si no hay turnos de sus trámites", () => {
    expect(siguienteTurno([turno("x", "bioquimica", 1)], box)).toBeNull()
  })

  it("ignora los turnos ya llamados", () => {
    expect(siguienteTurno([turno("x", "planes", 1, "llamado")], box)).toBeNull()
  })
})
