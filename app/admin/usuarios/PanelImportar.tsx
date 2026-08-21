"use client"

import { useActionState, useState } from "react"
import { accionImportar } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import type { Importable } from "@/lib/admin/importacion"

/** Sin acentos y en minusculas, para que buscar "ramirez" encuentre "Ramirez". */
function normalizar(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

export function PanelImportar({
  importables,
  error,
}: {
  importables: Importable[]
  error: string | null
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [estado, accion, pendiente] = useActionState(accionImportar, ESTADO_INICIAL)

  // El filtrado es en el cliente: son unas 150 filas ya cargadas y no vale la
  // pena ir al servidor por cada tecla.
  const q = normalizar(busqueda)
  const visibles =
    q === ""
      ? importables
      : importables.filter(
          (i) => normalizar(i.nombre).includes(q) || normalizar(i.nombreUsuario).includes(q)
        )

  const faltan = importables.filter((i) => !i.yaEsta).length

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white"
        >
          {abierto ? "Cerrar" : "Importar desde la obra social"}
        </button>
        {!abierto && !error && (
          <span className="text-sm text-gris-80">
            {faltan === 0
              ? "No queda nadie por importar."
              : `${faltan} personas sin importar todavÃ­a.`}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-osp">
          {error}
        </p>
      )}

      {abierto && !error && (
        <form action={accion} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Buscar</span>
            <input
              className="rounded-lg border-2 border-gris-70 bg-white px-3 py-2 focus:border-gris-principal focus:outline-none"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o usuario"
            />
          </label>

          <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {visibles.length === 0 ? (
              <p className="text-sm text-gris-80">Nadie coincide con esa bÃºsqueda.</p>
            ) : (
              visibles.map((i) => (
                <label
                  key={i.nombreUsuario}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-gris-20"
                >
                  <input
                    type="checkbox"
                    name="nombreUsuario"
                    value={i.nombreUsuario}
                    // Marcado y deshabilitado comunica "ya esta" sin una
                    // segunda lista, y hace imposible reimportarlo sin querer.
                    defaultChecked={i.yaEsta}
                    disabled={i.yaEsta}
                  />
                  <span className={i.yaEsta ? "text-gris-80" : ""}>
                    {i.nombre} <span className="text-gris-80">({i.nombreUsuario})</span>
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
              disabled={pendiente}
            >
              {pendiente ? "Importandoâ€¦" : "Importar seleccionados"}
            </button>
            {estado.guardado && <span className="text-sm text-gris-80">Importados</span>}
            {estado.errores.length > 0 && (
              <span role="alert" className="text-sm text-osp">
                {estado.errores[0].mensaje}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

