import { describe, it, expect } from "vitest"
import { GET } from "@/app/api/afiliados/[dni]/route"

function pedido(dni: string) {
  return GET(new Request(`http://localhost/api/afiliados/${dni}`), {
    params: Promise.resolve({ dni }),
  })
}

describe("GET /api/afiliados/[dni]", () => {
  it("devuelve el nombre de un DNI conocido del stub", async () => {
    const r = await pedido("20123456")
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ nombre: "Juan Pérez" })
  })

  it("devuelve 200 con nombre null si no lo encuentra", async () => {
    const r = await pedido("99999999")
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ nombre: null })
  })

  it("nunca devuelve error: un DNI inválido también da nombre null", async () => {
    const r = await pedido("abc")
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ nombre: null })
  })
})
