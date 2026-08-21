"use client"

import { ArrowLeft, Home } from "lucide-react"

interface Props {
  paso: string
  puedeVolver: boolean
  onVolver: () => void
  onReiniciar: () => void
}

/**
 * Barra inferior con las dos unicas acciones de navegacion del kiosco.
 * En el paso de resultado no se muestra ninguna: esa pantalla se cierra sola.
 */
export function PieKiosco({ paso, puedeVolver, onVolver, onReiniciar }: Props) {
  if (paso === "resultado") return <footer className="h-24 shrink-0" />

  return (
    <footer className="flex h-24 shrink-0 items-center justify-between px-12">
      {puedeVolver ? (
        <button
          type="button"
          onClick={onVolver}
          data-testid="volver"
          className="flex items-center gap-4 rounded-2xl border-2 border-gris-70 bg-white px-10 py-5 text-k-sub shadow-lg shadow-black/15 active:scale-95 active:shadow-sm transition-transform duration-150 focus-visible:outline focus-visible:outline-4 focus-visible:outline-gris-principal"
        >
          <ArrowLeft className="h-10 w-10 text-osp" aria-hidden />
          Volver
        </button>
      ) : (
        <span />
      )}

      <button
        type="button"
        onClick={onReiniciar}
        data-testid="reiniciar"
        className="flex items-center gap-4 rounded-2xl border-2 border-gris-70 bg-white px-10 py-5 text-k-sub shadow-lg shadow-black/15 active:scale-95 active:shadow-sm transition-transform duration-150 focus-visible:outline focus-visible:outline-4 focus-visible:outline-gris-principal"
      >
        <Home className="h-10 w-10 text-osp" aria-hidden />
        Empezar de nuevo
      </button>
    </footer>
  )
}
