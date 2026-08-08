import { describe, it, expect } from "vitest"
import { hardeningActivo, esTeclaBloqueada } from "@/lib/kiosco/hardening"

describe("hardeningActivo", () => {
  it("está apagado por defecto: no molesta en desarrollo", () => {
    expect(hardeningActivo({ env: undefined, busqueda: "" })).toBe(false)
  })
  it("se prende con la variable de entorno", () => {
    expect(hardeningActivo({ env: "on", busqueda: "" })).toBe(true)
  })
  it("se prende puntualmente con ?hardening=1", () => {
    expect(hardeningActivo({ env: undefined, busqueda: "?hardening=1" })).toBe(true)
  })
})

describe("esTeclaBloqueada", () => {
  it("bloquea F5, F11 y F12", () => {
    for (const key of ["F5", "F11", "F12"]) {
      expect(esTeclaBloqueada({ key, ctrlKey: false })).toBe(true)
    }
  })
  it("bloquea Ctrl+W, N, T, P y R", () => {
    for (const key of ["w", "n", "t", "p", "r"]) {
      expect(esTeclaBloqueada({ key, ctrlKey: true })).toBe(true)
    }
  })
  it("bloquea las mayúsculas también", () => {
    expect(esTeclaBloqueada({ key: "W", ctrlKey: true })).toBe(true)
  })
  it("deja pasar los dígitos", () => {
    expect(esTeclaBloqueada({ key: "5", ctrlKey: false })).toBe(false)
  })
})
