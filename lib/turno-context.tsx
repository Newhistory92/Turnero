"use client"

import type React from "react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import type { Turno, RegistroAtencion } from "./types"

interface TurnoState {
  turnos: Turno[]
  turnoActual: Turno | null
  contadores: Record<string, number>
  registrosAtencion: RegistroAtencion[]
}

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  supabaseConnected: boolean
  state: TurnoState
  generarTurno: (servicio: string, departamento: string) => void
  llamarTurno: (turnoId: string, boxAsignado: string) => void
  finalizarAtencion: (turnoId: string, tiempoAtencion: number) => void
  registrarAtencion: (registro: RegistroAtencion) => void
}

const initialState: TurnoState = {
  turnos: [],
  turnoActual: null,
  contadores: {
    auditoria: 0,
    planes: 0,
    social: 0,
    personalizada: 0,
    emision_carnet: 0,
    atencion_personalizada_afiliaciones: 0,
    control_aportes: 0,
    inicio_expediente: 0,
  },
  registrosAtencion: [],
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  supabaseConnected: false,
  state: initialState,
  generarTurno: () => {},
  llamarTurno: () => {},
  finalizarAtencion: () => {},
  registrarAtencion: () => {},
})

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TurnoState>(initialState)
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [supabaseConnected, setSupabaseConnected] = useState(false)

  useEffect(() => {
    const socket = io({
      transports: ["websocket"],
      autoConnect: true,
    })

    socketRef.current = socket

    socket.on("connect", () => {
      console.log("✅ Socket.io conectado:", socket.id)
      setIsConnected(true)
    })

    socket.on("disconnect", () => {
      console.log("❌ Socket.io desconectado")
      setIsConnected(false)
    })

    socket.on("SUPABASE_STATUS", ({ connected }: { connected: boolean }) => {
      console.log(`🗄️ Supabase: ${connected ? "conectado" : "desconectado"}`)
      setSupabaseConnected(connected)
    })

    socket.on("STATE_UPDATE", ({ state: newState }: { state: TurnoState }) => {
      console.log("📨 Estado actualizado desde servidor")
      setState(newState)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const sendCommand = (event: string, data: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
    } else {
      console.warn("⚠️ Socket no conectado, no se puede enviar:", event)
    }
  }

  const generarTurno = (servicio: string, departamento: string) =>
    sendCommand("GENERAR_TURNO", { servicio, departamento })

  const llamarTurno = (turnoId: string, boxAsignado: string) =>
    sendCommand("LLAMAR_TURNO", { turnoId, boxAsignado })

  const finalizarAtencion = (turnoId: string, tiempoAtencion: number) =>
    sendCommand("FINALIZAR_ATENCION", { turnoId, tiempoAtencion })

  const registrarAtencion = (registro: RegistroAtencion) =>
    sendCommand("REGISTRAR_ATENCION", { registro })

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        supabaseConnected,
        state,
        generarTurno,
        llamarTurno,
        finalizarAtencion,
        registrarAtencion,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error("useSocket debe ser usado dentro de SocketProvider")
  }
  return context
}

export const useTurno = () => {
  const { state } = useSocket()
  return {
    state,
    dispatch: () => {},
  }
}
