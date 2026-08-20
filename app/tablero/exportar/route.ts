import { actorActual, puedeVerTablero, puedeVerProductividad } from "@/lib/admin/acceso"
import { alcanceDe, sinAlcance } from "@/lib/estadisticas/alcance"
import { turnosDelRango } from "@/lib/estadisticas/consultas"
import { calcularDuraciones } from "@/lib/estadisticas/duraciones"
import { parsearRango, aClaveFecha } from "@/lib/estadisticas/rango"
import { aCsv, type FilaExportable } from "@/lib/estadisticas/csv"

export async function GET(pedido: Request): Promise<Response> {
  const actor = await actorActual()
  // 401 y no redirect: esto lo pide un enlace de descarga, no un navegante.
  if (!actor || !puedeVerTablero(actor.rol)) {
    return new Response("No autorizado", { status: 401 })
  }

  const alcance = await alcanceDe(actor)
  const verProductividad = puedeVerProductividad(actor.rol)

  const url = new URL(pedido.url)
  const { rango } = parsearRango(
    url.searchParams.get("desde") ?? undefined,
    url.searchParams.get("hasta") ?? undefined
  )

  // El alcance vacio devuelve un CSV con solo el encabezado, no un error:
  // el archivo pedido existe, lo que no hay son filas que mostrarle.
  const turnos = sinAlcance(alcance) ? [] : await turnosDelRango(alcance, rango)

  const filas: FilaExportable[] = turnos.map((t) => {
    const d = calcularDuraciones(t.eventos, t.umbralMinutos)
    return {
      numero: t.numero,
      fecha: aClaveFecha(t.fecha),
      tramiteNombre: t.tramiteNombre,
      estado: t.estado,
      derivado: t.derivadoDeId !== null,
      esperaSegundos: d.esperaSegundos,
      boxNombre: t.boxNombre,
      empleadoNombre: t.empleadoNombre,
      atencionSegundos: d.atencionSegundos,
      clasificacion: d.clasificacion,
    }
  })

  const nombre = `turnero-${aClaveFecha(rango.desde)}-a-${aClaveFecha(rango.hasta)}.csv`

  return new Response(aCsv(filas, verProductividad), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  })
}
