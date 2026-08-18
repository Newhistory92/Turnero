import { describe, it, expect, vi, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { abrirSesion, firmarCookie, NOMBRE_COOKIE } from "@/lib/auth/sesion"

const tarro = { get: vi.fn() }
vi.mock("next/headers", () => ({ cookies: async () => tarro }))

const { actorActual } = await import("@/lib/admin/acceso")

async function empleado(rol: string, activo = true) {
  return prisma.empleado.upsert({
    where: { dniInstitucional: `actor-${rol}-${activo}` },
    update: { rol, activo },
    create: { dniInstitucional: `actor-${rol}-${activo}`, nombre: "Prueba", rol, activo },
  })
}

async function sesionDe(rol: string, activo = true) {
  const e = await empleado(rol, activo)
  const r = await abrirSesion(e.id, null)
  if (!r.ok) throw new Error("no abrió")
  return r.sesionId
}

describe("actorActual", () => {
  beforeEach(async () => {
    tarro.get.mockReset()
    await prisma.sesionOperador.deleteMany()
  })
  afterAll(async () => {
    await prisma.sesionOperador.deleteMany()
    await prisma.$disconnect()
  })

  it("resuelve el rol desde la cookie firmada", async () => {
    const id = await sesionDe("admin")
    tarro.get.mockReturnValue({ value: firmarCookie(id) })
    expect((await actorActual())?.rol).toBe("admin")
  })

  it("sin cookie no hay actor", async () => {
    tarro.get.mockReturnValue(undefined)
    expect(await actorActual()).toBeNull()
  })

  // Una cookie con la firma cambiada es exactamente el ataque que el HMAC
  // existe para frenar.
  it("una cookie con firma inválida no vale", async () => {
    const id = await sesionDe("admin")
    tarro.get.mockReturnValue({ value: `${id}.firmafalsa` })
    expect(await actorActual()).toBeNull()
  })

  it("un empleado dado de baja no es actor aunque tenga sesión", async () => {
    const id = await sesionDe("admin", false)
    tarro.get.mockReturnValue({ value: firmarCookie(id) })
    expect(await actorActual()).toBeNull()
  })

  it("un rol fuera del vocabulario no es actor", async () => {
    const id = await sesionDe("root")
    tarro.get.mockReturnValue({ value: firmarCookie(id) })
    expect(await actorActual()).toBeNull()
  })
})
