import { DEPARTAMENTOS } from "@/lib/types"
import { Turno } from "@/lib/types"
import TurnoCard from "./TurnoCard"

export default function TurnoList({ 
  turnos, 
  departamento 
}: { 
  turnos: Turno[], 
  departamento: typeof DEPARTAMENTOS[keyof typeof DEPARTAMENTOS] 
}) {
   console.log('Turnos recibidos en TurnoList:', turnos)
  if (turnos.length === 0) {
    return (
      <div className="text-center bg-white/10 backdrop-blur-sm rounded-3xl p-12 border border-white/20">
        <div className="text-6xl mb-6">📋</div>
        <h2 className="text-3xl font-bold mb-4">No hay turnos generados</h2>
        <p className="text-xl text-blue-200">
          Los turnos de {departamento.nombre} aparecerán aquí cuando los afiliados los soliciten
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {Object.entries(departamento.servicios).map(([servKey, servicio]) => {
        const turnosServicio = turnos.filter(t => t.servicio === servKey)
        if (turnosServicio.length === 0) return null
        
        return (
          <div key={servKey} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                {servicio.prefijo}
              </span>
              {servicio.nombre}
            </h3>
            
            <div className="grid grid-cols-4 gap-2">
              {turnosServicio.map(turno => (
                <TurnoCard key={turno.id} turno={turno} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}