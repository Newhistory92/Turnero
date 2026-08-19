import { describe, it, expect } from "vitest"
import { pares, cadenas, type TurnoDerivacion } from "@/lib/estadisticas/derivaciones"

function t(
  id: string,
  tramiteId: string,
  tramiteNombre: string,
  derivadoDeId: string | null = null
): TurnoDerivacion {
  return { id, numero: "AP01", tramiteId, tramiteNombre, derivadoDeId }
}

describe("pares origen→destino", () => {
  it("arma el par siguiendo derivadoDeId", () => {
    const r = pares([
      t("a", "t1", "Aportes"),
      t("b", "t2", "Prótesis", "a"),
    ])
    expect(r).toEqual([
      {
        origenTramiteId: "t1",
        origenNombre: "Aportes",
        destinoTramiteId: "t2",
        destinoNombre: "Prótesis",
        cuantas: 1,
      },
    ])
  })

  it("acumula el mismo par y ordena por cantidad", () => {
    const r = pares([
      t("a", "t1", "Aportes"),
      t("b", "t2", "Prótesis", "a"),
      t("c", "t1", "Aportes"),
      t("d", "t2", "Prótesis", "c"),
      t("e", "t1", "Aportes"),
      t("f", "t3", "Bioquímica", "e"),
    ])
    expect(r.map((p) => [p.destinoNombre, p.cuantas])).toEqual([
      ["Prótesis", 2],
      ["Bioquímica", 1],
    ])
  })

  // Si el origen quedo fuera del rango consultado no se puede nombrar el
  // par. Inventar un origen seria peor que omitir la fila.
  it("omite el derivado cuyo origen no está en la lista", () => {
    expect(pares([t("b", "t2", "Prótesis", "fuera-del-rango")])).toEqual([])
  })

  it("una lista sin derivaciones da vacío", () => {
    expect(pares([t("a", "t1", "Aportes"), t("b", "t2", "Prótesis")])).toEqual([])
  })
})

describe("cadenas", () => {
  // Tres o mas turnos encadenados suelen significar que nadie sabe de quien
  // es el tramite. Con dos todavia es una derivacion normal.
  it("una derivación simple no llega al mínimo de tres", () => {
    const r = cadenas([t("a", "t1", "Aportes"), t("b", "t2", "Prótesis", "a")])
    expect(r).toEqual([])
  })

  it("encuentra la cadena de tres y la devuelve de raíz a hoja", () => {
    const r = cadenas([
      t("a", "t1", "Aportes"),
      t("b", "t2", "Prótesis", "a"),
      t("c", "t3", "Bioquímica", "b"),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].turnoIds).toEqual(["a", "b", "c"])
    expect(r[0].tramiteNombres).toEqual(["Aportes", "Prótesis", "Bioquímica"])
  })

  // Solo la hoja genera cadena: si contaramos desde cada nodo, una cadena de
  // cuatro se reportaria tambien como su sub-cadena de tres.
  it("no reporta las sub-cadenas de una cadena más larga", () => {
    const r = cadenas([
      t("a", "t1", "Uno"),
      t("b", "t2", "Dos", "a"),
      t("c", "t3", "Tres", "b"),
      t("d", "t4", "Cuatro", "c"),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].turnoIds).toEqual(["a", "b", "c", "d"])
  })

  it("respeta un mínimo distinto", () => {
    const r = cadenas([t("a", "t1", "Aportes"), t("b", "t2", "Prótesis", "a")], 2)
    expect(r).toHaveLength(1)
    expect(r[0].turnoIds).toEqual(["a", "b"])
  })

  it("un turno suelto no es cadena", () => {
    expect(cadenas([t("a", "t1", "Aportes")])).toEqual([])
  })
})
