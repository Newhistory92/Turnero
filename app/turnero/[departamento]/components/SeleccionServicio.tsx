import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {  useSocket} from "@/lib/turno-context";
import type { DEPARTAMENTOS } from "@/lib/types"
import {  Wifi, WifiOff } from "lucide-react";
type ServicioKey = keyof typeof DEPARTAMENTOS[keyof typeof DEPARTAMENTOS]["servicios"]
type DepartamentoKey = keyof typeof DEPARTAMENTOS

export default function SeleccionServicio({
  departamento,
  departamentoSeleccionado,
  handleGenerarTurno,
  iconMapServicios,
  colorMapServicios,
}: {
   departamento: typeof DEPARTAMENTOS[DepartamentoKey]
  departamentoSeleccionado: string
  handleGenerarTurno: (servicio: ServicioKey, departamento: DepartamentoKey) => void
  setDepartamentoSeleccionado: () => void
  iconMapServicios: Record<string, React.ComponentType<any>>
  colorMapServicios: Record<string, string>
}) {
  const {  isConnected} = useSocket()
  return (
   <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">

          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{departamento.nombre}</h1>
            <p className="text-gray-600">{departamento.descripcion}</p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="w-5 h-5 text-green-600" />
                <span className="text-green-600 text-sm">Servidor conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-red-600" />
                <span className="text-red-600 text-sm">Servidor desconectado</span>
              </>
            )}
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Seleccione el servicio que necesita</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(departamento.servicios).map(([key, servicio]) => {
            const Icon = iconMapServicios[key as keyof typeof iconMapServicios]
            const colorClass = colorMapServicios[key as keyof typeof colorMapServicios]

            return (
              <Card
                key={key}
                className="hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105"
              >
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Icon className="w-10 h-10 text-gray-600" />
                  </div>
                  <CardTitle className="text-xl">{servicio.nombre}</CardTitle>
                  <CardDescription className="text-base">{servicio.descripcion}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleGenerarTurno(key, departamentoSeleccionado)}
                    disabled={!isConnected}
                    className={`w-full text-white ${colorClass} text-lg py-6 disabled:opacity-50`}
                  >
                    Solicitar Turno {servicio.prefijo}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mt-8 text-center">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <p className="text-blue-800 font-medium">ℹ️ Información del departamento:</p>
              <p className="text-blue-700 mt-2">
                Está solicitando un turno para <strong>{departamento.nombre}</strong>
              </p>
              <p className="text-blue-600 text-sm mt-1">Diríjase al área correspondiente cuando sea llamado</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


{/* <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{departamento.nombre}</h1>
          <p className="text-gray-600">{departamento.descripcion}</p>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Seleccione el servicio que necesita</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(departamento.servicios).map(([key, servicio]) => {
            const typedKey = key as keyof typeof departamento.servicios
            const Icon = iconMapServicios[typedKey]
            const colorClass = colorMapServicios[typedKey] || "bg-gray-500 hover:bg-gray-600"

            return (
              <Card
                key={key}
                className="hover:shadow-lg  transition-all bg-slate-200 border-slate-300 duration-300 cursor-pointer transform hover:scale-105"
              >
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    {Icon && <Icon className="w-10 h-10 text-gray-600" />}
                  </div>
                  <CardTitle className="text-xl">{servicio.nombre}</CardTitle>
                  <CardDescription className="text-base">{servicio.descripcion}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                     onClick={() => handleGenerarTurno(typedKey, departamentoSeleccionado as DepartamentoKey)}
                    className={`w-full text-white ${colorClass} text-lg py-6`}
                  >
                    Solicitar Turno {servicio.prefijo}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mt-8 text-center">
          <Card className="bg-blue-50 border-blue-200 shadow-xl">
            <CardContent className="pt-6">
              <p className="text-blue-800 font-medium">ℹ️ Información del departamento:</p>
              <p className="text-blue-700 mt-2">
                Está solicitando un turno para <strong>{departamento.nombre}</strong>
              </p>
              <p className="text-blue-600 text-sm mt-1">Diríjase al área correspondiente cuando sea llamado</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div> */}