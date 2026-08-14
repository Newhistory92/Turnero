"use client"

import type { LlamadoPantalla } from "@/server/snapshotPantalla"

export function UltimosLlamados({ llamados }: { llamados: LlamadoPantalla[] }) {
  return (
    <aside className="flex flex-col bg-white/[0.06] px-[1.6vw] py-[2vh]">
      {/* Blanca como todo el texto, pero mas chica y con mas tracking: la
          jerarquia se sostiene con tamaño y espaciado, no con color. */}
      <h2 className="text-[0.9vw] tracking-[0.16em] text-white">ANTERIORES</h2>

      <ul className="mt-[1.5vh] flex flex-col">
        {llamados.map((l) => (
          <li
            key={l.eventoId}
            className="flex items-baseline justify-between border-b border-white/10 py-[1.1vh] last:border-b-0"
          >
            <span className="text-[2vw] font-semibold text-white">{l.numero}</span>
            <span className="text-[1.5vw] text-white">{l.boxNombre}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
