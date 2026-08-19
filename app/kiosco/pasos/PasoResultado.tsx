"use client"

import { useEffect, useState } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { motion } from "framer-motion"
import { Clock, Printer } from "lucide-react"
import { BandaDestino } from "../BandaDestino"
import { Ticket, ESTILOS_TICKET } from "../imprimir/Ticket"
import { usarImpresion } from "../imprimir/usarImpresion"
import type { TurnoEmitido } from "../Wizard"

const SEGUNDOS_EN_PANTALLA = 15

export function PasoResultado({
  turno,
  onTerminar,
}: {
  turno: TurnoEmitido
  onTerminar: () => void
}) {
  const { imprimir } = usarImpresion()
  const [restante, setRestante] = useState(SEGUNDOS_EN_PANTALLA)

  useEffect(() => {
    imprimir(renderToStaticMarkup(<Ticket turno={turno} />), ESTILOS_TICKET)
  }, [turno, imprimir])

  useEffect(() => {
    const i = setInterval(() => setRestante((s) => s - 1), 1000)
    const t = setTimeout(onTerminar, SEGUNDOS_EN_PANTALLA * 1000)
    return () => {
      clearInterval(i)
      clearTimeout(t)
    }
  }, [onTerminar])

  return (
    <div className="grid h-full grid-cols-2">
      <section className="flex flex-col items-center justify-center">
        <p className="text-k-sub">Su número de turno</p>
        <p className="text-k-turno font-titulo text-osp" data-testid="numero-turno">
          {turno.numero}
        </p>
        <p className="mt-8 text-k-titulo">{turno.nombreODni}</p>
        <p className="text-k-sub">{turno.tramite}</p>
      </section>

      <section className="flex flex-col justify-center gap-10 px-16">
        <BandaDestino
          ala={turno.destino.ala}
          piso={turno.destino.piso}
          area={turno.tramite}
        />

        {/* Saco el turno antes de que abriera: el ticket ya esta impreso y no
            dice el horario, asi que el aviso tiene que llegarle aca. */}
        {turno.avisoHorario && (
          <div className="flex flex-col items-stretch gap-2" data-testid="aviso-horario">
            {/* Flecha rebotante que senala el cartel para que no pase desapercibido */}
            <motion.div
              className="flex justify-center"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-osp">
                <path
                  d="M16 4 L16 24 M8 16 L16 24 L24 16"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>

            <motion.div
              className="flex items-start gap-4 rounded-2xl border-2 border-osp bg-white p-6"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.15 }}
            >
              <Clock className="h-10 w-10 shrink-0 text-osp" aria-hidden />
              <p className="text-k-sub">
                Todavía no comenzó la atención. Lo atienden de{" "}
                <strong>
                  {turno.avisoHorario.desde} a {turno.avisoHorario.hasta}
                </strong>
                . Conserve su ticket y aguarde.
              </p>
            </motion.div>
          </div>
        )}

        <hr className="border-gris-70" />

        <p className="flex items-center gap-4 text-k-sub">
          <Printer className="h-10 w-10 text-gris-80" aria-hidden />
          Imprimiendo su ticket
        </p>

        <p className="text-k-sub">
          Si no salió el ticket, anote su número: <strong>{turno.numero}</strong>
        </p>

        {/* El plan pedia text-gris-80 aca, pero la regla 4 lo prohibe para
            texto (4.4:1, no llega a AA). Queda en el color de cuerpo. */}
        <p className="text-k-sub" aria-live="off">
          Vuelve al inicio en {restante} s
        </p>
      </section>
    </div>
  )
}
