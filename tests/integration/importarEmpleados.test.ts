import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { importarEmpleados, type FilaEmpleado } from "@/scripts/importarEmpleados"

const gente: FilaEmpleado[] = [
  { nombreUsuario: "silviaflores", documento: "25319010", nombrePersona: "Silvia", apellidoPersona: "Flores" },
  { nombreUsuario: "gonzalotello", documento: "32878228", nombrePersona: "Gonzalo", apellidoPersona: "Tello" },
]

const consultaFalsa = async (usuarios: string[]) =>
  gente.filter((g) => usuarios.includes(g.nombreUsuario))

beforeEach(async () => {
  await prisma.sesionOperador.deleteMany()
  await prisma.empleadoBox.deleteMany()
  await prisma.empleado.deleteMany()
})

describe("importarEmpleados", () => {
  it("crea los empleados pedidos con el documento como llave", async () => {
    const r = await importarEmpleados(["silviaflores", "gonzalotello"], consultaFalsa)
    expect(r.creados).toBe(2)

    const silvia = await prisma.empleado.findUniqueOrThrow({
      where: { dniInstitucional: "25319010" },
    })
    expect(silvia.nombre).toBe("Flores, Silvia")
    expect(silvia.rol).toBe("operador")
    expect(silvia.activo).toBe(true)
  })

  it("importa sólo los pedidos, no todos los empleados de la institución", async () => {
    await importarEmpleados(["silviaflores"], consultaFalsa)
    expect(await prisma.empleado.count()).toBe(1)
  })

  it("es idempotente: correrlo dos veces no duplica", async () => {
    await importarEmpleados(["silviaflores"], consultaFalsa)
    const segunda = await importarEmpleados(["silviaflores"], consultaFalsa)
    expect(segunda.creados).toBe(0)
    expect(segunda.actualizados).toBe(1)
    expect(await prisma.empleado.count()).toBe(1)
  })

  it("informa los usuarios que no encontró en vez de fallar en silencio", async () => {
    const r = await importarEmpleados(["silviaflores", "fantasma"], consultaFalsa)
    expect(r.noEncontrados).toEqual(["fantasma"])
    expect(r.creados).toBe(1)
  })
})
