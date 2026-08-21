"use client"

import { useActionState } from "react"
import { accionGuardarSimple } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import { CampoTexto, CampoNumero, CampoSelect } from "../../_componentes/Campos"
import type { EntidadSimple } from "@/lib/admin/mutaciones"

export interface SimpleEditar {
  id: string
  nombre: string
  posicion: number
  sedeId?: string
  icono?: string
}

export function FormularioSimple({
  entidad,
  etiquetaPosicion,
  sedes,
  iconos,
  soloLectura,
  editar,
}: {
  entidad: EntidadSimple
  etiquetaPosicion: string | null
  sedes: { id: string; nombre: string }[]
  iconos: string[] | null
  soloLectura: boolean
  editar?: SimpleEditar
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarSimple, ESTADO_INICIAL)
  const e = editar

  return (
    <form
      key={e?.id ?? "nuevo"}
      action={accion}
      className="mb-6 grid grid-cols-4 items-end gap-4 rounded-xl bg-white p-4"
    >
      <input type="hidden" name="entidad" value={entidad} />
      <input type="hidden" name="id" value={e?.id ?? ""} />

      <CampoTexto
        etiqueta="Nombre"
        campo="nombre"
        errores={estado.errores}
        valor={e?.nombre}
        soloLectura={soloLectura}
      />

      {etiquetaPosicion && (
        <CampoNumero
          etiqueta={etiquetaPosicion}
          campo="posicion"
          errores={estado.errores}
          valor={e?.posicion ?? 0}
          soloLectura={soloLectura}
        />
      )}
      {!etiquetaPosicion && <input type="hidden" name="posicion" value="0" />}

      {sedes.length > 0 && (
        <CampoSelect
          etiqueta="Sede"
          campo="sedeId"
          errores={estado.errores}
          valor={e?.sedeId}
          opciones={sedes}
          soloLectura={soloLectura}
        />
      )}

      {iconos && (
        <CampoSelect
          etiqueta="Icono"
          campo="icono"
          errores={estado.errores}
          valor={e?.icono}
          opciones={iconos.map((i) => ({ id: i, nombre: i }))}
          soloLectura={soloLectura}
        />
      )}

      <div className="flex items-center gap-4">
        <button
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white shadow-sm shadow-black/15 transition-shadow duration-150 hover:shadow-md disabled:shadow-none disabled:bg-gainsboro disabled:text-gris-80"
          disabled={soloLectura || pendiente}
        >
          {pendiente ? "Guardando…" : e ? "Actualizar" : "Agregar"}
        </button>
        {e && (
          <a href="?" className="text-sm text-gris-80 underline">
            Cancelar
          </a>
        )}
      </div>

      {estado.errores.some((e) => e.campo === "rol") && (
        <p role="alert" className="col-span-4 text-sm text-osp">
          {estado.errores.find((e) => e.campo === "rol")?.mensaje}
        </p>
      )}
    </form>
  )
}
