"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Monitor, ArrowRight, X } from "lucide-react"

interface AlaVista {
  nombre: string
  slug: string
}

/**
 * "Pantalla Pública" ya no linkea directo a un ala fija: hoy hay Sur y
 * Norte, pero el dia que se agregue una tercera sede esto no deberia
 * necesitar tocar codigo. El modal lista lo que venga de la base.
 */
export function SelectorPantalla({ alas }: { alas: AlaVista[] }) {
  const [abierto, setAbierto] = useState(false)
  const primerEnlace = useRef<HTMLAnchorElement | null>(null)

  useEffect(() => {
    if (!abierto) return
    primerEnlace.current?.focus()

    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false)
    }
    window.addEventListener("keydown", alTeclado)
    return () => window.removeEventListener("keydown", alTeclado)
  }, [abierto])

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="group flex flex-col gap-4 rounded-2xl border-2 border-gris-70 bg-white p-8 text-left shadow-sm transition-colors hover:border-osp focus-visible:outline focus-visible:outline-4 focus-visible:outline-gris-principal"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gris-20">
          <Monitor className="h-7 w-7 text-gris-80" aria-hidden />
        </span>
        <span>
          <span className="block text-xl font-semibold">Pantalla Pública</span>
          <span className="mt-1 block text-sm text-gris-80">
            Visualización en tiempo real de turnos llamados
          </span>
        </span>
        <span className="mt-2 flex items-center gap-2 text-sm font-medium text-osp">
          Ver pantalla
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </span>
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setAbierto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-selector-pantalla"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h2 id="titulo-selector-pantalla" className="text-lg font-semibold text-gris-principal">
                Elegí una pantalla
              </h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1 text-gris-80 hover:bg-gris-20 focus-visible:outline focus-visible:outline-4 focus-visible:outline-gris-principal"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {alas.length === 0 ? (
              <p className="mt-4 text-sm text-gris-80">No hay alas activas configuradas.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {alas.map((a, i) => (
                  <li key={a.slug}>
                    <Link
                      ref={i === 0 ? primerEnlace : undefined}
                      href={`/pantalla/${a.slug}`}
                      className="flex items-center justify-between rounded-xl border-2 border-gris-70 px-4 py-3 text-sm font-medium text-gris-principal transition-colors hover:border-osp focus-visible:outline focus-visible:outline-4 focus-visible:outline-gris-principal"
                    >
                      Ala {a.nombre}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}
