"use client"

import { TarjetaOpcion } from "../TarjetaOpcion"
import type { CategoriaVista } from "../Wizard"

interface Props {
  categorias: CategoriaVista[]
  nombre: string | null
  onElegir: (c: CategoriaVista) => void
}

export function PasoCategoria({ categorias, nombre, onElegir }: Props) {
  const primerNombre = nombre?.split(" ")[0]

  return (
    <div className="flex h-full flex-col items-center justify-center gap-16">
      <h1 className="text-k-pregunta font-titulo">
        {primerNombre ? `¿Qué necesita, ${primerNombre}?` : "¿Qué necesita?"}
      </h1>

      <div className="flex gap-8">
        {categorias.map((c) => (
          <TarjetaOpcion
            key={c.id}
            icono={c.icono}
            titulo={c.nombre}
            onClick={() => onElegir(c)}
          />
        ))}
      </div>
    </div>
  )
}
