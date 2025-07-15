"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {  useSocket} from "@/lib/turno-context";
import { DEPARTAMENTOS} from "@/lib/types"
import { estaFueraDeHorario } from "@/lib/closeTurnero"
import TurnoFueraDeHorario from "./components/TurnoFueraDeHorario"
import SeleccionServicio from "./components/SeleccionServicio"
import {
  CheckCircle,
  FileText,
  Heart,
  Users,
  UserCheck,
  CreditCard,
  UserCog,
  DollarSign,
  FolderOpen,
  Wifi,
  WifiOff,
} from "lucide-react"
import  { printTicket }  from "./components/Ticket Printer"

const iconMapServicios = {
  auditoria: FileText,
  planes: Heart,
  social: Users,
  personalizada: UserCheck,
  emision_carnet: CreditCard,
  atencion_personalizada_afiliaciones: UserCog,
  control_aportes: DollarSign,
  inicio_expediente: FolderOpen,
}


const colorMapServicios = {
  auditoria: "bg-blue-500 hover:bg-blue-600",
  planes: "bg-green-500 hover:bg-green-600",
  social: "bg-purple-500 hover:bg-purple-600",
  personalizada: "bg-orange-500 hover:bg-orange-600",
  emision_carnet: "bg-emerald-500 hover:bg-emerald-600",
  atencion_personalizada_afiliaciones: "bg-teal-500 hover:bg-teal-600",
  control_aportes: "bg-indigo-500 hover:bg-indigo-600",
  inicio_expediente: "bg-rose-500 hover:bg-rose-600",
}

export default function DepartamentoPage() {
  const { departamento: departamentoParam } = useParams()
  const router = useRouter()
  const { state, isConnected, generarTurno } = useSocket()
  const [showSuccess, setShowSuccess] = useState(false)
  const [fueraDeHorario, setFueraDeHorario] = useState(false)
  const departamentoKey = departamentoParam as keyof typeof DEPARTAMENTOS
  const departamento = DEPARTAMENTOS[departamentoKey]
  const horaApertura = departamento?.horaApertura || ""
  const horaCierre = departamento?.horaCierre || ""
 const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState<keyof typeof DEPARTAMENTOS | null>(null)
  const [turnoGenerado, setTurnoGenerado] = useState<string | null>(null)


  const handleGenerarTurno = (servicio: string, departamento: keyof typeof DEPARTAMENTOS) => {
    // Solo enviar comando al servidor - no calcular localmente
    generarTurno(servicio, departamento)

    // Mostrar número estimado (será corregido por el servidor)
    const contador = state.contadores[servicio] || 0
    const prefijo =
      DEPARTAMENTOS[departamento].servicios[servicio as keyof (typeof DEPARTAMENTOS)[typeof departamento]["servicios"]]
        .prefijo
    const numero = `${prefijo}${(contador + 1).toString().padStart(2, "0")}`

    setTurnoGenerado(numero)
    setShowSuccess(true)

    setTimeout(() => {
      setShowSuccess(false)
      setTurnoGenerado(null)
      setDepartamentoSeleccionado(null)
    }, 5000)
  }


  // ✅ Detectar nuevo turno generado y mostrarlo
  useEffect(() => {
  const turno = turnoGenerado
  if (turno) {
    setShowSuccess(true)

    // Esperá unos milisegundos para que se renderice el cartel ANTES de abrir la ventana de impresión
    const timeout = setTimeout(() => {
      printTicket(turno)
    }, 300) // Idealmente entre 100–300ms

    const redirectTimeout = setTimeout(() => {
      setShowSuccess(false)
      router.push(`/turnero/${departamentoKey}`)
    }, 5000)

    return () => {
      clearTimeout(timeout)
      clearTimeout(redirectTimeout)
    }
  }
}, [turnoGenerado]);


  // ⏰ Verificación de horario
  useEffect(() => {
    if (!departamentoKey || !departamento) return

    const checkHorario = () => {
      if (departamento.horaApertura && departamento.horaCierre) {
        const cerrado = estaFueraDeHorario(departamento.horaApertura, departamento.horaCierre)
        setFueraDeHorario(cerrado)
      }
    }

    checkHorario()
    const interval = setInterval(checkHorario, 15000)
    return () => clearInterval(interval)
  }, [departamentoKey])

  if (!departamento) {
    return <div className="p-10 text-center text-red-500">Departamento no encontrado</div>
  }
  const resetearSeleccion = () => {
    setDepartamentoSeleccionado(null)
    setShowSuccess(false)
    setTurnoGenerado(null)
  }

   return (
    <AnimatePresence mode="wait">
      {showSuccess && turnoGenerado ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.5 }}
          className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col items-center justify-center p-8"
        >
          <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-8">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-800">¡Turno Generado!</CardTitle>
            <div className="flex items-center justify-center gap-2 mt-2">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 text-sm">Conectado al servidor</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 text-sm">Sin conexión al servidor</span>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-6 rounded-lg border-2 border-green-200 mb-6">
              <p className="text-sm text-gray-600 mb-2">Su número de turno es:</p>
              <p className="text-4xl font-bold text-green-600">{turnoGenerado}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="text-blue-800 font-medium">Departamento:</p>
              <p className="text-blue-600">
                {departamentoSeleccionado && DEPARTAMENTOS[departamentoSeleccionado].nombre}
              </p>
            </div>
            <p className="text-gray-600 mb-4">
              Por favor, manténgase atento a la pantalla de llamados y espere a que su turno sea anunciado.
            </p>
            <Button onClick={resetearSeleccion} className="bg-green-600 hover:bg-green-700">
              Generar Otro Turno
            </Button>
          </CardContent>
        </Card>
      </div>
        </motion.div>
      ) : fueraDeHorario ? (
        <motion.div
          key="fuera"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.5 }}
        >
          <TurnoFueraDeHorario
            nombreDepartamento={departamento.nombre}
            horaApertura={horaApertura}
            horaCierre={horaCierre}
          />
        </motion.div>
      ) : (
        <motion.div
          key="servicio"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.5 }}
        >
          <SeleccionServicio
            departamento={departamento}
            departamentoSeleccionado={departamentoKey}
            handleGenerarTurno={handleGenerarTurno}
            setDepartamentoSeleccionado={() => router.push("/turnero")}
            iconMapServicios={iconMapServicios}
            colorMapServicios={colorMapServicios}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}