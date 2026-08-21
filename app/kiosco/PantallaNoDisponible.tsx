"use client"

import { AlertTriangle } from "lucide-react"

/**
 * Regla 2 del proyecto: cuando algo falla, se degrada a la vista. Si el turno
 * no se pudo guardar, el kiosco lo dice; nunca inventa un numero ni imprime
 * uno que no exista en la base.
 */
export function PantallaNoDisponible({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-10 px-16 text-center"
      data-testid="no-disponible"
      role="alert"
    >
      <AlertTriangle className="h-24 w-24 text-osp" aria-hidden />

      <h1 className="text-k-pregunta font-titulo">No pudimos emitir su turno</h1>

      <p className="max-w-[900px] text-k-sub">
        El sistema no está disponible en este momento. Por favor acérquese a la mesa
        de entrada para que lo atiendan.
      </p>

      <button
        type="button"
        onClick={onReintentar}
        className="rounded-2xl bg-gris-principal px-12 py-6 text-k-sub text-white shadow-lg shadow-black/25 active:scale-95 active:shadow-sm transition-transform duration-150"
      >
        Volver a intentar
      </button>
    </div>
  )
}
