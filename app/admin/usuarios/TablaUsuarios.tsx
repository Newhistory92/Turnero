"use client"

import { useActionState } from "react"
import { accionGuardarUsuario } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import type { UsuarioFila } from "@/lib/admin/usuarios"

const ROLES = ["operador", "supervisor", "director", "admin"] as const

interface Box {
  id: string
  nombre: string
}

export function TablaUsuarios({
  usuarios,
  boxes,
  actorId,
}: {
  usuarios: UsuarioFila[]
  boxes: Box[]
  actorId: string
}) {
  if (usuarios.length === 0) {
    return (
      <p className="rounded-xl bg-white p-4 text-sm text-gris-80">
        Todavia no hay nadie importado. Usa el boton de arriba para traer gente.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {usuarios.map((u) => (
        <Fila key={u.id} usuario={u} boxes={boxes} esMiFila={u.id === actorId} />
      ))}
    </div>
  )
}

const CAMPO =
  "rounded-lg border-2 border-gris-70 bg-white px-3 py-2 " +
  "focus:border-gris-principal focus:outline-none disabled:bg-gris-20"

function Fila({
  usuario,
  boxes,
  esMiFila,
}: {
  usuario: UsuarioFila
  boxes: Box[]
  esMiFila: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarUsuario, ESTADO_INICIAL)

  return (
    <form
      action={accion}
      // Los inactivos atenuados: se distinguen de un vistazo sin gastar una
      // columna en decir "inactivo".
      className={`flex flex-col gap-4 rounded-xl bg-white p-4 ${usuario.activo ? "" : "opacity-60"}`}
    >
      <input type="hidden" name="empleadoId" value={usuario.id} />

      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-48">
          <p className="font-semibold">{usuario.nombre}</p>
          <p className="text-sm text-gris-80">DNI {usuario.dniInstitucional}</p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Rol</span>
          <select
            className={CAMPO}
            name="rol"
            defaultValue={usuario.rol}
            disabled={esMiFila}
            required
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={usuario.activo}
            disabled={esMiFila}
          />
          Activo
        </label>

        {esMiFila && (
          <span className="rounded-lg bg-gainsboro px-3 py-1 text-xs font-semibold">
            Sos vos
          </span>
        )}
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-semibold">Boxes que atiende</legend>
        {boxes.length === 0 ? (
          <p className="text-sm text-gris-80">No hay boxes activos.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {boxes.map((b) => (
              <label key={b.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  name="boxId"
                  value={b.id}
                  defaultChecked={usuario.boxIds.includes(b.id)}
                />
                {b.nombre}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-4">
        <button
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
          disabled={pendiente}
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {estado.guardado && <span className="text-sm text-gris-80">Guardado</span>}
        {estado.errores.length > 0 && (
          <span role="alert" className="text-sm text-osp">
            {estado.errores[0].mensaje}
          </span>
        )}
      </div>
    </form>
  )
}
