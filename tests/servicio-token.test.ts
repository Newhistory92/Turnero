import { describe, expect, it, beforeEach, afterEach } from "vitest"
import { tokenDeServicioValido } from "@/lib/auth/servicio"

const ORIGINAL = process.env.TURNERO_SERVICE_TOKEN

beforeEach(() => {
  process.env.TURNERO_SERVICE_TOKEN = "token-de-prueba"
})

afterEach(() => {
  process.env.TURNERO_SERVICE_TOKEN = ORIGINAL
})

describe("tokenDeServicioValido", () => {
  it("acepta el token configurado", () => {
    expect(tokenDeServicioValido("Bearer token-de-prueba")).toBe(true)
  })

  it("rechaza un token distinto", () => {
    expect(tokenDeServicioValido("Bearer otro")).toBe(false)
  })

  it("rechaza si falta el header", () => {
    expect(tokenDeServicioValido(null)).toBe(false)
  })

  it("rechaza si falta el prefijo Bearer", () => {
    expect(tokenDeServicioValido("token-de-prueba")).toBe(false)
  })

  it("rechaza todo si no hay token configurado", () => {
    // Sin secreto configurado el endpoint queda cerrado, nunca abierto: un
    // deploy al que se le olvido la variable no debe exponer el rendimiento
    // de cada operador a cualquiera.
    delete process.env.TURNERO_SERVICE_TOKEN
    expect(tokenDeServicioValido("Bearer token-de-prueba")).toBe(false)
  })
})
