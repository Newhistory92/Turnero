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

export class RepositorioSql implements RepositorioAfiliados {
  constructor(
    private base = process.env.AFILIADOS_BASE!,
    private esquema = process.env.AFILIADOS_ESQUEMA ?? "dbo",
    private tabla = process.env.AFILIADOS_TABLA!,
    private colDni = process.env.AFILIADOS_COL_DNI ?? "dni",
    private colApellido = process.env.AFILIADOS_COL_APELLIDO ?? "apellido",
    private colNombre = process.env.AFILIADOS_COL_NOMBRE ?? "nombre"
  ) {}

  async buscarPorDni(dni: string): Promise<Afiliado | null> {
    // Los identificadores vienen de variables de entorno, no de entrada de usuario.
    // El DNI, que si viene del usuario, va como parametro.
    const sql = `
      SELECT TOP 1
        LTRIM(RTRIM([${this.colNombre}])) AS nombre,
        LTRIM(RTRIM([${this.colApellido}])) AS apellido
      FROM [${this.base}].[${this.esquema}].[${this.tabla}]
      WHERE [${this.colDni}] = @P1
    `
    const filas = await prisma.$queryRawUnsafe<
      { nombre: string; apellido: string }[]
    >(sql, dni)

    if (filas.length === 0) return null
    return { nombre: `${filas[0].nombre} ${filas[0].apellido}`.trim() }
  }
}

export function crearRepositorioAfiliados(): RepositorioAfiliados {
  return process.env.AFILIADOS_TABLA ? new RepositorioSql() : new RepositorioStub()
}

export const TIMEOUT_AFILIADO_MS = 1500
