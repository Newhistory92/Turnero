import { useEffect, useRef } from "react"
import { io, Socket } from "socket.io-client"

export function useSocket(): Socket | null {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
   const socket = io("ws://10.25.1.77:3001", {
  transports: ["websocket"],
  autoConnect: true,
})


    socket.on("connect", () => {
      console.log("✅ Conectado WebSocket LOCAL:", socket.id)
    })

    socket.on("connect_error", (err) => {
      console.error("❌ Error conexión WebSocket LOCAL:", err.message)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [])

  return socketRef.current
}
