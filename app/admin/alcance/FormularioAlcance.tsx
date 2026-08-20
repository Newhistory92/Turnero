"use client"

import { useActionState } from "react"
import { accionGuardarAlcance } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import { CampoCasillas } from "../_componentes/Campos"

export function FormularioAlcance({
  empleadoId,
  empleadoNombre,
  tramites,
  asignados,
  soloLectura,
}: {
  empleadoId: string
  empleadoNombre: string
  tramites: { id: string; nombre: string }[]
  asignados: string[]
  soloLectura: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarAlcance, ESTADO_INICIAL)

  return (
    <form action={accion} className="flex flex-col gap-4 rounded-xl bg-white p-4">
      <input type="hidden" name="empleadoId" value={empleadoId} />

      <div className="flex items-center gap-3">
        <h2 className="font-semibold">{empleadoNombre}</h2>
        {asignados.length === 0 && (
          <span className="rounded-lg bg-osp px-2 py-1 text-xs font-semibold text-white">
            Sin trámites asignados
          </span>
        )}
      </div>

      <CampoCasillas
        etiqueta="Trámites cuyas métricas puede ver"
        campo="tramiteId"
        opciones={tramites}
        marcados={asignados}
        soloLectura={soloLectura}
      />

      <div className="flex items-center gap-4">
        <button
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
          disabled={soloLectura || pendiente}
        >
          {pendiente ? "Guardando…" : "Guardar alcance"}
        </button>
        {estado.guardado && <span className="text-sm text-gris-80">Guardado</span>}
      </div>

      {estado.errores.length > 0 && (
        <p role="alert" className="text-sm text-osp">
          {estado.errores[0].mensaje}
        </p>
      )}
    </form>
  )
}
