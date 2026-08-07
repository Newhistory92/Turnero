import type { TurnoEmitido } from "../Wizard"
import { BandaDestino } from "../BandaDestino"

export const ESTILOS_TICKET = `
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; width: 80mm; background: #fff; color: #000; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ticket { padding: 4mm; font-family: "Noto Sans", sans-serif; }
  .numero { font-size: 56px; font-weight: 700; text-align: center; margin: 4mm 0; letter-spacing: 2px; }
  .logo { display: block; width: 40mm; margin: 0 auto 3mm; }
  .campo { font-size: 13px; margin-top: 2mm; }
  .codigo { margin-top: 5mm; text-align: center; font-size: 11px; letter-spacing: 3px; }
`

export function Ticket({ turno }: { turno: TurnoEmitido }) {
  return (
    <div className="ticket">
      <img src="/OSP_Gobierno.webp" alt="" className="logo" />
      <div className="numero">{turno.numero}</div>
      <div className="campo">{turno.nombreODni}</div>
      <div className="campo">{turno.tramite}</div>
      <div style={{ marginTop: "3mm" }}>
        <BandaDestino
          ala={turno.destino.ala}
          piso={turno.destino.piso}
          area={turno.tramite}
          compacta
        />
      </div>
      <div className="campo">{turno.hora}</div>
      <div className="codigo">{turno.codigo}</div>
    </div>
  )
}
