"use client"

import type { TurnoPanel } from "@/server/snapshot"

export function ListaAusentes({
  ausentes,
  onLlamar,
  deshabilitado,
}: {
  ausentes: TurnoPanel[]
  onLlamar: (turnoId: string) => void
  deshabilitado: boolean
}) {
  if (ausentes.length === 0) return null

  return (
    <section className="rounded-2xl bg-white p-6">
      <h2 className="font-titulo text-xl font-semibold">
        Ausentes ({ausentes.length})
      </h2>
      {/* Es la unica via que saltea la FIFO, y esta permitida porque estado.ts
          modela ausente -> llamado: es gente que ya espero su turno. */}
      <ul className="mt-3 flex flex-col gap-2">
        {ausentes.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-4">
            <span className="font-mono text-lg font-semibold">{t.numero}</span>
            <span className="flex-1 text-sm">{t.tramiteNombre}</span>
            <button
              type="button"
              onClick={() => onLlamar(t.id)}
              disabled={deshabilitado}
              className="rounded-xl border-2 border-gris-70 px-4 py-2 text-sm font-semibold disabled:text-gris-80"
            >
              Llamar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
