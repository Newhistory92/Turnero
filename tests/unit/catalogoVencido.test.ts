import { describe, it, expect } from "vitest"
import { sePuedeRefrescar } from "@/lib/kiosco/catalogoVencido"

describe("sePuedeRefrescar", () => {
  // Ocioso: nadie perdio nada si la pagina se recarga ahora.
  it("en el paso del DNI sin nada tipeado, sí", () => {
    expect(sePuedeRefrescar("dni", "")).toBe(true)
  })

  // Recargar acá le borra los digitos sin explicación.
  it("en el paso del DNI con dígitos tipeados, no", () => {
    expect(sePuedeRefrescar("dni", "2")).toBe(false)
    expect(sePuedeRefrescar("dni", "20123456")).toBe(false)
  })

  it("en cualquier otro paso, no", () => {
    expect(sePuedeRefrescar("categoria", "")).toBe(false)
    expect(sePuedeRefrescar("tramite", "")).toBe(false)
    expect(sePuedeRefrescar("resultado", "")).toBe(false)
  })

  // El paso de error ya esta pidiendo reintentar: refrescar solo ayuda.
  it("en el paso de error, sí", () => {
    expect(sePuedeRefrescar("error", "")).toBe(true)
  })
})
