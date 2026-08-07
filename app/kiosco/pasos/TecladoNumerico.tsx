"use client"

import { Delete, Check } from "lucide-react"
import { MAX_DIGITOS_DNI } from "@/lib/kiosco/dni"

interface Props {
  valor: string
  onCambio: (valor: string) => void
  onConfirmar: () => void
  puedeConfirmar: boolean
}

const DIGITOS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

export function TecladoNumerico({ valor, onCambio, onConfirmar, puedeConfirmar }: Props) {
  const agregar = (d: string) => {
    if (valor.length >= MAX_DIGITOS_DNI) return
    onCambio(valor + d)
  }

  const claseTecla =
    "flex h-[140px] w-[200px] items-center justify-center rounded-2xl bg-white " +
    "text-k-tecla text-gris-principal shadow-sm border-2 border-gris-70 " +
    "active:scale-95 active:bg-gris-20 transition-transform duration-150 " +
    "focus-visible:outline focus-visible:outline-4 focus-visible:outline-gris-principal"

  return (
    <div className="grid grid-cols-3 gap-k-gap" role="group" aria-label="Teclado numérico">
      {DIGITOS.map((d) => (
        <button key={d} type="button" className={claseTecla} onClick={() => agregar(d)} aria-label={d}>
          {d}
        </button>
      ))}

      <button
        type="button"
        className={claseTecla}
        onClick={() => onCambio(valor.slice(0, -1))}
        aria-label="Borrar último dígito"
      >
        <Delete className="h-14 w-14 text-gris-80" aria-hidden />
      </button>

      <button type="button" className={claseTecla} onClick={() => agregar("0")} aria-label="0">
        0
      </button>

      <button
        type="button"
        disabled={!puedeConfirmar}
        onClick={onConfirmar}
        aria-label="Confirmar DNI"
        className={
          "flex h-[140px] w-[200px] items-center justify-center rounded-2xl " +
          "bg-gris-principal text-white shadow-sm transition-transform duration-150 " +
          "active:scale-95 disabled:bg-gainsboro disabled:text-gris-80 " +
          "focus-visible:outline focus-visible:outline-4 focus-visible:outline-gris-principal"
        }
      >
        <Check className="h-16 w-16" aria-hidden />
      </button>
    </div>
  )
}
