"use client"

import type { ErrorCampo } from "@/lib/admin/validaciones"

const BASE =
  "w-full rounded-lg border-2 border-gris-70 bg-white px-3 py-2 " +
  "focus:border-gris-principal focus:outline-none disabled:bg-gris-20"

function mensajeDe(errores: ErrorCampo[], campo: string): string | undefined {
  return errores.find((e) => e.campo === campo)?.mensaje
}

function Envoltura({
  etiqueta,
  campo,
  errores,
  children,
}: {
  etiqueta: string
  campo: string
  errores: ErrorCampo[]
  children: React.ReactNode
}) {
  const error = mensajeDe(errores, campo)
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold">{etiqueta}</span>
      {children}
      {/* El error va pegado al campo, no arriba de todo: quien lo tiene que
          corregir esta mirando aca. */}
      {error && (
        <span role="alert" className="text-sm text-osp">
          {error}
        </span>
      )}
    </label>
  )
}

export function CampoTexto({
  etiqueta,
  campo,
  errores,
  valor,
  soloLectura,
  requerido = true,
}: {
  etiqueta: string
  campo: string
  errores: ErrorCampo[]
  valor?: string
  soloLectura: boolean
  requerido?: boolean
}) {
  return (
    <Envoltura etiqueta={etiqueta} campo={campo} errores={errores}>
      <input
        className={BASE}
        name={campo}
        defaultValue={valor}
        disabled={soloLectura}
        required={requerido}
      />
    </Envoltura>
  )
}

export function CampoNumero({
  etiqueta,
  campo,
  errores,
  valor,
  soloLectura,
  minimo = 0,
}: {
  etiqueta: string
  campo: string
  errores: ErrorCampo[]
  valor?: number
  soloLectura: boolean
  minimo?: number
}) {
  return (
    <Envoltura etiqueta={etiqueta} campo={campo} errores={errores}>
      <input
        className={BASE}
        type="number"
        name={campo}
        defaultValue={valor}
        min={minimo}
        disabled={soloLectura}
        required
      />
    </Envoltura>
  )
}

export function CampoSelect({
  etiqueta,
  campo,
  errores,
  valor,
  opciones,
  soloLectura,
}: {
  etiqueta: string
  campo: string
  errores: ErrorCampo[]
  valor?: string
  opciones: { id: string; nombre: string }[]
  soloLectura: boolean
}) {
  return (
    <Envoltura etiqueta={etiqueta} campo={campo} errores={errores}>
      <select
        className={BASE}
        name={campo}
        defaultValue={valor ?? ""}
        disabled={soloLectura}
        required
      >
        <option value="">Elegí una opción</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>{o.nombre}</option>
        ))}
      </select>
    </Envoltura>
  )
}

const DIAS = [
  { valor: "0", nombre: "Dom" },
  { valor: "1", nombre: "Lun" },
  { valor: "2", nombre: "Mar" },
  { valor: "3", nombre: "Mié" },
  { valor: "4", nombre: "Jue" },
  { valor: "5", nombre: "Vie" },
  { valor: "6", nombre: "Sáb" },
]

/**
 * Casillas, no texto libre: diasSemana es un conjunto de digitos y escribirlo
 * a mano es la forma mas facil de cargar "1223" sin darse cuenta.
 */
export function CampoDias({
  errores,
  valor = "",
  soloLectura,
}: {
  errores: ErrorCampo[]
  valor?: string
  soloLectura: boolean
}) {
  const error = mensajeDe(errores, "diasSemana")
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-semibold">Días</legend>
      <div className="flex gap-3">
        {DIAS.map((d) => (
          <label key={d.valor} className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              name="dia"
              value={d.valor}
              defaultChecked={valor.includes(d.valor)}
              disabled={soloLectura}
            />
            {d.nombre}
          </label>
        ))}
      </div>
      {error && (
        <span role="alert" className="text-sm text-osp">
          {error}
        </span>
      )}
    </fieldset>
  )
}

export function CampoCasillas({
  etiqueta,
  campo,
  opciones,
  marcados,
  soloLectura,
  linkAgregar,
}: {
  etiqueta: string
  campo: string
  opciones: { id: string; nombre: string }[]
  marcados: string[]
  soloLectura: boolean
  linkAgregar?: { href: string; texto: string }
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <legend className="text-sm font-semibold">{etiqueta}</legend>
        {linkAgregar && (
          <a href={linkAgregar.href} className="text-sm text-osp underline">
            {linkAgregar.texto}
          </a>
        )}
      </div>
      {opciones.length === 0 ? (
        <p className="text-sm text-gris-80">
          No hay trámites creados aún.
          {linkAgregar && (
            <>
              {" "}
              <a href={linkAgregar.href} className="underline">
                Creá uno primero
              </a>
              .
            </>
          )}
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {opciones.map((o) => (
            <label key={o.id} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name={campo}
                value={o.id}
                defaultChecked={marcados.includes(o.id)}
                disabled={soloLectura}
              />
              {o.nombre}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  )
}
