import { ArrowUp } from "lucide-react"

interface Props {
  ala: string
  piso: string
  area: string
  compacta?: boolean
}

/**
 * La identidad del ala NO se comunica por color: las impresoras termicas son
 * monocromas. Banda rellena + tipografia grande + flecha, identico en pantalla
 * y en papel, y legible para daltonicos.
 */
export function BandaDestino({ ala, piso, area, compacta = false }: Props) {
  return (
    <div data-testid="banda-destino">
      <div
        className={
          "flex items-center justify-between bg-black text-white " +
          (compacta ? "px-3 py-2 text-[20px]" : "px-8 py-6 text-[44px]")
        }
      >
        <span className="font-titulo font-bold uppercase tracking-wide">Ala {ala}</span>
        <ArrowUp className={compacta ? "h-5 w-5" : "h-10 w-10"} aria-hidden />
      </div>
      <p className={compacta ? "mt-1 text-[16px]" : "mt-4 text-k-titulo"}>{piso}</p>
      <p className={compacta ? "text-[16px]" : "text-k-sub"}>{area}</p>
    </div>
  )
}
