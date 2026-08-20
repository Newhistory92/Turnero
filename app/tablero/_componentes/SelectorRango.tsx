import { aClaveFecha, presetA, type Preset } from "@/lib/estadisticas/rango"

const NOMBRES: Record<Preset, string> = {
  hoy: "Hoy",
  semana: "Semana",
  mes: "Mes",
}

export function SelectorRango({
  desde,
  hasta,
  corregido,
}: {
  desde: Date
  hasta: Date
  corregido: boolean
}) {
  const ahora = new Date()

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-white p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-2">
          {(Object.keys(NOMBRES) as Preset[]).map((p) => {
            const r = presetA(p, ahora)
            return (
              <a
                key={p}
                href={`?desde=${aClaveFecha(r.desde)}&hasta=${aClaveFecha(r.hasta)}`}
                className="rounded-lg border-2 border-gris-70 px-3 py-2 text-sm hover:bg-gris-20"
              >
                {NOMBRES[p]}
              </a>
            )
          })}
        </div>

        {/* GET, no Server Action: el rango tiene que quedar en la URL para
            que la vista sea compartible y el boton de exportar lo herede. */}
        <form method="get" className="flex items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Desde</span>
            <input
              type="date"
              name="desde"
              defaultValue={aClaveFecha(desde)}
              className="rounded-lg border-2 border-gris-70 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Hasta</span>
            <input
              type="date"
              name="hasta"
              defaultValue={aClaveFecha(hasta)}
              className="rounded-lg border-2 border-gris-70 px-3 py-2"
            />
          </label>
          <button className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white">
            Ver
          </button>
        </form>

        <a
          href={`/tablero/exportar?desde=${aClaveFecha(desde)}&hasta=${aClaveFecha(hasta)}`}
          className="rounded-lg border-2 border-gris-70 px-4 py-2 text-sm hover:bg-gris-20"
        >
          Exportar CSV
        </a>
      </div>

      {corregido && (
        <p role="alert" className="text-sm text-osp">
          El rango que pediste no era válido. Te muestro el último mes.
        </p>
      )}
    </div>
  )
}
