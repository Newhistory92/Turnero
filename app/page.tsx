import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {  Monitor, Tablet} from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Sistema de Gestión de Turnos</h1>
          <p className="text-xl text-gray-600">Selecciona la interfaz que necesitas acceder</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer  bg-slate-200 shadow-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Monitor className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle>Pantalla Pública</CardTitle>
              <CardDescription>Visualización en tiempo real de turnos llamados</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/public-display">
                <Button className="w-full bg-green-600 hover:bg-green-700">Ver Pantalla</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-slate-200 shadow-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Tablet className="w-8 h-8 text-purple-600" />
              </div>
              <CardTitle>Turnero</CardTitle>
              <CardDescription>Interfaz para que los afiliados soliciten turnos</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/turnero">
                <Button className="w-full bg-purple-600 hover:bg-purple-700">Solicitar Turno</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
