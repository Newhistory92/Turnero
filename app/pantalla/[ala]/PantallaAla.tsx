"use client"

import { usarSocketPantalla } from "../usarSocketPantalla"
import { usarCampanilla } from "../usarCampanilla"
import { EncabezadoPantalla } from "../EncabezadoPantalla"
import { LlamadoActual } from "../LlamadoActual"
import { UltimosLlamados } from "../UltimosLlamados"

export function PantallaAla({ ala }: { ala: string }) {
  const { snapshot, conectado } = usarSocketPantalla(ala)
  const { bloqueado, desbloquear } = usarCampanilla(
    snapshot === null ? undefined : (snapshot.actual?.eventoId ?? null)
  )

  return (
    <main
      onClick={bloqueado ? desbloquear : undefined}
      className="grid h-dvh grid-rows-[auto_1fr] bg-[linear-gradient(150deg,#101c3d_0%,#1c2f61_55%,#24407e_100%)]"
    >
      <EncabezadoPantalla ala={ala} conectado={conectado} />

      <div className="grid grid-cols-[1.9fr_1fr] overflow-hidden">
        <LlamadoActual llamado={snapshot?.actual ?? null} />
        <UltimosLlamados llamados={snapshot?.ultimos ?? []} />
      </div>

      {/* Una TV lanzada sin --autoplay-policy=no-user-gesture-required queda
          muda. Esto hace que se note y se pueda arreglar tocando la pantalla. */}
      {bloqueado && (
        <p className="absolute bottom-[2vh] left-1/2 -translate-x-1/2 rounded-lg bg-white/90 px-[1.5vw] py-[0.8vh] text-[1vw] text-[#101c3d]">
          Tocar la pantalla para activar el sonido
        </p>
      )}
    </main>
  )
}
