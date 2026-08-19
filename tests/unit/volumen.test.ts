import { describe, it, expect } from "vitest"
import {
  porTramite,
  porDia,
  porHora,
  porTramiteYEstado,
  porHoraYEstado,
  promedio,
  mediana,
  esPersona,
  type TurnoVolumen,
} from "@/lib/estadisticas/volumen"

function turno(p: Partial<TurnoVolumen> & { id: string }): TurnoVolumen {
  return {
    tramiteId: "t1",
    tramiteNombre: "Aportes",
    derivadoDeId: null,
    estado: "finalizado",
    generadoEn: new Date("2026-08-19T10:00:00-03:00"),
    esperaSegundos: 300,
    ...p,
  }
}

describe("promedio y mediana", () => {
  it("promedian ignorando los nulos", () => {
    expect(promedio([10, 20, null, 30])).toBe(20)
  })

  it("la mediana impar es el del medio", () => {
    expect(mediana([30, 10, 20])).toBe(20)
  })

  it("la mediana par promedia los dos del medio", () => {
    expect(mediana([10, 20, 30, 40])).toBe(25)
  })

  // Sin muestras no hay promedio. Devolver 0 se leeria como "tardaron cero".
  it("sin muestras devuelven null, no cero", () => {
    expect(promedio([])).toBeNull()
    expect(promedio([null, null])).toBeNull()
    expect(mediana([])).toBeNull()
  })
})

describe("personas contra atenciones", () => {
  // Una persona derivada deja dos filas en Turno. Contarlas como dos
  // personas convertiria un dia de muchas derivaciones en un dia de mucha
  // demanda, que es una conclusion distinta y falsa.
  it("el derivado es una atención más, no una persona más", () => {
    expect(esPersona({ derivadoDeId: null })).toBe(true)
    expect(esPersona({ derivadoDeId: "otro" })).toBe(false)
  })

  it("porTramite separa las dos magnitudes", () => {
    const r = porTramite([
      turno({ id: "a" }),
      turno({ id: "b" }),
      turno({ id: "c", derivadoDeId: "a", tramiteId: "t2", tramiteNombre: "Prótesis" }),
    ])

    expect(r).toEqual([
      { tramiteId: "t1", tramiteNombre: "Aportes", personas: 2, atenciones: 2 },
      { tramiteId: "t2", tramiteNombre: "Prótesis", personas: 0, atenciones: 1 },
    ])
  })

  it("ordena por personas descendente y desempata por nombre", () => {
    const r = porTramite([
      turno({ id: "a", tramiteId: "t2", tramiteNombre: "Zeta" }),
      turno({ id: "b", tramiteId: "t1", tramiteNombre: "Alfa" }),
      turno({ id: "c", tramiteId: "t3", tramiteNombre: "Beta" }),
      turno({ id: "d", tramiteId: "t3", tramiteNombre: "Beta" }),
    ])
    expect(r.map((l) => l.tramiteNombre)).toEqual(["Beta", "Alfa", "Zeta"])
  })
})

describe("porDia", () => {
  it("agrupa personas por fecha local en orden ascendente", () => {
    const r = porDia([
      turno({ id: "a", generadoEn: new Date("2026-08-19T10:00:00-03:00") }),
      turno({ id: "b", generadoEn: new Date("2026-08-18T11:00:00-03:00") }),
      turno({ id: "c", generadoEn: new Date("2026-08-19T15:00:00-03:00") }),
      turno({ id: "d", derivadoDeId: "a", generadoEn: new Date("2026-08-19T16:00:00-03:00") }),
    ])
    expect(r).toEqual([
      { fecha: "2026-08-18", personas: 1 },
      { fecha: "2026-08-19", personas: 2 },
    ])
  })

  it("descarta los que no tienen evento generado", () => {
    const r = porDia([turno({ id: "a", generadoEn: null })])
    expect(r).toEqual([])
  })
})

