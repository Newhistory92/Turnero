import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROBE_URL! } } })
const q = (sql: string) => prisma.$queryRawUnsafe<any[]>(sql)

async function main() {
  console.log("### ¿nombreUsuario coincide con el documento de la persona?")
  console.log(await q(`
    SELECT CASE WHEN LTRIM(RTRIM(u.nombreUsuario)) = LTRIM(RTRIM(p.numeroDocPersona))
                THEN 'coincide con numeroDocPersona' ELSE 'no coincide' END AS relacion,
           COUNT(*) AS cuantos
    FROM [ObraSocial].[dbo].[Usuario] u
    JOIN [ObraSocial].[dbo].[Persona] p ON p.idPersona = u.idPersona
    GROUP BY CASE WHEN LTRIM(RTRIM(u.nombreUsuario)) = LTRIM(RTRIM(p.numeroDocPersona))
                  THEN 'coincide con numeroDocPersona' ELSE 'no coincide' END`))

  console.log("### Reparto por tipo de usuario (quién es empleado y quién no)")
  console.log(await q(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN esAfiliado = 1 THEN 1 ELSE 0 END) AS afiliados,
      SUM(CASE WHEN idPrestador IS NOT NULL THEN 1 ELSE 0 END) AS prestadores,
      SUM(CASE WHEN idClinica IS NOT NULL THEN 1 ELSE 0 END) AS clinicas,
      SUM(CASE WHEN COALESCE(codOrganismoExterno,'') <> '' THEN 1 ELSE 0 END) AS organismos_externos,
      SUM(CASE WHEN esAfiliado = 0 AND idPrestador IS NULL AND idClinica IS NULL
                AND COALESCE(codOrganismoExterno,'') = '' AND COALESCE(codObraSocial,'') = ''
               THEN 1 ELSE 0 END) AS quedan_como_internos
    FROM [ObraSocial].[dbo].[Usuario]`))

  console.log("### Columnas de Emp_DatosPersonales (¿es el legajo de RRHH?)")
  console.log(await q(`
    SELECT COLUMN_NAME AS columna, DATA_TYPE AS tipo, CHARACTER_MAXIMUM_LENGTH AS largo
    FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Emp_DatosPersonales'
    ORDER BY ORDINAL_POSITION`))

  console.log("### ¿Hay tabla de roles por usuario? (UsuarioRol, 269 filas)")
  console.log(await q(`
    SELECT COLUMN_NAME AS columna, DATA_TYPE AS tipo
    FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'UsuarioRol'
    ORDER BY ORDINAL_POSITION`))
}

main().catch((e) => console.error("FALLO:", e.message)).finally(() => prisma.$disconnect())
