import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { tokenDeServicioValido } from "@/lib/auth/servicio"
import { atencionesDelRango, horasDeBoxPorEmpleado } from "@/lib/estadisticas/rango-empleados"
import { porEmpleado } from "@/lib/estadisticas/productividad"

/**
 * Productividad por empleado para Backend_RRHH.
 *
 * Turnero es dueno de sus metricas: RRHH consume lo que se calcula aca en vez
 * de rehacer el calculo del otro lado, para que las dos versiones no se
 * separen con el tiempo.
 *
 * Se devuelve dniInstitucional y no el id interno porque es la clave con la
 * que RRHH vincula: es un identificador del mundo real y en Empleado es unico
 * y obligatorio.
 */
export async function GET(request: Request) {
  if (!tokenDeServicioValido(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const url = new URL(request.url)
  const desdeRaw = url.searchParams.get("desde")
  const hastaRaw = url.searchParams.get("hasta")
  if (!desdeRaw || !hastaRaw) {
    return NextResponse.json({ error: "Faltan desde y hasta" }, { status: 400 })
  }

  const desde = new Date(`${desdeRaw}T00:00:00.000Z`)
  const hasta = new Date(`${hastaRaw}T00:00:00.000Z`)
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
    return NextResponse.json({ error: "Fechas invalidas" }, { status: 400 })
  }

  const atenciones = await atencionesDelRango(desde, hasta)
  const lineas = porEmpleado(atenciones)
  const horas = await horasDeBoxPorEmpleado(desde, hasta)

  const dnis = new Map(
    (await prisma.empleado.findMany({ select: { id: true, dniInstitucional: true } })).map(
      (e) => [e.id, e.dniInstitucional]
    )
  )

  return NextResponse.json({
    empleados: lineas
      .filter((l) => dnis.has(l.empleadoId))
      .map((l) => ({
        dniInstitucional: dnis.get(l.empleadoId),
        empleadoNombre: l.empleadoNombre,
        atendidos: l.atendidos,
        validas: l.validas,
        breves: l.breves,
        anomalias: l.anomalias,
        promedioSegundos: l.promedioSegundos,
        desvioContraMedianaSegundos: l.desvioContraMedianaSegundos,
        horasBox: Math.round((horas.get(l.empleadoId) ?? 0) * 100) / 100,
      })),
  })
}
