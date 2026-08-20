import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { listarImportables, type FilaEmpleado } from "@/lib/admin/importacion"

const DNI_YA = "99999801"
const DNI_FALTA = "99999802"

const gente: FilaEmpleado[] = [
  { nombreUsuario: "yaesta", documento: DNI_YA, nombrePersona: "Ana", apellidoPersona: "Ramírez" },
  { nombreUsuario: "falta", documento: DNI_FALTA, nombrePersona: "Beto", apellidoPersona: "Sosa" },
]

const consultaFalsa = async () => gente

async function limpiar() {
  await prisma.empleado.deleteMany({
    where: { dniInstitucional: { in: [DNI_YA, DNI_FALTA] } },
  })
}

describe("listarImportables", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("marca yaEsta en quien ya fue importado al Turnero", async () => {
    await prisma.empleado.create({
      data: { dniInstitucional: DNI_YA, nombre: "Ramírez, Ana", rol: "operador" },
    })

    const filas = await listarImportables(consultaFalsa)

    expect(filas.find((f) => f.documento === DNI_YA)?.yaEsta).toBe(true)
    expect(filas.find((f) => f.documento === DNI_FALTA)?.yaEsta).toBe(false)
  })

  it("arma el nombre como Apellido, Nombre", async () => {
    const filas = await listarImportables(consultaFalsa)
    expect(filas.find((f) => f.documento === DNI_FALTA)?.nombre).toBe("Sosa, Beto")
  })

  it("un empleado dado de baja igual cuenta como ya importado", async () => {
    // Si apareciera como importable, importarlo lo reactivaria en silencio.
    // Mejor que se vea que ya esta y se lo reactive desde la tabla.
    await prisma.empleado.create({
      data: { dniInstitucional: DNI_YA, nombre: "Ramírez, Ana", rol: "operador", activo: false },
    })

    const filas = await listarImportables(consultaFalsa)
    expect(filas.find((f) => f.documento === DNI_YA)?.yaEsta).toBe(true)
  })

  it("devuelve la lista completa aunque no haya nadie importado", async () => {
    const filas = await listarImportables(consultaFalsa)
    expect(filas).toHaveLength(2)
    expect(filas.every((f) => !f.yaEsta)).toBe(true)
  })
})
