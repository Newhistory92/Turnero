import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createServer, type Server as HttpServer } from "http"
import { Server as IoServer } from "socket.io"
import { io as cliente, type Socket } from "socket.io-client"
import { montarTurnero } from "@/server/index"
import { prisma } from "@/lib/db"

let http: HttpServer
let puerto: number
let sur: Socket
let norte: Socket

function conectar(): Promise<Socket> {
  return new Promise((resolve) => {
    const s = cliente(`http://localhost:${puerto}`, { transports: ["websocket"] })
    s.on("connect", () => resolve(s))
  })
}

function unirse(s: Socket, room: string): Promise<void> {
  return new Promise((resolve) => s.emit("SUSCRIBIR", { room }, () => resolve()))
}

beforeAll(async () => {
  http = createServer()
  const io = new IoServer(http)
  montarTurnero(io)
  await new Promise<void>((r) => http.listen(0, r))
  puerto = (http.address() as any).port
  sur = await conectar()
  norte = await conectar()
  await unirse(sur, "ala:sur")
  await unirse(norte, "ala:norte")
})

afterAll(async () => {
  sur.close()
  norte.close()
  http.close()
})

describe("aislamiento por ala", () => {
  it("un llamado del Norte no llega al cliente del Sur", async () => {
    const tramite = await prisma.tramite.findFirstOrThrow({
      where: { nombre: "Prácticas Médicas" },
      include: { boxes: true, destinoAla: true },
    })
    expect(tramite.destinoAla.nombre).toBe("Norte")

    let recibioSur = false
    sur.on("TURNO_LLAMADO", () => { recibioSur = true })

    const recibioNorte = new Promise<boolean>((resolve) => {
      norte.on("TURNO_LLAMADO", () => resolve(true))
      setTimeout(() => resolve(false), 3000)
    })

    const gen = await new Promise<any>((resolve) =>
      norte.emit("GENERAR_TURNO", { tramiteId: tramite.id, dni: null, requestId: `aisl-${Date.now()}` }, resolve)
    )
    expect(gen.ok).toBe(true)

    await new Promise<any>((resolve) =>
      norte.emit("LLAMAR_TURNO", { turnoId: gen.turno.id, boxId: tramite.boxes[0].boxId }, resolve)
    )

    expect(await recibioNorte).toBe(true)
    // La asercion que importa es la negativa.
    expect(recibioSur).toBe(false)
  })
})
