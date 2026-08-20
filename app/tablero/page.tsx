import { actorActual } from "@/lib/admin/acceso"
import { alcanceDe, sinAlcance } from "@/lib/estadisticas/alcance"
import { colaActual, estadoBoxes, turnosDelRango } from "@/lib/estadisticas/consultas"
import { calcularDuraciones } from "@/lib/estadisticas/duraciones"
import { presetA } from "@/lib/estadisticas/rango"
import { esPersona, promedio } from "@/lib/estadisticas/volumen"
import { AutoRefresco } from "./AutoRefresco"
import { Tarjeta } from "./_componentes/Tarjeta"
import { TablaDatos } from "./_componentes/TablaDatos"
import { SinAlcance } from "./_componentes/SinAlcance"

function minutos(segundos: number | null): string {
  if (segundos === null) return "—"
  return `${Math.floor(segundos / 60)} min`
}

const ETIQUETA_BOX = {
  atendiendo: "Atendiendo",
  ocioso: "Ocioso",
  cerrado: "Cerrado",
} as const

export default async function PaginaHoy() {
  // El layout ya garantizo que hay actor con permiso; aca solo hace falta
  // para resolver su alcance.
  const actor = await actorActual()
  if (!actor) return null

  const alcance = await alcanceDe(actor)
  if (sinAlcance(alcance)) return <SinAlcance />

  const ahora = new Date()
  const [cola, boxes, turnos] = await Promise.all([
    colaActual(alcance, ahora),
    estadoBoxes(alcance),
    turnosDelRango(alcance, presetA("hoy", ahora)),
  ])

  const conDuraciones = turnos.map((t) => ({
    turno: t,
    d: calcularDuraciones(t.eventos, t.umbralMinutos, ahora),
  }))

  const personas = turnos.filter(esPersona).length
  // §6.5: se cuentan eventos de tipo "ausente", no el estado final del turno.
  // Un turno puede tener múltiples eventos ausente y seguir siendo llamado.
  const ausentes = turnos.reduce(
    (acc, t) => acc + t.eventos.filter((e) => e.tipo === "ausente").length,
    0
  )
  const abandonados = turnos.filter((t) => t.estado === "abandonado").length

  // El promedio va sobre los ya llamados: incluir las esperas abiertas
  // mezclaria un tiempo final con uno que todavia esta corriendo.
  const esperaPromedio = promedio(
    conDuraciones.filter((c) => !c.d.esperaEnCurso).map((c) => c.d.esperaSegundos)
  )

  return (
    <div className="flex flex-col gap-8">
      <AutoRefresco />

      <section className="flex flex-col gap-3">
        <h1 className="font-titulo text-2xl font-semibold">Hoy</h1>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Tarjeta etiqueta="Personas" valor={String(personas)} />
          <Tarjeta etiqueta="Atenciones" valor={String(turnos.length)} />
          <Tarjeta etiqueta="Ausentes" valor={String(ausentes)} />
          <Tarjeta etiqueta="Abandonados" valor={String(abandonados)} />
          <Tarjeta etiqueta="Espera promedio" valor={minutos(esperaPromedio)} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Cola</h2>
        <TablaDatos
          columnas={["Trámite", "Esperando", "Espera más larga"]}
          vacio="No hay nadie esperando en este momento."
          filas={cola.map((l) => [
            l.tramiteNombre,
            String(l.esperando),
            minutos(l.esperaMasViejaSegundos),
          ])}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Boxes</h2>
        <TablaDatos
          columnas={["Box", "Ala", "Operador", "Estado", "Turno"]}
          vacio="No hay boxes que atiendan tus trámites."
          filas={boxes.map((b) => [
            b.boxNombre,
            b.alaNombre,
            b.empleadoNombre ?? "—",
            ETIQUETA_BOX[b.estado],
            b.turnoNumero ?? "—",
          ])}
        />
      </section>
    </div>
  )
}
