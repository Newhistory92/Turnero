export function BarraRanking({
  filas,
}: {
  filas: { etiqueta: string; valor: number }[]
}) {
  if (filas.length === 0) {
    return <p className="rounded-xl bg-white p-4 text-sm text-gris-80">Sin datos en el rango.</p>
  }

  const maximo = Math.max(...filas.map((f) => f.valor), 1)

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-4">
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex items-center gap-3">
          <span className="w-48 shrink-0 truncate text-sm">{f.etiqueta}</span>
          <div className="h-6 flex-1 rounded bg-gris-20">
            <div
              className="h-6 rounded bg-osp"
              style={{ width: `${(f.valor / maximo) * 100}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-semibold">{f.valor}</span>
        </div>
      ))}
    </div>
  )
}
