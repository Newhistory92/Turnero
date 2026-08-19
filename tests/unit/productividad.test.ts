import { describe, it, expect } from "vitest"
import {
  medianasPorTramite,
  porEmpleado,
  type AtencionEmpleado,
} from "@/lib/estadisticas/productividad"

function a(
  empleadoId: string,
  tramiteId: string,
  atencionSegundos: number | null,
  clasificacion: AtencionEmpleado["clasificacion"]
): AtencionEmpleado {
  return {
    empleadoId,
    empleadoNombre: `Emp ${empleadoId}`,
    tramiteId,
    atencionSegundos,
    clasificacion,
  }
}

describe("medianasPorTramite", () => {
  // Solo las validas entran en la mediana: incluir las anomalias la
  // arrastraria hacia abajo y todo el mundo pareceria lento contra ella.
  it("usa sólo las válidas", () => {
    const m = medianasPorTramite([
      a("e1", "t1", 300, "valida"),
      a("e1", "t1", 500, "valida"),
      a("e2", "t1", 10, "anomalia"),
      a("e2", "t1", 100, "breve"),
    ])
    expect(m.get("t1")).toBe(400)
  })

  it("separa por trámite", () => {
    const m = medianasPorTramite([
      a("e1", "t1", 300, "valida"),
      a("e1", "t2", 900, "valida"),
    ])
    expect(m.get("t1")).toBe(300)
    expect(m.get("t2")).toBe(900)
  })

  it("un trámite sin válidas no tiene mediana", () => {
    const m = medianasPorTramite([a("e1", "t1", 10, "anomalia")])
    expect(m.has("t1")).toBe(false)
  })
})

describe("porEmpleado", () => {
  it("cuenta atendidos y desglosa las tres categorías", () => {
    const r = porEmpleado([
      a("e1", "t1", 600, "valida"),
      a("e1", "t1", 100, "breve"),
      a("e1", "t1", 10, "anomalia"),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].atendidos).toBe(3)
    expect(r[0].validas).toBe(1)
    expect(r[0].breves).toBe(1)
    expect(r[0].anomalias).toBe(1)
    expect(r[0].tiempoTotalSegundos).toBe(710)
    expect(r[0].promedioSegundos).toBeCloseTo(710 / 3)
  })

  // El desvio compara contra la mediana DEL MISMO tramite: un promedio
  // global castigaria a quien atiende los tramites largos por el solo
  // hecho de atenderlos.
  it("el desvío compara contra la mediana del mismo trámite", () => {
    // Mediana de t1 = 300; mediana de t2 = 900.
    const r = porEmpleado([
      a("e1", "t1", 300, "valida"),
      a("e2", "t2", 900, "valida"),
      // e3 tarda 400 en t1 (100 sobre la mediana) y 800 en t2 (100 bajo).
      a("e3", "t1", 400, "valida"),
      a("e3", "t2", 800, "valida"),
    ])

    const e3 = r.find((l) => l.empleadoId === "e3")
    expect(e3).toBeDefined()
    // Promedio de (+100, -100) = 0: rinde en la mediana pese a que su
    // promedio crudo (600) no se parece al de nadie.
    expect(e3!.desvioContraMedianaSegundos).toBe(0)
  })

  it("el desvío ignora las no válidas", () => {
    const r = porEmpleado([
      a("e1", "t1", 300, "valida"),
      a("e1", "t1", 500, "valida"),
      a("e2", "t1", 900, "valida"),
      a("e2", "t1", 5, "anomalia"),
    ])
    // Mediana de t1 sobre validas [300, 500, 900] = 500.
    const e2 = r.find((l) => l.empleadoId === "e2")!
    expect(e2.desvioContraMedianaSegundos).toBe(400)
  })

  it("sin válidas el desvío es null, no cero", () => {
    const r = porEmpleado([a("e1", "t1", 10, "anomalia")])
    expect(r[0].desvioContraMedianaSegundos).toBeNull()
  })

  it("una atención sin tiempo no suma al total", () => {
    const r = porEmpleado([a("e1", "t1", null, null), a("e1", "t1", 300, "valida")])
    expect(r[0].atendidos).toBe(2)
    expect(r[0].tiempoTotalSegundos).toBe(300)
  })

  it("ordena por atendidos descendente", () => {
    const r = porEmpleado([
      a("e1", "t1", 300, "valida"),
      a("e2", "t1", 300, "valida"),
      a("e2", "t1", 300, "valida"),
    ])
    expect(r.map((l) => l.empleadoId)).toEqual(["e2", "e1"])
  })

  it("una lista vacía da vacío", () => {
    expect(porEmpleado([])).toEqual([])
  })
})
