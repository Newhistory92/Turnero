import { createServer } from "http"
import { Server } from "socket.io"
import next from "next"
import { montarTurnero } from "./server/index"

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME ?? "localhost"
const port = Number(process.env.PORT ?? 3000)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res))
  const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } })

  montarTurnero(io)

  httpServer.listen(port, () => {
    console.log(`Servidor listo en http://${hostname}:${port}`)
  })
})
