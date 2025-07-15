"use client"

import type React from "react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { Turno, RegistroAtencion } from "./types"

interface TurnoState {
  turnos: Turno[]
  turnoActual: Turno | null
  contadores: Record<string, number>
  registrosAtencion: RegistroAtencion[]
}

interface SocketContextType {
  socket: WebSocket | null
  isConnected: boolean
  state: TurnoState
  // Acciones que envían comandos al servidor
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
  state: initialState,
  generarTurno: () => {},
  llamarTurno: () => {},
  finalizarAtencion: () => {},
  registrarAtencion: () => {},
})

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TurnoState>(initialState)
  const socketRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cargar estado desde localStorage solo como fallback inicial
  useEffect(() => {
    const savedState = localStorage.getItem("turno-system-state")
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState)
        setState(parsedState)
      } catch (error) {
        console.error("Error loading saved state:", error)
      }
    }
  }, [])

  // Guardar estado en localStorage como backup
  useEffect(() => {
    localStorage.setItem("turno-system-state", JSON.stringify(state))
  }, [state])

  const connectSocket = () => {
    try {
    

      socketRef.current = new WebSocket("ws://10.25.1.77:3001")

      socketRef.current.onopen = () => {
        console.log("✅ WebSocket conectado al servidor Node.js")
        setIsConnected(true)

        // Solicitar estado actual al servidor
        sendCommand("GET_STATE", {})

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
      }

      socketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log("📨 Estado actualizado desde servidor:", message)

          // El servidor envía el estado completo, no acciones
          if (message.type === "STATE_UPDATE") {
            setState(message.data.state)
          }
        } catch (error) {
          console.error("Error procesando mensaje WebSocket:", error)
        }
      }

      socketRef.current.onclose = (event) => {
        console.log("❌ WebSocket desconectado:", event.code, event.reason)
        setIsConnected(false)

        // Reconectar automáticamente después de 3 segundos
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("🔄 Intentando reconectar...")
          connectSocket()
        }, 3000)
      }

      socketRef.current.onerror = (error) => {
        console.error("❌ Error en WebSocket:", error)
        setIsConnected(false)
      }
    } catch (error) {
      console.error("Error creando WebSocket:", error)
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSocket()
      }, 5000)
    }
  }

  useEffect(() => {
    connectSocket()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [])

  // Función helper para enviar comandos al servidor
  const sendCommand = (type: string, data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const command = {
        type,
        data,
        timestamp: Date.now(),
      }
      socketRef.current.send(JSON.stringify(command))
      console.log("📤 Comando enviado al servidor:", command)
    } else {
      console.warn("⚠️ WebSocket no está conectado, no se puede enviar comando")
    }
  }

  // Acciones que envían comandos al servidor (sin lógica local)
  const generarTurno = (servicio: string, departamento: string) => {
    sendCommand("GENERAR_TURNO", { servicio, departamento })
  }

  const llamarTurno = (turnoId: string, boxAsignado: string) => {
    sendCommand("LLAMAR_TURNO", { turnoId, boxAsignado })
  }

  const finalizarAtencion = (turnoId: string, tiempoAtencion: number) => {
    sendCommand("FINALIZAR_ATENCION", { turnoId, tiempoAtencion })
  }

  const registrarAtencion = (registro: RegistroAtencion) => {
    sendCommand("REGISTRAR_ATENCION", { registro })
  }

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
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

// Mantener compatibilidad con useTurno
export const useTurno = () => {
  const { state } = useSocket()
  return {
    state,
    dispatch: () => {}, // Ya no se usa, todo va por WebSocket
  }
}
