import { describe, it, expect, beforeEach } from "vitest"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { login } from "@/lib/auth/operador"
import type { FilaUsuario } from "@/lib/auth/institucional"

const hash = bcrypt.hashSync("secreta123", 10)

const silviaInstitucional: FilaUsuario = {
  nombreUsuario: "silviaflores",
  claveUsuario: hash,
  anulado: false,
  esAfiliado: false,
  documento: "25319010",
  nombrePersona: "Silvia",
  apellidoPersona: "Flores",
}

const verificarFalso = (filas: FilaUsuario[]) => async () => filas

async function escenario(conEmpleado = true) {
  await prisma.sesionOperador.deleteMany()
  await prisma.empleadoBox.deleteMany()
  await prisma.empleado.deleteMany()

  const box = await prisma.box.findFirstOrThrow()
  const otroBox = await prisma.box.findFirstOrThrow({ where: { id: { not: box.id } } })

  if (conEmpleado) {
    const e = await prisma.empleado.create({
      data: { dniInstitucional: "25319010", nombre: "Flores, Silvia", rol: "operador" },
    })
    await prisma.empleadoBox.create({ data: { empleadoId: e.id, boxId: box.id } })
  }
  return { box, otroBox }
}

describe("login del operador", () => {
  it("con credencial válida y empleado habilitado, abre sesión", async () => {
    const ctx = await escenario()
    const r = await login("silviaflores", "secreta123", ctx.box.id, verificarFalso([silviaInstitucional]))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.empleado.nombre).toBe("Flores, Silvia")
      expect(r.boxId).toBe(ctx.box.id)
    }
  })

  it("rechaza la clave incorrecta", async () => {
    const ctx = await escenario()
    const r = await login("silviaflores", "mala", ctx.box.id, verificarFalso([silviaInstitucional]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("CREDENCIAL_INVALIDA")
  })

  it("credencial válida pero sin alta en el turnero: mensaje específico, porque ya se autenticó", async () => {
    const ctx = await escenario(false)
    const r = await login("silviaflores", "secreta123", ctx.box.id, verificarFalso([silviaInstitucional]))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.codigo).toBe("NO_HABILITADO")
      expect(r.mensaje).toContain("no estás habilitado")
    }
  })

  it("rechaza un box que no tiene asignado", async () => {
    const ctx = await escenario()
    const r = await login("silviaflores", "secreta123", ctx.otroBox.id, verificarFalso([silviaInstitucional]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("BOX_NO_ASIGNADO")
  })

  it("rechaza si el box está ocupado con latido fresco", async () => {
    const ctx = await escenario()
    await login("silviaflores", "secreta123", ctx.box.id, verificarFalso([silviaInstitucional]))
    const r = await login("silviaflores", "secreta123", ctx.box.id, verificarFalso([silviaInstitucional]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("BOX_OCUPADO")
  })

  it("no devuelve nada parecido a la clave ni al hash", async () => {
    const ctx = await escenario()
    const r = await login("silviaflores", "secreta123", ctx.box.id, verificarFalso([silviaInstitucional]))
    const serializado = JSON.stringify(r)
    expect(serializado).not.toContain("secreta123")
    expect(serializado).not.toContain("$2")
  })

  it("no guarda la clave en la base del turnero", async () => {
    const ctx = await escenario()
    await login("silviaflores", "secreta123", ctx.box.id, verificarFalso([silviaInstitucional]))
    const empleado = await prisma.empleado.findUniqueOrThrow({
      where: { dniInstitucional: "25319010" },
    })
    expect(JSON.stringify(empleado)).not.toContain("secreta123")
    expect(JSON.stringify(empleado)).not.toContain("$2")
  })
})
