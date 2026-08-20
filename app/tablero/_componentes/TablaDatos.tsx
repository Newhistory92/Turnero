import React from "react"

export function TablaDatos({
  columnas,
  filas,
  vacio,
}: {
  columnas: string[]
  filas: React.ReactNode[][]
  vacio: string
}) {
  // El estado vacio dice que no hubo datos, no "cero": un cero en la celda
  // se leeria como una medicion que dio cero.
  if (filas.length === 0) {
    return <p className="rounded-xl bg-white p-4 text-sm text-gris-80">{vacio}</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gainsboro text-left">
            {columnas.map((c) => (
              <th key={c} className="px-4 py-3 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-b border-gris-20 last:border-0">
              {fila.map((celda, j) => (
                <td key={j} className="px-4 py-3">
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
