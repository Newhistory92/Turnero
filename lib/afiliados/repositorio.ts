import { prisma } from "@/lib/db"

export interface Afiliado {
  nombre: string
}

export interface RepositorioAfiliados {
  buscarPorDni(dni: string): Promise<Afiliado | null>
}

/** Corta a los ms indicados y traga cualquier error. Nunca lanza. */
export async function conTimeout<T>(
  promesa: Promise<T>,
  ms: number
): Promise<T | null> {
  let temporizador: ReturnType<typeof setTimeout>
  const limite = new Promise<null>((resolve) => {
    temporizador = setTimeout(() => resolve(null), ms)
  })
  try {
    return await Promise.race([promesa.catch(() => null), limite])
  } finally {
    clearTimeout(temporizador!)
  }
}

export class RepositorioStub implements RepositorioAfiliados {
  private datos: Record<string, string> = {
    "20123456": "Juan Pérez",
    "27888999": "María Gómez",
    "33444555": "Carlos Díaz",
  }

  async buscarPorDni(dni: string): Promise<Afiliado | null> {
    const nombre = this.datos[dni]
    return nombre ? { nombre } : null
  }
}

/**
 * Lee los afiliados de [ObraSocial].[dbo].[Afiliados] (solo lectura).
 *
 * Semantica de las columnas, relevada sobre los datos reales:
 * - `Codigo`  es el documento de la propia persona (nchar(8), con relleno).
 * - `Doctit`  es el documento del TITULAR: lo comparte todo el grupo familiar,
 *             hasta 18 filas con el mismo valor. No identifica a la persona.
 * - `Nombre`  viene en un solo campo, formato "APELLIDO Nombres". Es la unica
 *             columna de nombre confiable: nombreAfiliado/apellidoAfiliado solo
 *             estan cargadas en el 20% de las filas.
 *
 * Por eso se busca por `Codigo` y solo se cae a `Doctit` si no hubo match: quien
 * tipea su DNI tiene que verse a si mismo, no al titular de su grupo.
 */
export class RepositorioSql implements RepositorioAfiliados {
  constructor(private base = process.env.AFILIADOS_BASE ?? "ObraSocial") {}

  async buscarPorDni(dni: string): Promise<Afiliado | null> {
    // El nombre de la base sale del entorno, no de entrada de usuario.
    // El DNI, que si viene del usuario, va como parametro.
    const sql = `
      SELECT TOP 1 LTRIM(RTRIM(Nombre)) AS nombre
      FROM [${this.base}].[dbo].[Afiliados]
      WHERE Codigo = @P1 OR Doctit = @P1
      ORDER BY
        CASE WHEN Codigo = @P1 THEN 0 ELSE 1 END,
        CASE WHEN anulado = 0 THEN 0 ELSE 1 END,
        CASE WHEN Parentesco = '000' THEN 0 ELSE 1 END,
        IdAfiliado
    `
    const filas = await prisma.$queryRawUnsafe<{ nombre: string }[]>(sql, dni)

    const nombre = filas[0]?.nombre?.trim()
    return nombre ? { nombre } : null
  }
}

export function crearRepositorioAfiliados(): RepositorioAfiliados {
  return process.env.AFILIADOS_BASE ? new RepositorioSql() : new RepositorioStub()
}

export const TIMEOUT_AFILIADO_MS = 1500
