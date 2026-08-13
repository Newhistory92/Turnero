"use client"

import { useEffect, useState } from "react"
import type { TurnoPanel } from "@/server/snapshot"

function Cronometro({ desde }: { desde: number }) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])

  const s = Math.floor((ahora - desde) / 1000)
  return (
    <p className="mt-4 font-mono text-2xl tabular-nums">
      {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </p>
  )
}

export function TurnoActivo({
  turno,
  inicioAtencion,
  onLlamarSiguiente,
  onRellamar,
  onAusente,
  onIniciar,
  onFinalizar,
  onDerivar,
  hayCola,
  ocupado,
}: {
  turno: TurnoPanel | null
  inicioAtencion: number | null
  onLlamarSiguiente: () => void
  onRellamar: () => void
  onAusente: () => void
  onIniciar: () => void
  onFinalizar: () => void
  onDerivar: () => void
  hayCola: boolean
  ocupado: boolean
}) {
  const principal =
    "rounded-2xl bg-gris-principal px-8 py-5 text-xl font-semibold text-white " +
    "disabled:bg-gainsboro disabled:text-gris-80"
  const secundario =
    "rounded-2xl border-2 border-gris-70 bg-white px-6 py-4 text-lg font-semibold " +
    "disabled:text-gris-80"

  if (!turno) {
    return (
      <section className="flex flex-col items-center justify-center rounded-2xl bg-white p-10">
        <p className="text-lg">Sin turno en atención</p>
        <button
          type="button"
          onClick={onLlamarSiguiente}
          disabled={!hayCola || ocupado}
          data-testid="llamar-siguiente"
          className={`mt-6 ${principal}`}
        >
          Llamar siguiente
        </button>
        {!hayCola && <p className="mt-3 text-sm">No hay nadie esperando</p>}
      </section>
    )
  }

  return (
    <section className="flex flex-col items-center rounded-2xl bg-white p-10">
      <p className="text-sm font-semibold uppercase tracking-wide">
        {turno.estado === "atendiendo" ? "Atendiendo" : "Llamado"}
      </p>
      <p className="font-titulo text-8xl font-bold text-osp" data-testid="numero-activo">
        {turno.numero}
      </p>
      {turno.nombreAfiliado && <p className="mt-2 text-2xl">{turno.nombreAfiliado}</p>}
      <p className="text-lg">{turno.tramiteNombre}</p>

      {turno.estado === "atendiendo" && inicioAtencion && <Cronometro desde={inicioAtencion} />}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {turno.estado === "llamado" ? (
          <>
            <button type="button" onClick={onIniciar} disabled={ocupado} className={principal} data-testid="iniciar">
              Iniciar atención
            </button>
            <button type="button" onClick={onRellamar} disabled={ocupado} className={secundario}>
              Rellamar
            </button>
            <button type="button" onClick={onAusente} disabled={ocupado} className={secundario}>
              Marcar ausente
            </button>
          </>
        ) : (
          <button type="button" onClick={onFinalizar} disabled={ocupado} className={principal} data-testid="finalizar">
            Finalizar
          </button>
        )}
        <button type="button" onClick={onDerivar} disabled={ocupado} className={secundario}>
          Derivar
        </button>
      </div>
    </section>
  )
}
