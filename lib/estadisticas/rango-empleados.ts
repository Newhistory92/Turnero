import { prisma } from "@/lib/db"
import { calcularDuraciones } from "./duraciones"
import type { AtencionEmpleado } from "./productividad"

/**
 * Atenciones de todos los empleados en un rango, para el consumo de RRHH.
 *
 * A diferencia de las consultas del tablero no aplica alcance por tramite: el
 * consumidor es un sistema, no un supervisor, y del otro lado se decide quien
 * puede ver que.
 *
 * El empleado sale del evento `iniciado` y, si no lo hay, del el `finalizado`:
 * son los dos que lleva un operador. El `generado` lo emite el kiosco y no
 * trae empleadoId.
 */
export async function atencionesDelRango(
  desde: Date,
  hasta: Date
): Promise<AtencionEmpleado[]> {
  const turnos = await prisma.turno.findMany({
    where: { fecha: { gte: desde, lte: hasta } },
    include: {
      tramite: { select: { duracionMinimaEsperada: true } },
      eventos: {
        select: { tipo: true, timestamp: true, empleadoId: true },
        orderBy: { timestamp: "asc" },
      },
    },
  })

  const nombres = new Map(
    (await prisma.empleado.findMany({ select: { id: true, nombre: true } })).map(
      (e) => [e.id, e.nombre]
    )
  )

  const atenciones: AtencionEmpleado[] = []

  for (const t of turnos) {
    const conEmpleado =
      t.eventos.find((e) => e.tipo === "iniciado" && e.empleadoId) ??
      t.eventos.find((e) => e.tipo === "finalizado" && e.empleadoId) ??
      null
    if (!conEmpleado?.empleadoId) continue

    const { atencionSegundos, clasificacion } = calcularDuraciones(
      t.eventos.map((e) => ({ tipo: e.tipo as never, timestamp: e.timestamp })),
      t.tramite.duracionMinimaEsperada
    )

    atenciones.push({
      empleadoId: conEmpleado.empleadoId,
      empleadoNombre: nombres.get(conEmpleado.empleadoId) ?? "",
      tramiteId: t.tramiteId,
      atencionSegundos,
      clasificacion,
    })
  }

  return atenciones
}

/**
 * Horas de box por empleado en el rango, como denominador de volumen.
 *
 * Una sesion sin `fin` es una que quedo abierta -el operador se fue sin
 * desloguear-. Se usa `ultimoLatido` en su lugar: contar hasta ahora le
 * regalaria horas que no estuvo.
 */
export async function horasDeBoxPorEmpleado(
  desde: Date,
  hasta: Date
): Promise<Map<string, number>> {
  const sesiones = await prisma.sesionOperador.findMany({
    where: { inicio: { gte: desde, lte: hasta } },
    select: { empleadoId: true, inicio: true, fin: true, ultimoLatido: true },
  })

  const horas = new Map<string, number>()
  for (const s of sesiones) {
    const cierre = s.fin ?? s.ultimoLatido
    const ms = cierre.getTime() - s.inicio.getTime()
    if (ms <= 0) continue
    horas.set(s.empleadoId, (horas.get(s.empleadoId) ?? 0) + ms / 3_600_000)
  }
  return horas
}
