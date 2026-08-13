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

function nombreCompleto(f: FilaEmpleado): string {
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

// Uso: npm run importar:empleados -- silviaflores gonzalotello
if (process.argv[1]?.includes("importarEmpleados")) {
  const usuarios = process.argv.slice(2)
  if (usuarios.length === 0) {
    console.error("Pasá al menos un nombreUsuario. Ej: npm run importar:empleados -- silviaflores")
    process.exit(1)
  }
  importarEmpleados(usuarios)
    .then((r) => {
      console.log(`Creados: ${r.creados} · Actualizados: ${r.actualizados}`)
      if (r.noEncontrados.length > 0) {
        console.warn(`No encontrados (no son empleados o están anulados): ${r.noEncontrados.join(", ")}`)
      }
    })
    .catch((e) => {
      console.error("Falló la importación:", e.message)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
