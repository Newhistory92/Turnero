"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { BOXES, SERVICIOS, DEPARTAMENTOS } from "@/lib/types"
import { Phone, MapPin, Timer, Play, Square, Wifi, WifiOff } from "lucide-react"
import {  useSocket} from "@/lib/turno-context";

export default function EmployeePage() {
  const { state, isConnected, llamarTurno, finalizarAtencion: finalizarAtencionSocket, registrarAtencion } = useSocket()
  const [selectedBox, setSelectedBox] = useState<string>("")
  const [currentTurno, setCurrentTurno] = useState<any>(null)
  const [atendiendoTurno, setAtendiendoTurno] = useState(false)
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)
  const [empleado, setEmpleado] = useState<string>("")

  // Temporizador para medir tiempo de atención
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (currentTurno && atendiendoTurno && currentTurno.tiempoAtencionInicio) {
      interval = setInterval(() => {
        const tiempoActual = Date.now()
        const tiempoTranscurridoMs = tiempoActual - currentTurno.tiempoAtencionInicio
        const tiempoMinutos = Math.floor(tiempoTranscurridoMs / 60000)
        setTiempoTranscurrido(tiempoMinutos)

        // Auto-registrar si supera 7 minutos
        if (tiempoMinutos >= 7 && currentTurno.estado !== "atendido") {
          finalizarAtencion(true)
        }
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [currentTurno, atendiendoTurno])

  const boxSeleccionado = BOXES.find((box) => box.id === selectedBox)

  // Obtener turnos pendientes para el servicio del box seleccionado
  const turnosPendientes = state.turnos.filter((turno) => {
    if (!boxSeleccionado) return false
    const servicioBox = boxSeleccionado.servicio
    const servicioTurno = SERVICIOS[turno.servicio].nombre
    return servicioBox === servicioTurno && turno.estado === "esperando"
  })

  const siguienteTurno = turnosPendientes[0]

  // Obtener turno llamado actual para este box
  const turnoLlamado = state.turnos.find((turno) => {
    if (!boxSeleccionado) return false
    const servicioBox = boxSeleccionado.servicio
    const servicioTurno = SERVICIOS[turno.servicio].nombre
    return servicioBox === servicioTurno && turno.estado === "llamado" && turno.boxAsignado === boxSeleccionado.nombre
  })

  const llamarSiguienteTurno = () => {
    if (!siguienteTurno || !boxSeleccionado || !isConnected) return

    // Cambiar esto:
    // emitTurnoUpdate("TURNO_LLAMADO", {
    //   turnoId: siguienteTurno.id,
    //   boxAsignado: boxSeleccionado.nombre,
    // })

    // Por esto:
    llamarTurno(siguienteTurno.id, boxSeleccionado.nombre)
  }

  const iniciarAtencion = () => {
    if (!turnoLlamado) return

    setCurrentTurno({
      ...turnoLlamado,
      tiempoAtencionInicio: Date.now(),
    })
    setAtendiendoTurno(true)
    setTiempoTranscurrido(0)
  }

  const finalizarAtencion = (autoRegistro = false) => {
    if (!currentTurno || !isConnected) return

    const tiempoAtencionMinutos = atendiendoTurno
      ? Math.floor((Date.now() - currentTurno.tiempoAtencionInicio) / 60000)
      : 0

    // Cambiar esto:
    // emitTurnoUpdate("TURNO_FINALIZADO", {
    //   turnoId: currentTurno.id,
    //   tiempoAtencion: tiempoAtencionMinutos,
    // })

    // Por esto:
    finalizarAtencionSocket(currentTurno.id, tiempoAtencionMinutos)

    // Registrar en base de datos solo si supera 7 minutos
    if (tiempoAtencionMinutos >= 7) {
      const registro = {
        id: `reg-${Date.now()}`,
        numeroTurno: currentTurno.numero,
        servicio: SERVICIOS[currentTurno.servicio].nombre,
        departamento: DEPARTAMENTOS[currentTurno.departamento].nombre,
        boxAsignado: currentTurno.boxAsignado,
        empleado: empleado,
        tiempoAtencion: tiempoAtencionMinutos,
        fecha: new Date().toISOString(),
      }

      // Cambiar esto:
      // emitTurnoUpdate("ATENCION_REGISTRADA", {
      //   registro,
      // })

      // Por esto:
      registrarAtencion(registro)
    }

    setCurrentTurno(null)
    setAtendiendoTurno(false)
    setTiempoTranscurrido(0)
  }

  if (!empleado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Iniciar Sesión</CardTitle>
            <CardDescription className="flex items-center gap-2">
              Ingrese su nombre para comenzar
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 text-sm">Servidor conectado</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 text-sm">Servidor desconectado</span>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="text"
              placeholder="Nombre del empleado"
              className="w-full p-3 border rounded-lg"
              value={empleado}
              onChange={(e) => setEmpleado(e.target.value)}
            />
            <Button
              onClick={() => empleado && setEmpleado(empleado)}
              disabled={!empleado || !isConnected}
              className="w-full"
            >
              Iniciar Sesión
            </Button>
            {!isConnected && (
              <p className="text-red-600 text-sm text-center">Esperando conexión al servidor para continuar...</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Panel de Empleado</h1>
            <div className="flex items-center gap-4">
              <p className="text-gray-600">Bienvenido, {empleado}</p>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-600" />
                    <span className="text-green-600 text-sm">En línea</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-600" />
                    <span className="text-red-600 text-sm">Sin conexión</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEmpleado("")} className="bg-white text-gray-700">
            Cerrar Sesión
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Selección de Box */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Seleccionar Box
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedBox} onValueChange={setSelectedBox}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione su box" />
                </SelectTrigger>
                <SelectContent>
                  {BOXES.map((box) => (
                    <SelectItem key={box.id} value={box.id}>
                      {box.nombre} - {box.servicio} ({box.departamento})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {boxSeleccionado && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="font-medium text-blue-900">{boxSeleccionado.nombre}</p>
                  <p className="text-blue-700">{boxSeleccionado.servicio}</p>
                  <p className="text-blue-600 text-sm">{boxSeleccionado.departamento}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Control de Turnos Integrado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Gestión de Turnos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Información de turnos */}
              <div className="space-y-3">
                {/* Siguiente turno disponible */}
                {siguienteTurno && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700">Siguiente turno disponible:</p>
                    <p className="text-xl font-bold text-green-800">{siguienteTurno.numero}</p>
                    <p className="text-green-600 text-sm">{SERVICIOS[siguienteTurno.servicio].nombre}</p>
                  </div>
                )}

                {/* Turno llamado */}
                {turnoLlamado && !atendiendoTurno && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Phone className="w-4 h-4 text-red-600" />
                      <p className="text-sm text-red-700 font-medium">Turno llamado:</p>
                    </div>
                    <p className="text-xl font-bold text-red-800">{turnoLlamado.numero}</p>
                    <p className="text-red-600 text-sm">{SERVICIOS[turnoLlamado.servicio].nombre}</p>
                    <p className="text-red-500 text-xs">{DEPARTAMENTOS[turnoLlamado.departamento].nombre}</p>
                  </div>
                )}

                {/* Turno en atención */}
                {currentTurno && atendiendoTurno && (
                  <div className="p-4 bg-orange-50 rounded-lg border-2 border-orange-300">
                    <div className="flex items-center gap-2 mb-2">
                      <Play className="w-5 h-5 text-orange-600" />
                      <p className="text-sm text-orange-700 font-medium">Atendiendo turno:</p>
                    </div>
                    <p className="text-2xl font-bold text-orange-800">{currentTurno.numero}</p>
                    <p className="text-orange-600">{SERVICIOS[currentTurno.servicio].nombre}</p>
                    <p className="text-orange-500 text-sm">
                      {DEPARTAMENTOS[currentTurno.departamento].nombre} - {currentTurno.boxAsignado}
                    </p>

                    <div className="flex items-center gap-2 mt-3 text-orange-600">
                      <Timer className="w-4 h-4" />
                      <span className="text-sm">Tiempo: {tiempoTranscurrido} minutos</span>
                    </div>

                    {tiempoTranscurrido >= 7 && (
                      <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                        <p className="text-green-700 text-xs">✓ Este turno será registrado automáticamente</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Estado sin turnos */}
                {!siguienteTurno && !turnoLlamado && !currentTurno && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-center">No hay turnos pendientes</p>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="space-y-2">
                {/* Botón Llamar Siguiente Turno */}
                <Button
                  onClick={llamarSiguienteTurno}
                  disabled={!siguienteTurno || !selectedBox || atendiendoTurno || !isConnected}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Llamar Siguiente Turno
                </Button>

                {/* Botón Atender */}
                <Button
                  onClick={iniciarAtencion}
                  disabled={!turnoLlamado || atendiendoTurno}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Atender
                </Button>

                {/* Botón Finalizar Atención */}
                {atendiendoTurno && (
                  <Button
                    onClick={() => finalizarAtencion()}
                    disabled={!isConnected}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Finalizar Atención
                  </Button>
                )}
              </div>

              <div className="text-center">
                <Badge variant="secondary">Turnos en cola: {turnosPendientes.length}</Badge>
              </div>

              {!isConnected && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-red-700 text-sm text-center">
                    ⚠️ Sin conexión al servidor - Las acciones no se sincronizarán
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Estadísticas */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{state.registrosAtencion.length}</p>
                <p className="text-gray-600">Atenciones Registradas</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {state.turnos.filter((t) => t.estado === "atendido").length}
                </p>
                <p className="text-gray-600">Turnos Completados</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {state.turnos.filter((t) => t.estado === "esperando").length}
                </p>
                <p className="text-gray-600">En Espera</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{state.turnos.length}</p>
                <p className="text-gray-600">Total Generados</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
