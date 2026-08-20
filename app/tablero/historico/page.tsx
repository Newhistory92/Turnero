import { actorActual, puedeVerProductividad } from "@/lib/admin/acceso"
import { alcanceDe, sinAlcance } from "@/lib/estadisticas/alcance"
import { turnosDelRango } from "@/lib/estadisticas/consultas"
import { calcularDuraciones } from "@/lib/estadisticas/duraciones"
import { parsearRango } from "@/lib/estadisticas/rango"
import {
  porDia,
  porHora,
  porTramite,
  porTramiteYEstado,
  promedio,
  mediana,
} from "@/lib/estadisticas/volumen"
import { pares, cadenas } from "@/lib/estadisticas/derivaciones"
import { porEmpleado, type AtencionEmpleado } from "@/lib/estadisticas/productividad"
import { Tarjeta } from "../_componentes/Tarjeta"
import { TablaDatos } from "../_componentes/TablaDatos"
import { BarraRanking } from "../_componentes/BarraRanking"
import { GraficoLinea } from "../_componentes/GraficoLinea"
import { GraficoHoras } from "../_componentes/GraficoHoras"
import { SelectorRango } from "../_componentes/SelectorRango"
import { SinAlcance } from "../_componentes/SinAlcance"

function minutos(segundos: number | null): string {
  if (segundos === null) return "—"
  return `${Math.floor(segundos / 60)} min`
}

function desvio(segundos: number | null): string {
  if (segundos === null) return "—"
  const signo = segundos >= 0 ? "+" : "−"
  return `${signo}${Math.abs(Math.round(segundos / 60))} min`
}

export default async function PaginaHistorico({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const actor = await actorActual()
  if (!actor) return null

  const alcance = await alcanceDe(actor)
  if (sinAlcance(alcance)) return <SinAlcance />

  const { desde, hasta } = await searchParams
  const { rango, corregido } = parsearRango(desde, hasta)

  const turnos = await turnosDelRango(alcance, rango)

  const conDuraciones = turnos.map((t) => ({
    t,
    d: calcularDuraciones(t.eventos, t.umbralMinutos),
  }))

  const paraVolumen = conDuraciones.map(({ t, d }) => ({
    id: t.id,
    tramiteId: t.tramiteId,
    tramiteNombre: t.tramiteNombre,
    derivadoDeId: t.derivadoDeId,
    estado: t.estado,
    generadoEn: t.eventos.find((e) => e.tipo === "generado")?.timestamp ?? null,
    esperaSegundos: d.esperaSegundos,
  }))

  const lineas = porTramite(paraVolumen)
  const esperas = conDuraciones.filter((c) => !c.d.esperaEnCurso).map((c) => c.d.esperaSegundos)

  const paraDerivaciones = turnos.map((t) => ({
    id: t.id,
    numero: t.numero,
    tramiteId: t.tramiteId,
    tramiteNombre: t.tramiteNombre,
    derivadoDeId: t.derivadoDeId,
  }))

  const verProductividad = puedeVerProductividad(actor.rol)

  // La productividad no se consulta ni se calcula para quien no puede
  // verla: no alcanza con no renderizarla.
  const productividad = verProductividad
    ? porEmpleado(
        conDuraciones
          .filter((c): c is typeof c & { t: { empleadoId: string } } => c.t.empleadoId !== null)
          .map(
            ({ t, d }): AtencionEmpleado => ({
              empleadoId: t.empleadoId,
              empleadoNombre: t.empleadoNombre ?? "(empleado dado de baja)",
              tramiteId: t.tramiteId,
              atencionSegundos: d.atencionSegundos,
              clasificacion: d.clasificacion,
            })
          )
      )
    : []

  const personas = paraVolumen.filter((t) => t.derivadoDeId === null).length
  // §6.5: se cuentan eventos de tipo "ausente", no el estado final del turno.
  const ausentes = turnos.reduce(
    (acc, t) => acc + t.eventos.filter((e) => e.tipo === "ausente").length,
    0
  )
  const abandonados = turnos.filter((t) => t.estado === "abandonado").length

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-titulo text-2xl font-semibold">Histórico</h1>

      <SelectorRango desde={rango.desde} hasta={rango.hasta} corregido={corregido} />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Tarjeta etiqueta="Personas" valor={String(personas)} />
        <Tarjeta etiqueta="Atenciones" valor={String(turnos.length)} />
        <Tarjeta etiqueta="Ausentes" valor={String(ausentes)} />
        <Tarjeta etiqueta="Abandonados" valor={String(abandonados)} />
        <Tarjeta
          etiqueta="Espera"
          valor={minutos(promedio(esperas))}
          detalle={`Mediana ${minutos(mediana(esperas))}`}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Personas por día</h2>
        <GraficoLinea datos={porDia(paraVolumen)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Hora pico</h2>
        <GraficoHoras datos={porHora(paraVolumen)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Volumen por trámite</h2>
        <BarraRanking
          filas={lineas.map((l) => ({ etiqueta: l.tramiteNombre, valor: l.personas }))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Derivaciones</h2>
        <TablaDatos
          columnas={["Origen", "Destino", "Cuántas"]}
          vacio="No hubo derivaciones en el rango."
          filas={pares(paraDerivaciones).map((p) => [
            p.origenNombre,
            p.destinoNombre,
            String(p.cuantas),
          ])}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Cadenas de tres o más</h2>
        <TablaDatos
          columnas={["Turno", "Recorrido"]}
          vacio="No hubo cadenas largas en el rango."
          filas={cadenas(paraDerivaciones).map((c) => [
            c.numero,
            c.tramiteNombres.join(" → "),
          ])}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Ausentes y abandonos</h2>
        <TablaDatos
          columnas={["Trámite", "Ausentes", "Abandonados"]}
          vacio="No hubo ausentes ni abandonos en el rango."
          filas={(() => {
            const a = porTramiteYEstado(paraVolumen, ["ausente"])
            const b = porTramiteYEstado(paraVolumen, ["abandonado"])
            const nombres = new Map(
              [...a, ...b].map((l) => [l.tramiteId, l.tramiteNombre])
            )
            return [...nombres.entries()].map(([id, nombre]) => [
              nombre,
              String(a.find((l) => l.tramiteId === id)?.cuantos ?? 0),
              String(b.find((l) => l.tramiteId === id)?.cuantos ?? 0),
            ])
          })()}
        />
      </section>

      {verProductividad && (
        <section className="flex flex-col gap-3">
          <h2 className="font-titulo text-xl font-semibold">Productividad</h2>
          <TablaDatos
            columnas={[
              "Operador",
              "Atendidos",
              "Válidas",
              "Breves",
              "Anomalías",
              "Promedio",
              "Contra la mediana",
            ]}
            vacio="No hubo atenciones con operador registrado en el rango."
            filas={productividad.map((l) => [
              l.empleadoNombre,
              String(l.atendidos),
              String(l.validas),
              String(l.breves),
              String(l.anomalias),
              minutos(l.promedioSegundos),
              desvio(l.desvioContraMedianaSegundos),
            ])}
          />
        </section>
      )}
    </div>
  )
}
