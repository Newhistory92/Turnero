"use client"

import { iconoPorNombre } from "@/lib/kiosco/iconos"

interface Props {
  icono: string
  titulo: string
  subtitulo?: string
  cerrado?: { desde: string; hasta: string } | null
  onClick: () => void
}

export function TarjetaOpcion({ icono, titulo, subtitulo, cerrado, onClick }: Props) {
  const Icono = iconoPorNombre(icono)
  const deshabilitada = Boolean(cerrado)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitada}
      data-testid="tarjeta-opcion"
      data-cerrado={deshabilitada ? "si" : "no"}
      className={
        "flex h-k-tarjeta-alto w-k-tarjeta flex-col items-center justify-center gap-6 " +
        "rounded-3xl border-2 p-8 text-center transition-transform duration-150 " +
        (deshabilitada
          ? "border-gainsboro bg-gris-20 cursor-not-allowed"
          : "border-gris-70 bg-white shadow-sm active:scale-95 " +
            "focus-visible:outline focus-visible:outline-4 focus-visible:outline-gris-principal")
      }
    >
      <Icono
        className={"h-24 w-24 " + (deshabilitada ? "text-gainsboro" : "text-gris-80")}
        strokeWidth={1.5}
        aria-hidden
      />

      <span className={"text-k-titulo font-titulo " + (deshabilitada ? "text-gris-80" : "")}>
        {titulo}
      </span>

      {subtitulo && !deshabilitada && (
        <span className="text-k-sub text-gris-principal">{subtitulo}</span>
      )}

      {cerrado && (
        <span className="text-k-sub text-gris-80" data-testid="leyenda-cerrado">
          Cerrado · Atiende {cerrado.desde} a {cerrado.hasta}
        </span>
      )}
    </button>
  )
}
