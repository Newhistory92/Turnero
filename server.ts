import { createServer } from "http"
import { Server } from "socket.io"
import next from "next"
import { supabase } from "./lib/supabase"

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Prefijos por servicio
const PREFIJOS: Record<string, string> = {
  auditoria: "A",
  planes: "P",
  social: "S",
  personalizada: "T",
  emision_carnet: "C",
  atencion_personalizada_afiliaciones: "AP",
  control_aportes: "CA",
  inicio_expediente: "E",
}

async function loadStateFromSupabase() {
  const [{ data: turnos }, { data: contadoresRows }, { data: registros }] =
    await Promise.all([
      supabase.from("turnos").select("*").order("timestamp", { ascending: true }),
      supabase.from("contadores").select("*"),
      supabase
        .from("registros_atencion")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(100),
    ])

  const contadores: Record<string, number> = {}
  for (const row of contadoresRows ?? []) {
    contadores[row.servicio] = row.valor
  }

  return {
    turnos: (turnos ?? []).map((t) => ({
      id: t.id,
      numero: t.numero,
      servicio: t.servicio,
      departamento: t.departamento,
      timestamp: t.timestamp,
      estado: t.estado,
      boxAsignado: t.box_asignado,
      tiempoLlamado: t.tiempo_llamado,
      tiempoAtencion: t.tiempo_atencion,
    })),
    turnoActual:
      (turnos ?? [])
        .filter((t) => t.estado === "llamado")
        .map((t) => ({
          id: t.id,
          numero: t.numero,
          servicio: t.servicio,
          departamento: t.departamento,
          timestamp: t.timestamp,
          estado: t.estado,
          boxAsignado: t.box_asignado,
          tiempoLlamado: t.tiempo_llamado,
          tiempoAtencion: t.tiempo_atencion,
        }))[0] ?? null,
    contadores,
    registrosAtencion: (registros ?? []).map((r) => ({
      id: r.id,
      numeroTurno: r.numero_turno,
      servicio: r.servicio,
      departamento: r.departamento,
      boxAsignado: r.box_asignado,
      empleado: r.empleado_id ?? "",
      tiempoAtencion: r.tiempo_atencion,
      fecha: r.fecha,
    })),
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res))

  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  })

  let supabaseConnected = false

  async function checkSupabase() {
    try {
      const { error } = await supabase
        .from("contadores")
        .select("servicio")
        .limit(1)
      supabaseConnected = !error
    } catch {
      supabaseConnected = false
    }
    console.log(
      `🗄️  Supabase: ${supabaseConnected ? "✅ conectado" : "❌ desconectado"}`
    )
    io.emit("SUPABASE_STATUS", { connected: supabaseConnected })
  }

  io.on("connection", async (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`)

    socket.emit("SUPABASE_STATUS", { connected: supabaseConnected })

    try {
      const state = await loadStateFromSupabase()
      socket.emit("STATE_UPDATE", { state })
    } catch (err) {
      console.error("Error cargando estado inicial:", err)
    }

    socket.on("GENERAR_TURNO", async ({ servicio, departamento }) => {
      try {
        const { data: contador } = await supabase
          .from("contadores")
          .select("valor")
          .eq("servicio", servicio)
          .single()

        const nuevoValor = (contador?.valor ?? 0) + 1
        const prefijo = PREFIJOS[servicio] ?? "X"
        const numero = `${prefijo}${nuevoValor.toString().padStart(2, "0")}`
        const id = `${servicio}-${nuevoValor}`

        await supabase.from("turnos").insert({
          id,
          numero,
          servicio,
          departamento,
          timestamp: new Date().toISOString(),
          estado: "esperando",
        })

        await supabase
          .from("contadores")
          .update({ valor: nuevoValor })
          .eq("servicio", servicio)

        const state = await loadStateFromSupabase()
        io.emit("STATE_UPDATE", { state })
      } catch (err) {
        console.error("Error generando turno:", err)
      }
    })

    socket.on("LLAMAR_TURNO", async ({ turnoId, boxAsignado }) => {
      try {
        await supabase
          .from("turnos")
          .update({
            estado: "llamado",
            box_asignado: boxAsignado,
            tiempo_llamado: new Date().toISOString(),
          })
          .eq("id", turnoId)

        const state = await loadStateFromSupabase()
        io.emit("STATE_UPDATE", { state })
      } catch (err) {
        console.error("Error llamando turno:", err)
      }
    })

    socket.on("FINALIZAR_ATENCION", async ({ turnoId, tiempoAtencion }) => {
      try {
        await supabase
          .from("turnos")
          .update({ estado: "finalizado", tiempo_atencion: tiempoAtencion })
          .eq("id", turnoId)

        const state = await loadStateFromSupabase()
        io.emit("STATE_UPDATE", { state })
      } catch (err) {
        console.error("Error finalizando atención:", err)
      }
    })

    socket.on("REGISTRAR_ATENCION", async ({ registro }) => {
      try {
        await supabase.from("registros_atencion").insert({
          numero_turno: registro.numeroTurno,
          servicio: registro.servicio,
          departamento: registro.departamento,
          box_asignado: registro.boxAsignado,
          empleado_id: registro.empleado || null,
          tiempo_atencion: registro.tiempoAtencion,
          fecha: registro.fecha ?? new Date().toISOString(),
        })

        const state = await loadStateFromSupabase()
        io.emit("STATE_UPDATE", { state })
      } catch (err) {
        console.error("Error registrando atención:", err)
      }
    })

    socket.on("disconnect", () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`)
    })
  })

  checkSupabase()
  setInterval(checkSupabase, 30_000)

  httpServer.listen(port, () => {
    console.log(`🚀 Servidor listo en http://${hostname}:${port}`)
  })
})