describe("porHora", () => {
  // Siempre 24 buckets para que el grafico tenga un eje estable entre
  // rangos: si el largo dependiera de los datos, dos consultas seguidas
  // dibujarian ejes distintos.
  it("devuelve las 24 horas siempre", () => {
    const r = porHora([])
    expect(r).toHaveLength(24)
    expect(r[0]).toEqual({ hora: 0, personas: 0 })
    expect(r[23]).toEqual({ hora: 23, personas: 0 })
  })

  it("cuenta sólo personas en su hora local", () => {
    const r = porHora([
      turno({ id: "a", generadoEn: new Date("2026-08-19T09:30:00-03:00") }),
      turno({ id: "b", generadoEn: new Date("2026-08-19T09:45:00-03:00") }),
      turno({ id: "c", generadoEn: new Date("2026-08-19T14:10:00-03:00") }),
      turno({ id: "d", derivadoDeId: "a", generadoEn: new Date("2026-08-19T09:50:00-03:00") }),
    ])
    expect(r[9]).toEqual({ hora: 9, personas: 2 })
    expect(r[14]).toEqual({ hora: 14, personas: 1 })
  })
})

describe("ausentes y abandonos", () => {
  it("cuenta por trámite sólo los estados pedidos", () => {
    const r = porTramiteYEstado(
      [
        turno({ id: "a", estado: "ausente" }),
        turno({ id: "b", estado: "abandonado" }),
        turno({ id: "c", estado: "finalizado" }),
        turno({ id: "d", estado: "ausente", tramiteId: "t2", tramiteNombre: "Prótesis" }),
      ],
      ["ausente"]
    )
    expect(r).toEqual([
      { tramiteId: "t1", tramiteNombre: "Aportes", cuantos: 1 },
      { tramiteId: "t2", tramiteNombre: "Prótesis", cuantos: 1 },
    ])
  })

  // Un tramite sin ausentes no aparece en la tabla: una fila en cero se
  // leeria como una medicion, y lo que hubo es ausencia de casos.
  it("omite los trámites sin ninguno de esos estados", () => {
    const r = porTramiteYEstado([turno({ id: "a", estado: "finalizado" })], ["ausente"])
    expect(r).toEqual([])
  })

  it("acepta varios estados a la vez y ordena descendente", () => {
    const r = porTramiteYEstado(
      [
        turno({ id: "a", estado: "ausente" }),
        turno({ id: "b", estado: "abandonado" }),
        turno({ id: "c", estado: "ausente", tramiteId: "t2", tramiteNombre: "Prótesis" }),
      ],
      ["ausente", "abandonado"]
    )
    expect(r.map((l) => [l.tramiteNombre, l.cuantos])).toEqual([
      ["Aportes", 2],
      ["Prótesis", 1],
    ])
  })

  // A diferencia del volumen, aca SI cuentan los derivados: un derivado que
  // no se presenta en el segundo box es una ausencia real de ese box.
  it("los derivados cuentan como ausencia propia", () => {
    const r = porTramiteYEstado(
      [turno({ id: "b", estado: "ausente", derivadoDeId: "a" })],
      ["ausente"]
    )
    expect(r[0].cuantos).toBe(1)
  })

  it("por hora devuelve 24 buckets y cuenta en la hora local", () => {
    const r = porHoraYEstado(
      [
        turno({
          id: "a",
          estado: "ausente",
          generadoEn: new Date("2026-08-19T11:20:00-03:00"),
        }),
        turno({
          id: "b",
          estado: "finalizado",
          generadoEn: new Date("2026-08-19T11:40:00-03:00"),
        }),
      ],
      ["ausente"]
    )
    expect(r).toHaveLength(24)
    expect(r[11]).toEqual({ hora: 11, cuantos: 1 })
    expect(r[12]).toEqual({ hora: 12, cuantos: 0 })
  })
})
