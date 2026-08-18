"use client"

import { useActionState } from "react"
import { accionGuardarBox } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import {
  CampoTexto,
  CampoNumero,
  CampoSelect,
  CampoDias,
  CampoCasillas,
} from "../../_componentes/Campos"

export function FormularioBox({
  alas,
  pisos,
  tramites,
  soloLectura,
}: {
  alas: { id: string; nombre: string }[]
  pisos: { id: string; nombre: string }[]
  tramites: { id: string; nombre: string }[]
  soloLectura: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarBox, ESTADO_INICIAL)

  return (
    <form action={accion} className="mb-6 flex flex-col gap-4 rounded-xl bg-white p-4">
      <input type="hidden" name="id" value="" />

      <div className="grid grid-cols-4 gap-4">
        <CampoTexto
          etiqueta="Nombre"
          campo="nombre"
          errores={estado.errores}
          soloLectura={soloLectura}
        />
        <CampoNumero
          etiqueta="Número"
          campo="numero"
          errores={estado.errores}
          soloLectura={soloLectura}
          minimo={1}
          valor={1}
        />
        <CampoSelect
          etiqueta="Ala"
          campo="alaId"
          errores={estado.errores}
          opciones={alas}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Piso"
          campo="pisoId"
          errores={estado.errores}
          opciones={pisos}
          soloLectura={soloLectura}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <CampoTexto
          etiqueta="Abre"
          campo="horaApertura"
          errores={estado.errores}
          valor="08:00"
          soloLectura={soloLectura}
        />
        <CampoTexto
          etiqueta="Cierra"
          campo="horaCierre"
          errores={estado.errores}
          valor="14:00"
          soloLectura={soloLectura}
        />
        <div className="col-span-2">
          <CampoDias errores={estado.errores} valor="12345" soloLectura={soloLectura} />
        </div>
      </div>

      <CampoCasillas
        etiqueta="Trámites que atiende"
        campo="tramiteId"
        opciones={tramites}
        marcados={[]}
        soloLectura={soloLectura}
      />

      <div>
        <button
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
          disabled={soloLectura || pendiente}
        >
          {pendiente ? "Guardando…" : "Agregar box"}
        </button>
      </div>

      {estado.errores.some((e) => e.campo === "rol") && (
        <p role="alert" className="text-sm text-osp">
          {estado.errores.find((e) => e.campo === "rol")?.mensaje}
        </p>
      )}
    </form>
  )
}
