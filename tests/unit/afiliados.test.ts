import { describe, it, expect, vi } from "vitest"
import { RepositorioStub, conTimeout } from "@/lib/afiliados/repositorio"

describe("RepositorioStub", () => {
  it("encuentra un DNI conocido", async () => {
    const r = await new RepositorioStub().buscarPorDni("20123456")
    expect(r?.nombre).toBe("Juan Pérez")
  })

  it("devuelve null para un DNI desconocido", async () => {
    expect(await new RepositorioStub().buscarPorDni("99999999")).toBeNull()
  })
})

describe("conTimeout", () => {
  it("devuelve el valor si llega a tiempo", async () => {
    const r = await conTimeout(Promise.resolve({ nombre: "Ana" }), 1000)
    expect(r?.nombre).toBe("Ana")
  })

  it("devuelve null si se pasa del límite", async () => {
    vi.useFakeTimers()
    const lenta = new Promise<{ nombre: string }>((res) =>
      setTimeout(() => res({ nombre: "Tarde" }), 5000)
    )
    const promesa = conTimeout(lenta, 1500)
    await vi.advanceTimersByTimeAsync(1600)
    expect(await promesa).toBeNull()
    vi.useRealTimers()
  })

  it("devuelve null si la promesa rechaza", async () => {
    expect(await conTimeout(Promise.reject(new Error("SQL caído")), 1000)).toBeNull()
  })
})
