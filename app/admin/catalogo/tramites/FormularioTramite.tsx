"use client"

import { useActionState } from "react"
import { accionGuardarTramite } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import {
  CampoTexto,
  CampoNumero,
  CampoSelect,
  CampoDias,
  CampoCasillas,
} from "../../_componentes/Campos"

export interface TramiteEditar {
  id: string
  nombre: string
  subtitulo: string
  categoriaId: string
  icono: string
  prefijo: string
  destinoAlaId: string
  destinoPisoId: string
  horaApertura: string
  horaCierre: string
  duracionMinimaEsperada: number
  diasSemana: string
  orden: number
  boxIds: string[]
}

export function FormularioTramite({
  categorias,
  alas,
  pisos,
  boxes,
  iconos,
  soloLectura,
  editar,
}: {
  categorias: { id: string; nombre: string }[]
  alas: { id: string; nombre: string }[]
  pisos: { id: string; nombre: string }[]
  boxes: { id: string; nombre: string }[]
  iconos: string[]
  soloLectura: boolean
  editar?: TramiteEditar
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarTramite, ESTADO_INICIAL)
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
        <CampoTexto
          etiqueta="Subtítulo"
          campo="subtitulo"
          errores={estado.errores}
          valor={e?.subtitulo}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Categoría"
          campo="categoriaId"
          errores={estado.errores}
          valor={e?.categoriaId}
          opciones={categorias}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Icono"
          campo="icono"
          errores={estado.errores}
          valor={e?.icono}
          opciones={iconos.map((i) => ({ id: i, nombre: i }))}
          soloLectura={soloLectura}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <CampoTexto
          etiqueta="Prefijo"
          campo="prefijo"
          errores={estado.errores}
          valor={e?.prefijo}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Destino: ala"
          campo="destinoAlaId"
          errores={estado.errores}
          valor={e?.destinoAlaId}
          opciones={alas}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Destino: piso"
          campo="destinoPisoId"
          errores={estado.errores}
          valor={e?.destinoPisoId}
          opciones={pisos}
          soloLectura={soloLectura}
        />
        <CampoNumero
          etiqueta="Orden"
          campo="orden"
          errores={estado.errores}
          valor={e?.orden ?? 0}
          soloLectura={soloLectura}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
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
        <CampoNumero
          etiqueta="Duración mínima (min)"
          campo="duracionMinimaEsperada"
          errores={estado.errores}
          valor={e?.duracionMinimaEsperada ?? 5}
          soloLectura={soloLectura}
        />
      </div>

      {/* Días en su propia fila: 7 checkboxes no entran en 1/4 del ancho */}
      <CampoDias
        errores={estado.errores}
        valor={e?.diasSemana ?? "12345"}
        soloLectura={soloLectura}
      />

      <CampoCasillas
        etiqueta="Boxes que lo atienden"
        campo="boxId"
        opciones={boxes}
        marcados={e?.boxIds ?? []}
        soloLectura={soloLectura}
      />

      <div className="flex items-center gap-4">
        <button
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white shadow-sm shadow-black/15 transition-shadow duration-150 hover:shadow-md disabled:shadow-none disabled:bg-gainsboro disabled:text-gris-80"
          disabled={soloLectura || pendiente}
        >
          {pendiente ? "Guardando…" : e ? "Actualizar trámite" : "Agregar trámite"}
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
