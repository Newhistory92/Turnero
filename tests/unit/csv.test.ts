import { describe, it, expect } from "vitest"
import { aCsv, BOM, type FilaExportable } from "@/lib/estadisticas/csv"

function fila(p: Partial<FilaExportable> = {}): FilaExportable {
  return {
    numero: "AP01",
    fecha: "2026-08-19",
    tramiteNombre: "Aportes",
    estado: "finalizado",
    derivado: false,
    esperaSegundos: 300,
    boxNombre: "Box 1",
    empleadoNombre: "Pérez, Ana",
    atencionSegundos: 840,
    clasificacion: "valida",
    ...p,
  }
}

describe("aCsv", () => {
  // Sin BOM, Excel en Windows abre el archivo en la codificacion del sistema
  // y los acentos salen rotos.
  it("arranca con el BOM de UTF-8", () => {
    expect(aCsv([], true).startsWith(BOM)).toBe(true)
  })

  it("incluye las columnas de productividad para quien puede verlas", () => {
    const csv = aCsv([fila()], true)
    const [encabezado, primera] = csv.replace(BOM, "").split("\r\n")
    expect(encabezado).toContain("operador")
    expect(encabezado).toContain("atencion_segundos")
    expect(encabezado).toContain("clasificacion")
    expect(primera).toContain("Pérez, Ana")
    expect(primera).toContain("840")
  })

  // El CSV es la puerta de atras clasica: si la pantalla filtra y el archivo
  // no, el control de acceso no existe.
  it("omite las columnas de productividad para quien no puede verlas", () => {
    const csv = aCsv([fila()], false)
    const [encabezado, primera] = csv.replace(BOM, "").split("\r\n")
    expect(encabezado).not.toContain("operador")
    expect(encabezado).not.toContain("atencion_segundos")
    expect(encabezado).not.toContain("clasificacion")
    expect(primera).not.toContain("Pérez, Ana")
    expect(primera).not.toContain("840")
    // Lo que no es productividad sigue estando.
    expect(encabezado).toContain("numero")
    expect(primera).toContain("AP01")
  })

  // "Pérez, Ana" lleva coma: sin comillas partiria la fila en dos columnas.
  it("encierra los campos entre comillas", () => {
    const csv = aCsv([fila({ tramiteNombre: "Otros, varios" })], false)
    expect(csv).toContain('"Otros, varios"')
  })

  it("escapa las comillas duplicándolas", () => {
    const csv = aCsv([fila({ tramiteNombre: 'El "especial"' })], false)
    expect(csv).toContain('"El ""especial"""')
  })

  it("los nulos quedan como celda vacía", () => {
    const csv = aCsv([fila({ esperaSegundos: null, atencionSegundos: null })], true)
    const primera = csv.replace(BOM, "").split("\r\n")[1]
    expect(primera).toContain('""')
  })

  it("el booleano derivado sale como sí o no", () => {
    expect(aCsv([fila({ derivado: true })], false)).toContain('"sí"')
    expect(aCsv([fila({ derivado: false })], false)).toContain('"no"')
  })

  it("sin filas devuelve sólo el encabezado", () => {
    const lineas = aCsv([], false).replace(BOM, "").split("\r\n")
    expect(lineas).toHaveLength(1)
  })
})
