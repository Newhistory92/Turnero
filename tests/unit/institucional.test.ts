import { describe, it, expect } from "vitest"
import bcrypt from "bcryptjs"
import { verificarCredencial, type FilaUsuario } from "@/lib/auth/institucional"

const hash = bcrypt.hashSync("secreta123", 10)

function consultaFalsa(filas: FilaUsuario[]) {
  return async () => filas
}

const activo: FilaUsuario = {
  nombreUsuario: "silviaflores",
  claveUsuario: hash,
  anulado: false,
  esAfiliado: false,
  documento: "25319010",
  nombrePersona: "Silvia",
  apellidoPersona: "Flores",
}

describe("verificarCredencial", () => {
  it("acepta la clave correcta y devuelve documento y nombre", async () => {
    const r = await verificarCredencial("silviaflores", "secreta123", consultaFalsa([activo]))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.usuario.documento).toBe("25319010")
      expect(r.usuario.nombreCompleto).toBe("Flores, Silvia")
    }
  })

  it("rechaza la clave incorrecta", async () => {
    const r = await verificarCredencial("silviaflores", "otra", consultaFalsa([activo]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("CREDENCIAL_INVALIDA")
  })

  it("rechaza al usuario anulado", async () => {
    const r = await verificarCredencial("x", "secreta123", consultaFalsa([{ ...activo, anulado: true }]))
    expect(r.ok).toBe(false)
  })

  it("rechaza al afiliado: el portal web no es el turnero", async () => {
    const r = await verificarCredencial("x", "secreta123", consultaFalsa([{ ...activo, esAfiliado: true }]))
    expect(r.ok).toBe(false)
  })

  it("rechaza al usuario inexistente", async () => {
    const r = await verificarCredencial("nadie", "secreta123", consultaFalsa([]))
    expect(r.ok).toBe(false)
  })

  it("da el mismo mensaje ante cualquier fallo, para no confirmar qué usuarios existen", async () => {
    const inexistente = await verificarCredencial("nadie", "x", consultaFalsa([]))
    const claveMala = await verificarCredencial("silviaflores", "x", consultaFalsa([activo]))
    const anulado = await verificarCredencial("x", "secreta123", consultaFalsa([{ ...activo, anulado: true }]))
    if (inexistente.ok || claveMala.ok || anulado.ok) throw new Error("deberían fallar las tres")
    expect(claveMala.mensaje).toBe(inexistente.mensaje)
    expect(anulado.mensaje).toBe(inexistente.mensaje)
  })

  it("nunca devuelve el hash", async () => {
    const r = await verificarCredencial("silviaflores", "secreta123", consultaFalsa([activo]))
    expect(JSON.stringify(r)).not.toContain("$2")
  })
})
