"use client"

import { useSocket} from "@/lib/turno-context";
import { Button } from "@/components/ui/button"
import { ArrowLeft, Building2, FileText } from "lucide-react"
import CurrentTurnoBanner from "./CurrentTurnoBanner"
import TurnoList from "./TurnoList"
import dynamic from "next/dynamic";
import { DEPARTAMENTOS, Turno } from "@/lib/types"
import { useEffect } from "react";
const  ClockDisplay = dynamic(() => import("./ClockDisplay"), {
  ssr: false,
})
const colorMapDepartamentos = {
  auditoria_medica: "from-blue-500 to-blue-700",
  afiliaciones: "from-green-500 to-green-700",
}

// Definimos los componentes de icono correctamente
const IconComponents = {
  auditoria_medica: FileText,
  afiliaciones: Building2,
} as const

export default function TurnoDisplay({ departamento, onBack }: {  departamento: keyof typeof DEPARTAMENTOS , onBack: () => void }) {
  const { state, isConnected } = useSocket()

  const depto = DEPARTAMENTOS[departamento]
 const gradientClass = colorMapDepartamentos[departamento]
  console.log('📊 Estado completo en TurnoDisplay:', state)
 const turnosDelDepartamento = state.turnos.filter(
    t => t.departamento === departamento
  );
  
  useEffect(() => {
    console.log('📌 [TurnoDisplay] Estado actualizado:', {
      allTurnos: state.turnos,
      deptTurnos: state.turnos.filter(t => t.departamento === departamento),
      dept: departamento
    });
  }, [state, departamento])
  // Obtenemos el componente de icono correcto
  const Icon = IconComponents[departamento]

 
  return (
    <>
      <div className="bg-black/20 p-6 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Button 
            onClick={onBack}
            variant="outline" 
            className="bg-white/10 text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 bg-gradient-to-br ${gradientClass} rounded-full flex items-center justify-center`}>
              {/* Renderizamos el componente Icon correctamente */}
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{depto.nombre}</h1>
              <p className="text-blue-200 text-sm">{depto.descripcion}</p>
            </div>
          </div>   
          <ClockDisplay />
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto">
        {state.turnoActual && state.turnoActual.departamento === departamento && (
          <CurrentTurnoBanner turno={state.turnoActual} />
        )}

        <TurnoList turnos={turnosDelDepartamento} departamento={depto} />
      </div>
    </>
  )
}