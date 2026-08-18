import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { abrirSesion, sesionActiva } from "@/lib/auth/sesion"

async function limpiar() {
  await prisma.sesionOperador.deleteMany()
}

async function empleadoDePrueba(rol: string) {
  return prisma.empleado.upsert({
    where: { dniInstitucional: `admin-${rol}` },
    update: { rol },
    create: { dniInstitucional: `admin-${rol}`, nombre: `Prueba ${rol}`, rol },
  })
}

describe("sesión sin box", () => {
  beforeEach(limpiar)
  afterAll(async () => {
    await limpiar()
    await prisma.$disconnect()
  })

  it("abre sesión sin box sin exigir asignación en EmpleadoBox", async () => {
    const e = await empleadoDePrueba("admin")
    const r = await abrirSesion(e.id, null)
    expect(r.ok).toBe(true)
  })

  it("la sesión sin box se resuelve con boxId nulo", async () => {
    const e = await empleadoDePrueba("admin")
    const r = await abrirSesion(e.id, null)
    if (!r.ok) throw new Error("no abrió")

    const activa = await sesionActiva(r.sesionId)
    expect(activa?.boxId).toBeNull()
  })

  // Dos admins trabajando a la vez no compiten por ningún recurso fisico,
  // asi que la exclusividad de box no puede aplicarles.
  it("dos sesiones sin box conviven", async () => {
    const a = await empleadoDePrueba("admin")
    const b = await empleadoDePrueba("supervisor")
    expect((await abrirSesion(a.id, null)).ok).toBe(true)
    expect((await abrirSesion(b.id, null)).ok).toBe(true)
  })

  it("sigue exigiendo asignación cuando sí hay box", async () => {
    const e = await empleadoDePrueba("operador")
    const box = await prisma.box.findFirstOrThrow()
    const r = await abrirSesion(e.id, box.id)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("no debía abrir")
    expect(r.codigo).toBe("BOX_NO_ASIGNADO")
  })
})
