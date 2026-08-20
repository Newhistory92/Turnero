import { prisma } from "@/lib/db"
import { SQL_EMPLEADOS } from "@/lib/auth/institucional"

export interface FilaEmpleado {
  nombreUsuario: string
  documento: string
  nombrePersona: string | null
  apellidoPersona: string | null
}

export type Consulta = (usuarios: string[]) => Promise<FilaEmpleado[]>

const consultaReal: Consulta = async (usuarios) => {
  // Los nombres de usuario van como parametros; el WHERE de SQL_EMPLEADOS es
  // constante y no lleva entrada del usuario.
  const lista = usuarios.map((_, i) => `@P${i + 1}`).join(", ")
  const sql = `
    SELECT
      LTRIM(RTRIM(u.nombreUsuario)) AS nombreUsuario,
      LTRIM(RTRIM(p.numeroDocPersona)) AS documento,
      LTRIM(RTRIM(p.nombrePersona)) AS nombrePersona,
      LTRIM(RTRIM(p.apellidoPersona)) AS apellidoPersona
    FROM [ObraSocial].[dbo].[Usuario] u
    JOIN [ObraSocial].[dbo].[Persona] p ON p.idPersona = u.idPersona
    WHERE u.anulado = 0
      AND ${SQL_EMPLEADOS}
      AND u.nombreUsuario IN (${lista})
  `
  return prisma.$queryRawUnsafe<FilaEmpleado[]>(sql, ...usuarios)
}

export function nombreCompleto(f: FilaEmpleado): string {
  const apellido = f.apellidoPersona?.trim() ?? ""
  const nombre = f.nombrePersona?.trim() ?? ""
  return apellido && nombre ? `${apellido}, ${nombre}` : apellido || nombre || f.nombreUsuario
}

export async function importarEmpleados(
  usuarios: string[],
  consulta: Consulta = consultaReal
): Promise<{ creados: number; actualizados: number; noEncontrados: string[] }> {
  if (usuarios.length === 0) return { creados: 0, actualizados: 0, noEncontrados: [] }

  const filas = await consulta(usuarios)
  const encontrados = new Set(filas.map((f) => f.nombreUsuario))
  const noEncontrados = usuarios.filter((u) => !encontrados.has(u))

  let creados = 0
  let actualizados = 0

  for (const fila of filas) {
    const existente = await prisma.empleado.findUnique({
      where: { dniInstitucional: fila.documento },
    })
    if (existente) {
      // No se toca el rol a proposito: un supervisor dado de baja que se
      // reimporta vuelve como supervisor, no degradado a operador.
      await prisma.empleado.update({
        where: { dniInstitucional: fila.documento },
        data: { nombre: nombreCompleto(fila), activo: true },
      })
      actualizados++
    } else {
      await prisma.empleado.create({
        data: {
          dniInstitucional: fila.documento,
          nombre: nombreCompleto(fila),
          rol: "operador",
        },
      })
      creados++
    }
  }

  return { creados, actualizados, noEncontrados }
}

export interface Importable {
  nombreUsuario: string
  documento: string
  nombre: string
  yaEsta: boolean
}

export type ConsultaTodos = () => Promise<FilaEmpleado[]>

const consultaTodosReal: ConsultaTodos = () =>
  prisma.$queryRawUnsafe<FilaEmpleado[]>(`
    SELECT
      LTRIM(RTRIM(u.nombreUsuario)) AS nombreUsuario,
      LTRIM(RTRIM(p.numeroDocPersona)) AS documento,
      LTRIM(RTRIM(p.nombrePersona)) AS nombrePersona,
      LTRIM(RTRIM(p.apellidoPersona)) AS apellidoPersona
    FROM [ObraSocial].[dbo].[Usuario] u
    JOIN [ObraSocial].[dbo].[Persona] p ON p.idPersona = u.idPersona
    WHERE u.anulado = 0
      AND ${SQL_EMPLEADOS}
    ORDER BY p.apellidoPersona, p.nombrePersona
  `)

/**
 * Los empleados de la obra social, con la marca de quien ya esta en el
 * Turnero. El cruce se hace en memoria y no con un JOIN entre bases porque
 * son bases distintas y la lista ronda las 150 filas.
 */
export async function listarImportables(
  consulta: ConsultaTodos = consultaTodosReal
): Promise<Importable[]> {
  const filas = await consulta()

  const existentes = await prisma.empleado.findMany({
    where: { dniInstitucional: { in: filas.map((f) => f.documento) } },
    select: { dniInstitucional: true },
  })
  // Incluye a los inactivos: si un empleado dado de baja apareciera como
  // importable, importarlo lo reactivaria sin que se note.
  const ya = new Set(existentes.map((e) => e.dniInstitucional))

  return filas.map((f) => ({
    nombreUsuario: f.nombreUsuario,
    documento: f.documento,
    nombre: nombreCompleto(f),
    yaEsta: ya.has(f.documento),
  }))
}
