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

export interface BoxEditar {
  id: string
  nombre: string
  numero: number
  alaId: string
  pisoId: string
  horaApertura: string
  horaCierre: string
  diasSemana: string
  tramiteIds: string[]
}

export function FormularioBox({
  alas,
  pisos,
  tramites,
  soloLectura,
  editar,
}: {
  alas: { id: string; nombre: string }[]
  pisos: { id: string; nombre: string }[]
  tramites: { id: string; nombre: string }[]
  soloLectura: boolean
  editar?: BoxEditar
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarBox, ESTADO_INICIAL)
  const e = editar

  return (
    <form
      key={e?.id ?? "nuevo"}
      action={accion}
      className="mb-6 flex flex-col gap-4 rounded-xl bg-white p-4"
    >
      <input type="hidden" name="id" value={e?.id ?? ""} />

      <div className="grid grid-cols-4 gap-4">
        <CampoTexto
          etiqueta="Nombre"
          campo="nombre"
          errores={estado.errores}
          valor={e?.nombre}
          soloLectura={soloLectura}
        />
        <CampoNumero
          etiqueta="Número"
          campo="numero"
          errores={estado.errores}
          valor={e?.numero ?? 1}
          soloLectura={soloLectura}
          minimo={1}
        />
        <CampoSelect
          etiqueta="Ala"
          campo="alaId"
          errores={estado.errores}
          valor={e?.alaId}
          opciones={alas}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Piso"
          campo="pisoId"
          errores={estado.errores}
          valor={e?.pisoId}
          opciones={pisos}
          soloLectura={soloLectura}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CampoTexto
          etiqueta="Abre"
          campo="horaApertura"
          errores={estado.errores}
          valor={e?.horaApertura ?? "08:00"}
          soloLectura={soloLectura}
        />
        <CampoTexto
          etiqueta="Cierra"
          campo="horaCierre"
          errores={estado.errores}
          valor={e?.horaCierre ?? "14:00"}
          soloLectura={soloLectura}
        />
      </div>

      {/* Días en su propia fila: 7 checkboxes no entran en media fila */}
      <CampoDias
        errores={estado.errores}
        valor={e?.diasSemana ?? "12345"}
        soloLectura={soloLectura}
      />

      <CampoCasillas
        etiqueta="Trámites que atiende"
        campo="tramiteId"
        opciones={tramites}
        marcados={e?.tramiteIds ?? []}
        soloLectura={soloLectura}
        linkAgregar={{ href: "/admin/catalogo/tramites", texto: "+ Agregar trámite" }}
      />

      <div className="flex items-center gap-4">
        <button
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white shadow-sm shadow-black/15 transition-shadow duration-150 hover:shadow-md disabled:shadow-none disabled:bg-gainsboro disabled:text-gris-80"
          disabled={soloLectura || pendiente}
        >
          {pendiente ? "Guardando…" : e ? "Actualizar box" : "Agregar box"}
        </button>
        {e && (
          <a href="?" className="text-sm text-gris-80 underline">
            Cancelar edición
          </a>
        )}
      </div>

      {estado.errores.some((e) => e.campo === "rol") && (
        <p role="alert" className="text-sm text-osp">
          {estado.errores.find((e) => e.campo === "rol")?.mensaje}
        </p>
      )}
    </form>
  )
}
