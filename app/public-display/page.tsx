"use client"

import { useState } from "react"
import DepartamentoSelector from "./departamento/components/DepartamentoSelector"
import TurnoDisplay from "./departamento/components/TurnoDisplay"
import { DEPARTAMENTOS } from "@/lib/types"



export default function PublicDisplayPage() {
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState<keyof typeof DEPARTAMENTOS | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 text-white">
      {!departamentoSeleccionado ? (
        <DepartamentoSelector onSelect={setDepartamentoSeleccionado} />
      ) : (
        <TurnoDisplay 
          departamento={departamentoSeleccionado} 
          onBack={() => setDepartamentoSeleccionado(null)} 
        />
      )}
    </div>
  )
}