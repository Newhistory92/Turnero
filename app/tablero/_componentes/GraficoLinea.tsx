"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export function GraficoLinea({
  datos,
}: {
  datos: { fecha: string; personas: number }[]
}) {
  if (datos.length === 0) {
    return <p className="rounded-xl bg-white p-4 text-sm text-gris-80">Sin datos en el rango.</p>
  }

  return (
    <div className="h-64 rounded-xl bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="fecha" fontSize={12} />
          <YAxis allowDecimals={false} fontSize={12} />
          <Tooltip />
          <Line type="monotone" dataKey="personas" stroke="#c8102e" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
