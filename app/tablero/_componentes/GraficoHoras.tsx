"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export function GraficoHoras({
  datos,
}: {
  datos: { hora: number; personas: number }[]
}) {
  // porHora siempre devuelve 24 buckets; se recortan los extremos vacios
  // para no dibujar la madrugada de una institucion que abre a las 8.
  const conDatos = datos.filter((d) => d.personas > 0)
  if (conDatos.length === 0) {
    return <p className="rounded-xl bg-white p-4 text-sm text-gris-80">Sin datos en el rango.</p>
  }

  const primera = Math.min(...conDatos.map((d) => d.hora))
  const ultima = Math.max(...conDatos.map((d) => d.hora))
  const visibles = datos
    .slice(primera, ultima + 1)
    .map((d) => ({ ...d, etiqueta: `${String(d.hora).padStart(2, "0")}:00` }))

  return (
    <div className="h-64 rounded-xl bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={visibles}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="etiqueta" fontSize={12} />
          <YAxis allowDecimals={false} fontSize={12} />
          <Tooltip />
          <Bar dataKey="personas" fill="#c8102e" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
