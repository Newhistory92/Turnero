import { Turno } from "@/lib/types"
import { SERVICIOS } from "@/lib/types"

export default function CurrentTurnoBanner({ turno }: { turno: Turno }) {
  return (
    <div className="mb-8 bg-red-500/20 backdrop-blur-sm rounded-3xl p-8 border-2 border-red-400/50 animate-pulse">
      <div className="text-center">
        <p className="text-xl mb-2 text-red-200">🔊 TURNO LLAMADO</p>
        <div className="text-6xl font-bold mb-4 text-red-300">{turno.numero}</div>
        <div className="text-2xl text-red-200 mb-2">
          {SERVICIOS[turno.servicio].nombre}
        </div>
        {turno.boxAsignado && (
          <div className="text-xl text-red-100 mb-2">📍 {turno.boxAsignado}</div>
        )}
        <div className="text-lg text-red-200">
          {turno.departamento}
        </div>
      </div>
    </div>
  )
}