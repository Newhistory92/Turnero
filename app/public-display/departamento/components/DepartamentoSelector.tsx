"use client"

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Monitor, FileText, Building2, WifiOff, Wifi } from "lucide-react"
const ClockDisplay = dynamic(() => import('./ClockDisplay'), { ssr: false })
import {DEPARTAMENTOS } from "@/lib/types"
import dynamic from "next/dynamic"
import { useSocket } from "@/lib/turno-context"

const iconMapDepartamentos = {
  auditoria_medica: FileText,
  afiliaciones: Building2,
}

const colorMapDepartamentos = {
  auditoria_medica: "from-blue-500 to-blue-700",
  afiliaciones: "from-green-500 to-green-700",
}

export default function DepartamentoSelector({ onSelect }: { onSelect: (depto: keyof typeof DEPARTAMENTOS) => void }) {
  const { state, isConnected } = useSocket()

  return (
    <>
      <div className="bg-black/20 p-6 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Monitor className="w-8 h-8" />
              <h1 className="text-2xl font-bold">Sistema de Turnos</h1>
              <div className="flex items-center gap-2 ml-4">
                {isConnected ? (
                  <>
                    <Wifi className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 text-sm">En línea</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5 text-red-400" />
                    <span className="text-red-400 text-sm">Sin conexión</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-lg">
              <ClockDisplay/>
            </div>
          </div>
        </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Seleccionar Departamento</h2>
            <p className="text-xl text-blue-200">Elija el departamento para visualizar sus turnos</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Object.entries(DEPARTAMENTOS).map(([key, depto]) => {
              const Icon = iconMapDepartamentos[key as keyof typeof iconMapDepartamentos]
              const gradientClass = colorMapDepartamentos[key as keyof typeof colorMapDepartamentos]
              

              return (
                <Card
                  key={key}
                  className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 transition-all cursor-pointer"
                  onClick={() => onSelect(key as keyof typeof DEPARTAMENTOS)}
                >
                  <CardHeader className="text-center pb-4">
                    <div className={`mx-auto w-24 h-24 bg-gradient-to-br ${gradientClass} rounded-full flex items-center justify-center mb-6`}>
                      <Icon className="w-12 h-12 text-white" />
                    </div>
                    <CardTitle className="text-2xl text-white">{depto.nombre}</CardTitle>
                    <CardDescription className="text-blue-200">{depto.descripcion}</CardDescription>
                  </CardHeader>
                  <CardContent>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}