import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { login, accesoDe } from "@/lib/auth/operador"
import type { FilaUsuario } from "@/lib/auth/institucional"

const DOC = "90000001"

// La consulta institucional se inyecta: el test nunca toca la base de la
// obra social ni manipula claves reales.
const consultaOk = async (): Promise<FilaUsuario[]> => [
  {
    documento: DOC,
    nombreUsuario: "admin.prueba",
    claveUsuario: "$2a$10$abcdefghijklmnopqrstuv",
    apellido: "Prueba",
    nombre: "Admin",
    esAfiliado: 0,
  } as unknown as FilaUsuario,
]

async function sembrarEmpleado(rol: string) {
  return prisma.empleado.upsert({
    where: { dniInstitucional: DOC },
    update: { rol, activo: true },
    create: { dniInstitucional: DOC, nombre: "Admin Prueba", rol, activo: true },
  })
}

describe("login del panel", () => {
  beforeEach(async () => {
    await prisma.sesionOperador.deleteMany()
  })
  afterAll(async () => {
    await prisma.sesionOperador.deleteMany()
    await prisma.empleado.deleteMany({ where: { dniInstitucional: DOC } })
    await prisma.$disconnect()
  })

  it("accesoDe devuelve el rol junto con los boxes", async () => {
    await sembrarEmpleado("admin")
    const a = await accesoDe(DOC)
    expect(a.rol).toBe("admin")
    expect(Array.isArray(a.boxes)).toBe(true)
  })

  it("accesoDe devuelve rol nulo para quien no está en el turnero", async () => {
    const a = await accesoDe("00000000")
    expect(a.rol).toBeNull()
    expect(a.boxes).toEqual([])
  })
})
