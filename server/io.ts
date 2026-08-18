import type { Server as IoServer } from "socket.io"

/**
 * io se crea en server.ts y se le pasa por argumento a montarTurnero, asi que
 * una ruta HTTP o un Server Action no tienen forma de alcanzarlo. Este
 * singleton es ese puente, y es lo que permite que una mutacion del panel
 * avise a los kioscos.
 */
let instancia: IoServer | null = null

export function registrarIo(io: IoServer): void {
  instancia = io
}

export function reiniciarIo(): void {
  instancia = null
}

/**
 * No lanza si todavia no hay io: durante next build y en los tests no hay
 * servidor de sockets, y una mutacion correcta no puede fallar por no poder
 * avisar. El aviso acelera la propagacion; la correctitud la sostiene la
 * invalidacion del cache.
 */
export function emitirATodos(evento: string, datos: unknown): void {
  instancia?.emit(evento, datos)
}
