

"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DEPARTAMENTOS } from "@/lib/types"
import {
  FileText,
  Building2,
  Wifi,
  WifiOff,
} from "lucide-react"
import {  useSocket} from "@/lib/turno-context";
const iconMapDepartamentos = {
  auditoria_medica: FileText,
  afiliaciones: Building2,
}

const colorMapDepartamentos = {
  auditoria_medica: "bg-blue-500 hover:bg-blue-600",
  afiliaciones: "bg-green-500 hover:bg-green-600",
}

export default function KioskPage() {
  const router = useRouter()
 const { isConnected} = useSocket()
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
              <h1 className="text-4xl font-bold text-gray-900">Seleccionar Departamento</h1>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Wifi className="w-6 h-6 text-green-600" />
                    <span className="text-green-600 font-medium">Servidor conectado</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-6 h-6 text-red-600" />
                    <span className="text-red-600 font-medium">Servidor desconectado</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xl text-gray-600">Elija el departamento donde necesita ser atendido</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Object.entries(DEPARTAMENTOS).map(([key, departamento]) => {
              const Icon = iconMapDepartamentos[key as keyof typeof iconMapDepartamentos]
              const colorClass = colorMapDepartamentos[key as keyof typeof colorMapDepartamentos]

              return (
                <Card
                  key={key}
                  className="hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105"
                >
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                      <Icon className="w-12 h-12 text-gray-600" />
                    </div>
                    <CardTitle className="text-2xl">{departamento.nombre}</CardTitle>
                    <CardDescription className="text-base">{departamento.descripcion}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mb-6">
                      <p className="font-medium text-gray-700">Servicios disponibles:</p>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(departamento.servicios).map(([serviceKey, service]) => (
                          <div key={serviceKey} className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                            <span>
                              {service.nombre} ({service.prefijo})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                     <Button
                    onClick={() => router.push(`/turnero/${key}`)}
                    className={`w-full text-white ${colorClass} text-lg py-6`}
                     disabled={!isConnected}
                  >
                    Seleccionar {departamento.nombre}
                  </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="mt-12 text-center">
            <Card className={`border-2 ${isConnected ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <CardContent className="pt-6">
                <p className={`font-medium ${isConnected ? "text-green-800" : "text-red-800"}`}>
                  {isConnected ? "✅ Servidor Node.js conectado" : "❌ Servidor Node.js desconectado"}
                </p>
                <ul className={`mt-2 space-y-1 ${isConnected ? "text-green-700" : "text-red-700"}`}>
                  <li>• {isConnected ? "Los turnos se procesan en tiempo real" : "Esperando conexión al servidor"}</li>
                  <li>
                    • {isConnected ? "Todas las pantallas están sincronizadas" : "Las pantallas no están sincronizadas"}
                  </li>
                  {!isConnected && <li>• Reintentando conexión automáticamente...</li>}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
}

