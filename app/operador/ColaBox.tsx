"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { SnapshotOperador } from "@/server/snapshot"

function haceCuanto(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return "recién"
  if (minutos < 60) return `${minutos} min`
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`
}

export function ColaBox({ snapshot }: { snapshot: SnapshotOperador }) {
  const [abierta, setAbierta] = useState(false)
  const { resumen, cola } = snapshot

  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg shadow-black/10">
      <h2 className="font-titulo text-2xl font-semibold" data-testid="total-cola">
        {resumen.total === 0
          ? "Nadie esperando"
          : `${resumen.total} esperando`}
      </h2>

      {resumen.esperaMasVieja !== null && (
        <p className="mt-1 text-sm">
          El más antiguo espera hace {resumen.esperaMasVieja} min
        </p>
      )}

      {/* Desglose por tramite, no por categoria: el operador de Afiliaciones
          necesita saber cuantos son para carnet y cuantos para expedientes. */}
      {resumen.lineas.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2" data-testid="desglose">
          {resumen.lineas.map((l) => (
            <li key={l.tramiteId} className="text-lg">
              <strong>{l.cuantos}</strong> {l.tramiteNombre}
            </li>
          ))}
        </ul>
      )}

      {cola.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAbierta((v) => !v)}
            aria-expanded={abierta}
            className="mt-4 flex items-center gap-2 text-sm font-semibold"
          >
            {abierta ? (
              <ChevronDown className="h-5 w-5 text-gris-80" aria-hidden />
            ) : (
              <ChevronRight className="h-5 w-5 text-gris-80" aria-hidden />
            )}
            {abierta ? "Ocultar la lista" : "Ver la lista"}
          </button>

          {abierta && (
            <ol className="mt-3 flex flex-col gap-2" data-testid="lista-cola">
              {cola.map((t) => (
                <li
                  key={t.id}
                  className="flex items-baseline justify-between border-b border-gris-70 pb-2"
                >
                  <span className="font-mono text-lg font-semibold">{t.numero}</span>
                  <span className="flex-1 px-4 text-sm">{t.tramiteNombre}</span>
                  <span className="text-sm">{haceCuanto(t.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  )
}
