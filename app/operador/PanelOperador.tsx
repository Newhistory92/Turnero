"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { usarSocketOperador } from "./usarSocketOperador"
import { usarAtajos, type Accion, type EstadoPanel } from "./usarAtajos"
import { TurnoActivo } from "./TurnoActivo"
import { ColaBox } from "./ColaBox"
import { ListaAusentes } from "./ListaAusentes"
import { DialogoDerivar } from "./DialogoDerivar"

export function PanelOperador() {
  const router = useRouter()
  const { snapshot, conectado, sinSesion, enviar } = usarSocketOperador()
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [inicioAtencion, setInicioAtencion] = useState<number | null>(null)
  const [derivando, setDerivando] = useState(false)

  useEffect(() => {
    if (sinSesion) router.push("/operador/login")
  }, [sinSesion, router])

  const activo = snapshot?.activo ?? null

  useEffect(() => {
    if (activo?.estado === "atendiendo" && inicioAtencion === null) {
      setInicioAtencion(Date.now())
    }
    if (!activo || activo.estado !== "atendiendo") {
      setInicioAtencion(null)
    }
  }, [activo, inicioAtencion])

  const comando = useCallback(
    async (nombre: string, datos: Record<string, unknown> = {}) => {
      setOcupado(true)
      setAviso(null)
      const r = await enviar(nombre, datos)
      // Nunca mudo: si falla, el operador se entera y sabe por que.
      if (!r.ok) setAviso(r.mensaje ?? "No se pudo completar la acción")
      setOcupado(false)
    },
    [enviar]
  )

  const llamarSiguiente = useCallback(() => {
    const siguiente = snapshot?.cola[0]
    if (siguiente) void comando("LLAMAR_TURNO", { turnoId: siguiente.id })
  }, [snapshot, comando])

  const sobreActivo = useCallback(
    (nombre: string) => {
      if (activo) void comando(nombre, { turnoId: activo.id })
    },
    [activo, comando]
  )

  const estadoPanel: EstadoPanel =
    !activo ? "sin-turno" : activo.estado === "atendiendo" ? "atendiendo" : "llamado"

  const confirmar = (mensaje: string) => window.confirm(mensaje)

  usarAtajos(estadoPanel, !!snapshot && conectado && !ocupado && !derivando, (accion: Accion) => {
    switch (accion) {
      case "llamar": llamarSiguiente(); break
      case "iniciar": sobreActivo("INICIAR_ATENCION"); break
      case "finalizar": sobreActivo("FINALIZAR_ATENCION"); break
      case "rellamar": sobreActivo("RELLAMAR_TURNO"); break
      // Confirmacion explicita: no se pueden deshacer.
      case "ausente":
        if (confirmar("¿Marcar este turno como ausente?")) sobreActivo("MARCAR_AUSENTE")
        break
      case "derivar": setDerivando(true); break
    }
  })

  if (!snapshot) {
    return <main className="p-10 text-lg">Conectando…</main>
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-2">
      <header className="lg:col-span-2 flex items-center justify-between">
        <h1 className="font-titulo text-2xl font-semibold">{snapshot.boxNombre}</h1>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            disabled={activo?.estado === "atendiendo"}
            title={
              activo?.estado === "atendiendo"
                ? "Finalizá o derivá el turno en curso antes de salir"
                : undefined
            }
            className="rounded-xl border-2 border-gris-70 px-4 py-2 text-sm font-semibold disabled:text-gris-80"
          >
            Cerrar sesión
          </button>
        </form>
      </header>

      {!conectado && (
        <p role="alert" className="lg:col-span-2 rounded-xl bg-osp px-4 py-3 text-white">
          Sin conexión con el servidor. Las acciones están deshabilitadas.
        </p>
      )}

      {aviso && (
        <p role="alert" className="lg:col-span-2 rounded-xl bg-osp px-4 py-3 text-white">
          {aviso}
        </p>
      )}

      <TurnoActivo
        turno={activo}
        inicioAtencion={inicioAtencion}
        hayCola={snapshot.cola.length > 0}
        ocupado={ocupado || !conectado}
        onLlamarSiguiente={llamarSiguiente}
        onRellamar={() => sobreActivo("RELLAMAR_TURNO")}
        onAusente={() => {
          if (window.confirm("¿Marcar este turno como ausente?")) sobreActivo("MARCAR_AUSENTE")
        }}
        onIniciar={() => sobreActivo("INICIAR_ATENCION")}
        onFinalizar={() => sobreActivo("FINALIZAR_ATENCION")}
        onDerivar={() => setDerivando(true)}
      />

      <div className="flex flex-col gap-6">
        <ColaBox snapshot={snapshot} />
        <ListaAusentes
          ausentes={snapshot.ausentes}
          deshabilitado={ocupado || !conectado || activo !== null}
          onLlamar={(turnoId) => void comando("LLAMAR_TURNO", { turnoId })}
        />
      </div>

      {derivando && activo && (
        <DialogoDerivar
          tramiteActualId={activo.tramiteId}
          onCerrar={() => setDerivando(false)}
          onConfirmar={async (tramiteDestinoId) => {
            setDerivando(false)
            await comando("DERIVAR_TURNO", { turnoId: activo.id, tramiteDestinoId })
          }}
        />
      )}
    </main>
  )
}
