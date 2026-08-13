import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createServer, type Server as HttpServer } from "http"
import { Server as IoServer } from "socket.io"
import { io as cliente, type Socket } from "socket.io-client"
import { montarTurnero } from "@/server/index"
import { prisma } from "@/lib/db"
import { firmarCookie, NOMBRE_COOKIE } from "@/lib/auth/sesion"

let http: HttpServer
let puerto: number
let sur: Socket
let norte: Socket
let sesionId: string
let empleadoId: string

function conectar(cookie?: string): Promise<Socket> {
  return new Promise((resolve) => {
    const opts = cookie
      ? { transports: ["websocket"] as const, extraHeaders: { cookie } }
      : { transports: ["websocket"] as const }
    const s = cliente(`http://localhost:${puerto}`, opts)
    s.on("connect", () => resolve(s))
  })
}

function unirse(s: Socket, room: string): Promise<void> {
  return new Promise((resolve) => s.emit("SUSCRIBIR", { room }, () => resolve()))
}

beforeAll(async () => {
  // Limpiar posibles restos de ejecuciones anteriores
  const existente = await prisma.empleado.findUnique({ where: { dniInstitucional: "99TEST001" } })
  if (existente) {
    await prisma.turnoEvento.deleteMany({ where: { empleadoId: existente.id } })
    await prisma.sesionOperador.deleteMany({ where: { empleadoId: existente.id } })
    await prisma.empleadoBox.deleteMany({ where: { empleadoId: existente.id } })
    await prisma.empleado.deleteMany({ where: { id: existente.id } })
  }

  // Encontrar el box de "Prácticas Médicas" (trámite Norte)
  const tramite = await prisma.tramite.findFirstOrThrow({
    where: { nombre: "Prácticas Médicas" },
    include: { boxes: true },
  })
  const boxId = tramite.boxes[0].boxId

  // Crear empleado de prueba y asignarlo al box
  const emp = await prisma.empleado.create({
    data: { dniInstitucional: "99TEST001", nombre: "Test, Operador", rol: "operador" },
  })
  empleadoId = emp.id
  await prisma.empleadoBox.create({ data: { empleadoId: emp.id, boxId } })

  // Crear sesión directamente en la BD (sin pasar por abrirSesion para evitar conflictos)
  const sesion = await prisma.sesionOperador.create({
    data: { empleadoId: emp.id, boxId },
  })
  sesionId = sesion.id

  // Levantar el servidor con el socket
  http = createServer()
  const io = new IoServer(http)
  montarTurnero(io)
  await new Promise<void>((r) => http.listen(0, r))
  puerto = (http.address() as { port: number }).port

  // Sur solo escucha, no necesita sesión
  sur = await conectar()
  // Norte conecta con la cookie de sesión firmada
  const cookieHeader = `${NOMBRE_COOKIE}=${firmarCookie(sesionId)}`
  norte = await conectar(cookieHeader)

  await unirse(sur, "ala:sur")
  await unirse(norte, "ala:norte")

  // Autenticar norte como operador del box (carga socket.data.sesion en el servidor)
  await new Promise<void>((resolve) => norte.emit("ENTRAR_BOX", {}, () => resolve()))
})

afterAll(async () => {
  sur.close()
  norte.close()
  http.close()
  // Limpiar datos de prueba (respetar el orden de FK)
  await prisma.turnoEvento.deleteMany({ where: { empleadoId } })
  await prisma.sesionOperador.deleteMany({ where: { id: sesionId } })
  await prisma.empleadoBox.deleteMany({ where: { empleadoId } })
  await prisma.empleado.deleteMany({ where: { id: empleadoId } })
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

    const gen = await new Promise<{ ok: boolean; turno: { id: string } }>((resolve) =>
      norte.emit("GENERAR_TURNO", { tramiteId: tramite.id, dni: null, requestId: `aisl-${Date.now()}` }, resolve)
    )
    expect(gen.ok).toBe(true)

    // boxId viene de la sesión en el servidor; el cliente no lo envía
    await new Promise<unknown>((resolve) =>
      norte.emit("LLAMAR_TURNO", { turnoId: gen.turno.id }, resolve)
    )

    expect(await recibioNorte).toBe(true)
    // La asercion que importa es la negativa.
    expect(recibioSur).toBe(false)
  })
})
