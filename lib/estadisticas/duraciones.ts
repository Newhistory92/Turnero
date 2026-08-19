import type { TipoEvento } from "@/lib/queue/tipos"
import type { Clasificacion } from "./tipos"

export interface EventoDuracion {
  tipo: TipoEvento
  timestamp: Date
}

export interface Duraciones {
  /** Segundos entre `generado` y el primer `llamado`. null si no hay con que medir. */
  esperaSegundos: number | null
  /** La persona sigue en la cola: la espera todavia esta corriendo. */
  esperaEnCurso: boolean
  /** Segundos entre `iniciado` y el evento terminal. null si nunca se inicio. */
  atencionSegundos: number | null
  clasificacion: Clasificacion | null
}

export const SEGUNDOS_ANOMALIA = 30

/** Eventos que cierran el paso del turno por el sistema. */
const TERMINALES: TipoEvento[] = ["finalizado", "derivado", "abandonado"]

/** Eventos que cierran una atencion ya iniciada. */
const CIERRAN_ATENCION: TipoEvento[] = ["finalizado", "derivado"]

function segundos(desde: Date, hasta: Date): number {
  return Math.round((hasta.getTime() - desde.getTime()) / 1000)
}

/**
 * Las tres categorias de §6.8 del spec base. El umbral es por tramite
 * (`duracionMinimaEsperada`), no global: comparar todo contra un mismo
 * numero castigaria a quien atiende los tramites largos.
 */
export function clasificar(atencionSegundos: number, umbralMinutos: number): Clasificacion {
  if (atencionSegundos < SEGUNDOS_ANOMALIA) return "anomalia"
  if (atencionSegundos < umbralMinutos * 60) return "breve"
  return "valida"
}

export function calcularDuraciones(
  eventos: EventoDuracion[],
  umbralMinutos: number,
  ahora: Date = new Date()
): Duraciones {
  const orden = [...eventos].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const primero = (tipo: TipoEvento) => orden.find((e) => e.tipo === tipo)

  const generado = primero("generado")
  const llamado = primero("llamado")
  const iniciado = primero("iniciado")
  const terminal = orden.find((e) => TERMINALES.includes(e.tipo))

  // La espera sale del evento `generado` del propio turno, nunca de
  // createdAt: los derivados heredan el createdAt del original, asi que
  // medir desde ahi le cargaria al segundo box la espera del primero.
  let esperaSegundos: number | null = null
  let esperaEnCurso = false

  if (generado) {
    if (llamado) {
      esperaSegundos = segundos(generado.timestamp, llamado.timestamp)
    } else if (terminal) {
      // Nunca lo llamaron, pero la espera termino igual (abandonado).
      esperaSegundos = segundos(generado.timestamp, terminal.timestamp)
    } else {
      esperaSegundos = segundos(generado.timestamp, ahora)
      esperaEnCurso = true
    }
  }

  let atencionSegundos: number | null = null
  if (iniciado) {
    const cierre = orden.find(
      (e) =>
        CIERRAN_ATENCION.includes(e.tipo) &&
        e.timestamp.getTime() >= iniciado.timestamp.getTime()
    )
    if (cierre) atencionSegundos = segundos(iniciado.timestamp, cierre.timestamp)
  }

  return {
    esperaSegundos,
    esperaEnCurso,
    atencionSegundos,
    clasificacion: atencionSegundos === null ? null : clasificar(atencionSegundos, umbralMinutos),
  }
}
