"use client"

import { useEffect, useState } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Printer } from "lucide-react"
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
