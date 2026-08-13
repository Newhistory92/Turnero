import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

export interface FilaUsuario {
  nombreUsuario: string
  claveUsuario: string
  anulado: boolean
  esAfiliado: boolean
  documento: string
  nombrePersona: string | null
  apellidoPersona: string | null
}

export interface UsuarioInstitucional {
  nombreUsuario: string
  documento: string
  nombreCompleto: string
}

export type ResultadoCredencial =
  | { ok: true; usuario: UsuarioInstitucional }
  | { ok: false; codigo: "CREDENCIAL_INVALIDA" | "ERROR_BASE"; mensaje: string; detalle?: string }

/**
 * [Usuario] mezcla empleados con afiliados, clinicas, prestadores, otras obras
 * sociales y organismos externos. Empleado es el que no tiene ninguna marca.
 * esAfiliado es bit NOT NULL: va con = 0, nunca con IS NULL.
 */
export const SQL_EMPLEADOS = `
  u.esAfiliado = 0
  AND u.idClinica IS NULL
  AND u.idPrestador IS NULL
  AND u.codObraSocial IS NULL
  AND u.codOrganismoExterno IS NULL
`

const MENSAJE_GENERICO = "Usuario o contraseña incorrectos"

type Consulta = (nombreUsuario: string) => Promise<FilaUsuario[]>

const consultaReal: Consulta = (nombreUsuario) =>
  prisma.$queryRaw<FilaUsuario[]>`
    SELECT TOP 1
      LTRIM(RTRIM(u.nombreUsuario)) AS nombreUsuario,
      u.claveUsuario,
      u.anulado,
      u.esAfiliado,
      LTRIM(RTRIM(p.numeroDocPersona)) AS documento,
      LTRIM(RTRIM(p.nombrePersona)) AS nombrePersona,
      LTRIM(RTRIM(p.apellidoPersona)) AS apellidoPersona
    FROM [ObraSocial].[dbo].[Usuario] u
    JOIN [ObraSocial].[dbo].[Persona] p ON p.idPersona = u.idPersona
    WHERE u.nombreUsuario = ${nombreUsuario}
  `

export async function verificarCredencial(
  nombreUsuario: string,
  clave: string,
  consulta: Consulta = consultaReal
): Promise<ResultadoCredencial> {
  const rechazo = {
    ok: false as const,
    codigo: "CREDENCIAL_INVALIDA" as const,
    mensaje: MENSAJE_GENERICO,
  }

  try {
    const filas = await consulta(nombreUsuario)
    const fila = filas[0]

    // Un solo mensaje para inexistente, anulado, afiliado y clave incorrecta:
    // distinguirlos le confirma a cualquiera que un usuario existe.
    if (!fila || fila.anulado || fila.esAfiliado) return rechazo
    if (!(await bcrypt.compare(clave, fila.claveUsuario))) return rechazo

    const apellido = fila.apellidoPersona?.trim() ?? ""
    const nombre = fila.nombrePersona?.trim() ?? ""
    return {
      ok: true,
      usuario: {
        nombreUsuario: fila.nombreUsuario.trim(),
        documento: fila.documento.trim(),
        nombreCompleto: apellido && nombre ? `${apellido}, ${nombre}` : apellido || nombre,
      },
    }
  } catch (e) {
    return {
      ok: false,
      codigo: "ERROR_BASE",
      mensaje: "No se pudo validar la credencial",
      detalle: e instanceof Error ? e.message : String(e),
    }
  }
}
