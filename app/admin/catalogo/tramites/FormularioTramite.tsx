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

export function FormularioTramite({
  categorias,
  alas,
  pisos,
  boxes,
  iconos,
  soloLectura,
}: {
  categorias: { id: string; nombre: string }[]
  alas: { id: string; nombre: string }[]
  pisos: { id: string; nombre: string }[]
  boxes: { id: string; nombre: string }[]
  iconos: string[]
  soloLectura: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarTramite, ESTADO_INICIAL)

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
        <CampoTexto
          etiqueta="Subtítulo"
          campo="subtitulo"
          errores={estado.errores}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Categoría"
          campo="categoriaId"
          errores={estado.errores}
          opciones={categorias}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Icono"
          campo="icono"
          errores={estado.errores}
          opciones={iconos.map((i) => ({ id: i, nombre: i }))}
          soloLectura={soloLectura}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <CampoTexto
          etiqueta="Prefijo"
          campo="prefijo"
          errores={estado.errores}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Destino: ala"
          campo="destinoAlaId"
          errores={estado.errores}
          opciones={alas}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Destino: piso"
          campo="destinoPisoId"
          errores={estado.errores}
          opciones={pisos}
          soloLectura={soloLectura}
        />
        <CampoNumero
          etiqueta="Orden"
          campo="orden"
          errores={estado.errores}
          soloLectura={soloLectura}
          valor={0}
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
        <CampoNumero
          etiqueta="Duración mínima (min)"
          campo="duracionMinimaEsperada"
          errores={estado.errores}
          soloLectura={soloLectura}
          valor={5}
        />
        <CampoDias errores={estado.errores} valor="12345" soloLectura={soloLectura} />
      </div>

      <CampoCasillas
        etiqueta="Boxes que lo atienden"
        campo="boxId"
        opciones={boxes}
        marcados={[]}
        soloLectura={soloLectura}
      />

      <div>
        <button
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
          disabled={soloLectura || pendiente}
        >
          {pendiente ? "Guardando…" : "Agregar trámite"}
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
