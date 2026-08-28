"use client"

import { useEffect, useMemo, useState } from "react"

interface TramiteDestino {
  id: string
  nombre: string
  ala: string
  piso: string
}

interface CategoriaDestino {
  id: string
  nombre: string
  tramites: TramiteDestino[]
}

export function DialogoDerivar({
  tramiteActualId,
  onConfirmar,
  onCerrar,
}: {
  tramiteActualId: string
  onConfirmar: (tramiteId: string) => void
  onCerrar: () => void
}) {
  const [categorias, setCategorias] = useState<CategoriaDestino[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [elegido, setElegido] = useState<TramiteDestino | null>(null)

  useEffect(() => {
    fetch("/api/catalogo")
      .then((r) => r.json())
      .then((d) => setCategorias(d.categorias))
      .catch(() => setCategorias([]))
  }, [])

  useEffect(() => {
    const alEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar()
    }
    window.addEventListener("keydown", alEscape)
    return () => window.removeEventListener("keydown", alEscape)
  }, [onCerrar])

  const resultados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return categorias
      .map((c) => ({
        ...c,
        tramites: c.tramites.filter(
          (t) => t.id !== tramiteActualId && t.nombre.toLowerCase().includes(texto)
        ),
      }))
      .filter((c) => c.tramites.length > 0)
  }, [categorias, busqueda, tramiteActualId])

  // Confirmado: se muestra el destino en grande. El aviso es verbal — el
  // operador se lo lee al afiliado, que conserva el ticket que ya tiene.
  if (elegido) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gris-principal/60 p-6">
        <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl p-10 text-center">
          <p className="text-lg">Derivar a</p>
          <p className="mt-2 font-titulo text-4xl font-bold">{elegido.nombre}</p>
          <p className="mt-6 font-titulo text-3xl font-semibold">Ala {elegido.ala}</p>
          <p className="text-2xl">{elegido.piso}</p>
          <p className="mt-6 text-sm">
            No se imprime un ticket nuevo: el afiliado conserva el que tiene, con el mismo número.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onConfirmar(elegido.id)}
              className="rounded-2xl bg-gris-principal px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-black/15 transition-shadow duration-150 hover:shadow-xl active:shadow-sm"
            >
              Confirmar derivación
            </button>
            <button
              type="button"
              onClick={() => setElegido(null)}
              className="rounded-2xl border-2 border-gris-70 bg-white px-6 py-4 text-lg font-semibold shadow-md shadow-black/10 transition-shadow duration-150 hover:shadow-lg active:shadow-sm"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-gris-principal/60 p-6">
      <div className="mt-12 w-full max-w-2xl rounded-2xl bg-white shadow-2xl p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-titulo text-2xl font-semibold">Derivar a otro trámite</h2>
          <button type="button" onClick={onCerrar} className="text-sm font-semibold">
            Cancelar
          </button>
        </div>

        <input
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar trámite…"
          className="mt-4 w-full rounded-xl border-2 border-gris-70 px-4 py-3 text-lg focus:border-gris-principal focus:outline-none"
        />

        <div className="mt-4 max-h-96 overflow-y-auto">
          {resultados.length === 0 && <p className="py-6 text-center">Sin resultados</p>}
          {resultados.map((c) => (
            <div key={c.id} className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide">{c.nombre}</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {c.tramites.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setElegido(t)}
                      className="w-full rounded-xl px-4 py-3 text-left text-lg hover:bg-gris-20"
                    >
                      {t.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
