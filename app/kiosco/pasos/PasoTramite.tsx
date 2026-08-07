"use client"

import { TarjetaOpcion } from "../TarjetaOpcion"
import type { CategoriaVista, TramiteVista } from "../Wizard"

export interface EstadoTramite {
  disponible: boolean
  ventana: { desde: string; hasta: string } | null
}

interface Props {
  categoria: CategoriaVista
  estados: Record<string, EstadoTramite>
  onElegir: (t: TramiteVista) => void
}

export function PasoTramite({ categoria, estados, onElegir }: Props) {
  const tramites = categoria.tramites
  // Una fila si son <= 4; dos filas de 4 como maximo si son 5 a 7. Nunca hay scroll.
  const filas = tramites.length <= 4 ? [tramites] : [tramites.slice(0, 4), tramites.slice(4)]

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10">
      <h1 className="text-k-pregunta font-titulo">{categoria.nombre}</h1>

      {filas.map((fila, i) => (
        <div key={i} className="flex justify-center gap-8">
          {fila.map((t) => {
            const estado = estados[t.id]
            return (
              <TarjetaOpcion
                key={t.id}
                icono={t.icono}
                titulo={t.nombre}
                subtitulo={t.subtitulo}
                cerrado={estado?.disponible === false ? estado.ventana : null}
                onClick={() => onElegir(t)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
