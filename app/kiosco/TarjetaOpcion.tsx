"use client"

import { iconoPorNombre } from "@/lib/kiosco/iconos"

interface Props {
  icono: string
  titulo: string
  subtitulo?: string
  cerrado?: { desde: string; hasta: string } | null
  /** Ya cerro por hoy: el aviso va en grande, no como una linea mas. */
  finDeJornada?: boolean
  onClick: () => void
}

export function TarjetaOpcion({
  icono,
  titulo,
  subtitulo,
  cerrado,
  finDeJornada = false,
  onClick,
}: Props) {
  const Icono = iconoPorNombre(icono)
  const deshabilitada = Boolean(cerrado) || finDeJornada

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitada}
      data-testid="tarjeta-opcion"
      data-cerrado={deshabilitada ? "si" : "no"}
      className={
        "flex h-k-tarjeta-alto w-k-tarjeta flex-col items-center justify-center " +
        // El aviso de fin de jornada ocupa dos renglones grandes: el icono cede
        // tamano y el aire se achica para que nada se corte contra el alto fijo.
        (finDeJornada ? "gap-3 " : "gap-6 ") +
        "overflow-hidden rounded-3xl border-2 p-8 text-center transition-transform duration-150 " +
        (deshabilitada
          ? "border-gainsboro bg-gris-20 cursor-not-allowed"
          : "border-gris-70 bg-white shadow-lg shadow-black/15 active:scale-95 active:shadow-sm " +
            "focus-visible:outline focus-visible:outline-4 focus-visible:outline-gris-principal")
      }
    >
      <Icono
        className={
          (finDeJornada ? "h-16 w-16 " : "h-24 w-24 ") +
          (deshabilitada ? "text-gainsboro" : "text-osp")
        }
        strokeWidth={1.5}
        aria-hidden
      />

      <span className={"text-k-titulo font-titulo " + (deshabilitada ? "text-gris-80" : "")}>
        {titulo}
      </span>

      {subtitulo && !deshabilitada && (
        <span className="text-k-sub text-gris-principal">{subtitulo}</span>
      )}

      {/* Que ya cerro por hoy no es un detalle mas de la tarjeta: es el motivo
          por el que no se puede tocar, y por eso va en el cuerpo grande. */}
      {finDeJornada ? (
        <span className="flex flex-col gap-1" data-testid="leyenda-cerrado">
          <span className="text-k-titulo font-titulo text-gris-principal">
            Cerrado por hoy
          </span>
          {cerrado && (
            <span className="text-k-sub text-gris-principal">
              Atendió de {cerrado.desde} a {cerrado.hasta}
            </span>
          )}
        </span>
      ) : (
        cerrado && (
          <span className="text-k-sub text-gris-principal" data-testid="leyenda-cerrado">
            Cerrado · Atiende {cerrado.desde} a {cerrado.hasta}
          </span>
        )
      )}
    </button>
  )
}
