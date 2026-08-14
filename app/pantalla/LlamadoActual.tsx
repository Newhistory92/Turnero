"use client"

import type { LlamadoPantalla } from "@/server/snapshotPantalla"

export function LlamadoActual({ llamado }: { llamado: LlamadoPantalla | null }) {
  if (!llamado) {
    return (
      <section className="flex flex-col items-center justify-center px-[3vw]">
        <img
          src="/OSP_Gobierno.webp"
          alt="Obra Social Provincia"
          className="w-[22vw] rounded-2xl bg-white p-[1.5vw]"
        />
      </section>
    )
  }

  return (
    <section
      // key: remonta el bloque en cada llamado nuevo y reinicia la animacion.
      key={llamado.eventoId}
      className="flex flex-col justify-center px-[3vw] motion-safe:animate-[entrar_400ms_ease-out]"
    >
      <p className="text-[9vw] font-semibold leading-none text-white">{llamado.numero}</p>

      {llamado.identificacion && (
        <p className="mt-[1.2vh] text-[2.4vw] text-white">{llamado.identificacion}</p>
      )}

      <p className="mt-[2vh]">
        <span className="inline-block rounded-xl bg-[#f2564e] px-[2vw] py-[0.8vh] text-[3.2vw] font-semibold text-[#2a0806]">
          {llamado.boxNombre}
        </span>
      </p>

      <style>{`
        @keyframes entrar {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </section>
  )
}
