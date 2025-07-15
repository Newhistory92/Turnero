import type { NextRequest } from "next/server"

// Almacenamiento en memoria para el estado de turnos
const globalTurnoState = {
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

// Set para mantener todas las conexiones WebSocket activas
const clients = new Set<WebSocket>()

export async function GET(request: NextRequest) {
  const upgradeHeader = request.headers.get("upgrade")

  if (upgradeHeader !== "websocket") {
    return new Response("Expected websocket", { status: 400 })
  }

  // Para Next.js, necesitamos usar un enfoque diferente
  // Retornamos una respuesta que indica que el WebSocket debe manejarse externamente
  return new Response("WebSocket endpoint", {
    status: 101,
    headers: {
      Upgrade: "websocket",
      Connection: "Upgrade",
    },
  })
}

// Función para manejar WebSocket (se ejecutará en el servidor)
export function handleWebSocket(ws: WebSocket) {
  console.log("🔌 Nueva conexión WebSocket establecida")
  clients.add(ws)

  // Enviar estado actual al cliente recién conectado
  ws.send(
    JSON.stringify({
      type: "ESTADO_SINCRONIZADO",
      data: { state: globalTurnoState },
      timestamp: Date.now(),
    }),
  )

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data.toString())
      console.log("📨 Mensaje recibido del cliente:", message)

      // Actualizar estado global según el mensaje
      updateGlobalState(message)

      // Retransmitir mensaje a todos los clientes conectados
      broadcastToAllClients(message)
    } catch (error) {
      console.error("Error procesando mensaje:", error)
    }
  }

  ws.onclose = () => {
    console.log("❌ Conexión WebSocket cerrada")
    clients.delete(ws)
  }

  ws.onerror = (error) => {
    console.error("❌ Error en WebSocket:", error)
    clients.delete(ws)
  }
}

function updateGlobalState(message: any) {
  switch (message.type) {
    case "TURNO_GENERADO":
      const { servicio, departamento } = message.data
      const contador = globalTurnoState.contadores[servicio] + 1

      // Prefijos de servicios
      const prefijos = {
        auditoria: "A",
        planes: "P",
        social: "S",
        personalizada: "T",
        emision_carnet: "C",
        atencion_personalizada_afiliaciones: "AP",
        control_aportes: "CA",
        inicio_expediente: "E",
      }

      const prefijo = prefijos[servicio] || "X"
      const numero = `${prefijo}${contador.toString().padStart(2, "0")}`

      const nuevoTurno = {
        id: `${servicio}-${contador}`,
        numero,
        servicio,
        departamento,
        timestamp: Date.now(),
        estado: "esperando",
      }

      globalTurnoState.turnos.push(nuevoTurno)
      globalTurnoState.contadores[servicio] = contador
      break

    case "TURNO_LLAMADO":
      const turno = globalTurnoState.turnos.find((t) => t.id === message.data.turnoId)
      if (turno) {
        turno.estado = "llamado"
        turno.boxAsignado = message.data.boxAsignado
        turno.tiempoLlamado = Date.now()
        globalTurnoState.turnoActual = turno
      }
      break

    case "TURNO_FINALIZADO":
      const turnoFinalizado = globalTurnoState.turnos.find((t) => t.id === message.data.turnoId)
      if (turnoFinalizado) {
        turnoFinalizado.estado = "atendido"
        turnoFinalizado.tiempoAtencion = message.data.tiempoAtencion
        if (globalTurnoState.turnoActual?.id === message.data.turnoId) {
          globalTurnoState.turnoActual = null
        }
      }
      break

    case "ATENCION_REGISTRADA":
      globalTurnoState.registrosAtencion.push(message.data.registro)
      break
  }
}

function broadcastToAllClients(message: any) {
  const messageStr = JSON.stringify(message)

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr)
      } catch (error) {
        console.error("Error enviando mensaje a cliente:", error)
        clients.delete(client)
      }
    } else {
      clients.delete(client)
    }
  })

  console.log(`📡 Mensaje enviado a ${clients.size} clientes`)
}
