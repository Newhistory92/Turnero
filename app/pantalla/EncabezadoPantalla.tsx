"use client"

import { useEffect, useState } from "react"

function Reloj() {
  const [hora, setHora] = useState("")

  useEffect(() => {
    const tick = () =>
      setHora(
        new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      )
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [])

  // tabular-nums: sin esto el ancho del 1 difiere del 8 y el reloj se corre
  // unos pixeles a cada cambio de minuto. En una pantalla fija se nota.
  return <span className="text-[1.6vw] tabular-nums text-white">{hora}</span>
}

export function EncabezadoPantalla({
  ala,
  conectado,
}: {
  ala: string
  conectado: boolean
}) {
  return (
    <header className="flex items-center justify-between border-b border-white/15 px-[2vw] py-[1vh]">
      {/* Placa blanca: el logo es un lockup con tipografia negra, hecho para
          fondo claro. Se le da fondo propio en vez de recolorearlo. */}
      <div className="rounded-lg bg-white px-[1vw] py-[0.6vh]">
        <img src="/OSP_Gobierno.webp" alt="Obra Social Provincia" className="h-[4vh]" />
      </div>

      <h1 className="text-[1.5vw] tracking-[0.14em] text-white">
        ALA {ala.toUpperCase()}
      </h1>

      <div className="flex items-center gap-[1.2vw]">
        {/* Punto y texto: el estado no se comunica solo por color, porque nadie
            puede acercarse a inspeccionar una TV mal calibrada. */}
        <span className="flex items-center gap-[0.4vw] text-[0.9vw] text-white">
          <span
            aria-hidden
            className={`inline-block h-[0.7vw] w-[0.7vw] rounded-full ${
              conectado ? "bg-green-400" : "bg-amber-400"
            }`}
          />
          {conectado ? "En línea" : "Sin conexión"}
        </span>
        <Reloj />
      </div>
    </header>
  )
}
