"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import type { TurnoPanel } from "@/server/snapshot"

function Cronometro({ desde }: { desde: number }) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])

  const s = Math.floor((ahora - desde) / 1000)
  return (
    <p className="font-mono text-2xl tabular-nums">
      {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </p>
  )
}

// Punto pulsante que acompaña la etiqueta de estado.
function PuntoEstado({ color }: { color: "amber" | "green" }) {
  const reduce = useReducedMotion()
  const base = color === "amber" ? "bg-amber-400" : "bg-green-500"
  return (
    <motion.span
      className={`inline-block h-2.5 w-2.5 rounded-full ${base}`}
      animate={
        reduce
          ? {}
          : color === "amber"
          ? { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }
          : { scale: 1, opacity: 1 }
      }
      transition={
        color === "amber"
          ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
          : { type: "spring", stiffness: 400, damping: 25 }
      }
    />
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
  const reduce = useReducedMotion()

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

  const llamado = turno.estado === "llamado"
  const atendiendo = turno.estado === "atendiendo"

  return (
    <motion.section
      // Borde izquierdo de color cambia con el estado — refuerzo periférico
      // que no depende solo del color del número (accesibilidad).
      animate={
        llamado
          ? { borderColor: "#fbbf24" /* amber-400 */, backgroundColor: "#fffbeb" /* amber-50 */ }
          : { borderColor: "#22c55e" /* green-500 */, backgroundColor: "#f0fdf4" /* green-50 */ }
      }
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ borderLeftWidth: 4 }}
      className="flex flex-col items-center rounded-2xl bg-white p-10"
    >
      {/* Etiqueta de estado con punto indicador */}
      <div className="flex items-center gap-2">
        <PuntoEstado color={llamado ? "amber" : "green"} />
        <p className="text-sm font-semibold uppercase tracking-wide">
          {atendiendo ? "Atendiendo" : "Llamado"}
        </p>
      </div>

      {/* Número: late en "llamado", se asienta con spring en "atendiendo" */}
      <motion.p
        key={turno.id}
        data-testid="numero-activo"
        className="font-titulo text-8xl font-bold"
        animate={
          reduce
            ? { color: llamado ? "#d31d16" : "#166534" }
            : llamado
            ? {
                scale: [1, 1.04, 1],
                color: "#d31d16", // osp / rojo institucional
              }
            : {
                scale: 1,
                color: "#166534", // green-800
              }
        }
        transition={
          llamado
            ? {
                scale: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
                color: { duration: 0.3 },
              }
            : {
                scale: { type: "spring", stiffness: 300, damping: 18 },
                color: { duration: 0.3 },
              }
        }
      >
        {turno.numero}
      </motion.p>

      {turno.nombreAfiliado && (
        <p className="mt-2 text-2xl">{turno.nombreAfiliado}</p>
      )}
      <p className="text-lg">{turno.tramiteNombre}</p>

      {/* Cronometro aparece con slide-up al pasar a "atendiendo" */}
      <AnimatePresence>
        {atendiendo && inicioAtencion && (
          <motion.div
            key="cronometro"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-4"
          >
            <Cronometro desde={inicioAtencion} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {llamado ? (
          <>
            <button
              type="button"
              onClick={onIniciar}
              disabled={ocupado}
              className={principal}
              data-testid="iniciar"
            >
              Iniciar atención
            </button>
            <button
              type="button"
              onClick={onRellamar}
              disabled={ocupado}
              className={secundario}
            >
              Rellamar
            </button>
            <button
              type="button"
              onClick={onAusente}
              disabled={ocupado}
              className={secundario}
            >
              Marcar ausente
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onFinalizar}
            disabled={ocupado}
            className={principal}
            data-testid="finalizar"
          >
            Finalizar
          </button>
        )}
        <button
          type="button"
          onClick={onDerivar}
          disabled={ocupado}
          className={secundario}
        >
          Derivar
        </button>
      </div>
    </motion.section>
  )
}
