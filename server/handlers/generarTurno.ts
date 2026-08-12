import { prisma } from "@/lib/db"
import type { Turno } from "@prisma/client"

export interface ComandoGenerarTurno {
  tramiteId: string
  dni: string | null
  nombreAfiliado?: string | null
  requestId: string
}

export type CodigoErrorGeneracion = "TRAMITE_INEXISTENTE" | "ERROR_BASE"

export type ResultadoGeneracion =
  | { ok: true; turno: Turno }
  | { ok: false; codigo: CodigoErrorGeneracion; mensaje: string; detalle?: string }

/** Dia habil: la fecha local a medianoche, sin hora. */
export function diaHabil(ahora = new Date()): Date {
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
}

export async function generarTurno(
  cmd: ComandoGenerarTurno
): Promise<ResultadoGeneracion> {
  // Idempotencia: si ya existe un turno con este requestId, se devuelve ese.
  const previo = await prisma.turno.findUnique({ where: { requestId: cmd.requestId } })
  if (previo) return { ok: true, turno: previo }

  const tramite = await prisma.tramite.findUnique({ where: { id: cmd.tramiteId } })
  if (!tramite) {
    return {
      ok: false,
      codigo: "TRAMITE_INEXISTENTE",
      mensaje: "El trámite solicitado no existe",
    }
  }

  const fecha = diaHabil()

  try {
    const turno = await prisma.$transaction(async (tx) => {
      // MERGE con HOLDLOCK es el upsert atomico de SQL Server: incrementa si la
      // fila del dia existe, la crea en 1 si no, y devuelve el valor resultante.
      // Sin HOLDLOCK, dos MERGE simultaneos pueden insertar la misma clave.
      //
      // Los CAST no son decorativos: Prisma bindea un Date de JS como datetime2
      // y el tramiteId como nvarchar(4000). Contra las columnas DATE y
      // NVARCHAR(1000) eso obliga a una conversion implicita del lado de la
      // tabla, el predicado deja de ser sargable contra el indice unico
      // (tramiteId, fecha) y HOLDLOCK se queda sin key-range lock que tomar:
      // 50 generaciones simultaneas entran todas por WHEN NOT MATCHED y 49
      // mueren con violacion de UNIQUE KEY. Con los tipos alineados, el MERGE
      // sequea el indice, toma el rango y serializa.
      const filas = await tx.$queryRaw<{ valor: number }[]>`
        MERGE [Contador] WITH (HOLDLOCK) AS destino
        USING (SELECT CAST(${cmd.tramiteId} AS NVARCHAR(1000)) AS tramiteId,
                      CAST(${fecha} AS DATE) AS fecha) AS origen
          ON destino.tramiteId = origen.tramiteId AND destino.fecha = origen.fecha
        WHEN MATCHED THEN
          UPDATE SET valor = destino.valor + 1
        WHEN NOT MATCHED THEN
          INSERT (id, tramiteId, fecha, valor)
          VALUES (NEWID(), origen.tramiteId, origen.fecha, 1)
        OUTPUT INSERTED.valor AS valor;
      `

      const valor = filas[0].valor
      const numero = `${tramite.prefijo}${String(valor).padStart(2, "0")}`

      const creado = await tx.turno.create({
        data: {
          numero,
          fecha,
          tramiteId: cmd.tramiteId,
          dni: cmd.dni,
          nombreAfiliado: cmd.nombreAfiliado ?? null,
          estado: "esperando",
          requestId: cmd.requestId,
        },
      })

      await tx.turnoEvento.create({
        data: { turnoId: creado.id, tipo: "generado" },
      })

      return creado
    })

    return { ok: true, turno }
  } catch (e) {
    // Carrera con el mismo requestId: gano la otra transaccion, devolvemos la suya.
    const existente = await prisma.turno.findUnique({
      where: { requestId: cmd.requestId },
    })
    if (existente) return { ok: true, turno: existente }

    return {
      ok: false,
      codigo: "ERROR_BASE",
      mensaje: "No se pudo generar el turno",
      detalle: e instanceof Error ? e.message : String(e),
    }
  }
}
