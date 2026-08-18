"use client"

import { useActionState } from "react"
import { accionGuardarSimple } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import { CampoTexto, CampoNumero, CampoSelect } from "../../_componentes/Campos"
import type { EntidadSimple } from "@/lib/admin/mutaciones"

export function FormularioSimple({
  entidad,
  etiquetaPosicion,
  sedes,
  iconos,
  soloLectura,
}: {
  entidad: EntidadSimple
  etiquetaPosicion: string | null
  sedes: { id: string; nombre: string }[]
  iconos: string[] | null
  soloLectura: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarSimple, ESTADO_INICIAL)

  return (
    <form action={accion} className="mb-6 grid grid-cols-4 items-end gap-4 rounded-xl bg-white p-4">
      <input type="hidden" name="entidad" value={entidad} />
      <input type="hidden" name="id" value="" />

      <CampoTexto
        etiqueta="Nombre"
        campo="nombre"
        errores={estado.errores}
        soloLectura={soloLectura}
      />

      {etiquetaPosicion && (
        <CampoNumero
          etiqueta={etiquetaPosicion}
          campo="posicion"
          errores={estado.errores}
          soloLectura={soloLectura}
          valor={0}
        />
      )}
      {!etiquetaPosicion && <input type="hidden" name="posicion" value="0" />}

      {sedes.length > 0 && (
        <CampoSelect
          etiqueta="Sede"
          campo="sedeId"
          errores={estado.errores}
          opciones={sedes}
          soloLectura={soloLectura}
        />
      )}

      {iconos && (
        <CampoSelect
          etiqueta="Icono"
          campo="icono"
          errores={estado.errores}
          opciones={iconos.map((i) => ({ id: i, nombre: i }))}
          soloLectura={soloLectura}
        />
      )}

      <button
        className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
        disabled={soloLectura || pendiente}
      >
        {pendiente ? "Guardando…" : "Agregar"}
      </button>

      {estado.errores.some((e) => e.campo === "rol") && (
        <p role="alert" className="col-span-4 text-sm text-osp">
          {estado.errores.find((e) => e.campo === "rol")?.mensaje}
        </p>
      )}
    </form>
  )
}
