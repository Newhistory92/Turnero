"use client"

import { useActionState } from "react"
import { accionCambiarActivo, accionBorrar } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"

export interface FilaAbm {
  id: string
  celdas: string[]
  activa: boolean
  /** Si tiene referencias, no se ofrece el borrado definitivo. */
  borrable: boolean
}

function BotonEstado({
  entidad,
  fila,
  soloLectura,
}: {
  entidad: string
  fila: FilaAbm
  soloLectura: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionCambiarActivo, ESTADO_INICIAL)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="entidad" value={entidad} />
      <input type="hidden" name="id" value={fila.id} />
      <input type="hidden" name="activo" value={fila.activa ? "0" : "1"} />
      <button
        className="text-sm underline disabled:no-underline disabled:text-gris-80"
        disabled={soloLectura || pendiente}
      >
        {fila.activa ? "Desactivar" : "Activar"}
      </button>
      {estado.errores.length > 0 && (
        <span role="alert" className="ml-2 text-sm text-osp">
          {estado.errores[0].mensaje}
        </span>
      )}
    </form>
  )
}

function BotonBorrar({
  entidad,
  fila,
  soloLectura,
}: {
  entidad: string
  fila: FilaAbm
  soloLectura: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionBorrar, ESTADO_INICIAL)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="entidad" value={entidad} />
      <input type="hidden" name="id" value={fila.id} />
      <button
        className="text-sm text-osp underline disabled:no-underline disabled:text-gris-80"
        disabled={soloLectura || pendiente}
        // Borrar de verdad es irreversible y no tiene deshacer.
        onClick={(e) => {
          if (!confirm("Se borra definitivamente. ¿Seguro?")) e.preventDefault()
        }}
      >
        Borrar
      </button>
      {estado.errores.length > 0 && (
        <span role="alert" className="ml-2 text-sm text-osp">
          {estado.errores[0].mensaje}
        </span>
      )}
    </form>
  )
}

export function TablaAbm({
  entidad,
  columnas,
  filas,
  soloLectura,
}: {
  entidad: string
  columnas: string[]
  filas: FilaAbm[]
  soloLectura: boolean
}) {
  if (filas.length === 0) {
    return <p className="rounded-xl bg-white p-6 text-gris-principal">Todavía no hay ninguno.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gainsboro bg-white">
      <table className="w-full text-left">
        <thead className="border-b border-gainsboro">
          <tr>
            {columnas.map((c) => (
              <th key={c} scope="col" className="px-4 py-3 text-sm font-semibold">{c}</th>
            ))}
            <th scope="col" className="px-4 py-3 text-sm font-semibold">Estado</th>
            <th scope="col" className="px-4 py-3 text-sm font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-b border-gris-20 last:border-0">
              {f.celdas.map((c, i) => (
                <td key={i} className="px-4 py-3">{c}</td>
              ))}
              <td className="px-4 py-3">
                {/* El estado no se comunica solo por color. */}
                <span className={f.activa ? "font-semibold" : "text-gris-80"}>
                  {f.activa ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="flex gap-4 px-4 py-3">
                <BotonEstado entidad={entidad} fila={f} soloLectura={soloLectura} />
                {f.borrable && (
                  <BotonBorrar entidad={entidad} fila={f} soloLectura={soloLectura} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
