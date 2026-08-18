import { prisma } from "@/lib/db"

export interface LlamadoPantalla {
  eventoId: string
  numero: string
  boxNombre: string
  identificacion: string | null
  llamadoEn: string
}

export interface SnapshotPantalla {
  ala: string
  actual: LlamadoPantalla | null
  ultimos: LlamadoPantalla[]
}

/** Fila cruda del evento de llamado, ya unida al turno y al box. */
export interface FilaLlamado {
  eventoId: string
  numero: string
  boxNombre: string
  nombreAfiliado: string | null
  dni: string | null
  timestamp: Date
  /** Estado actual del turno, no del evento: el evento de llamado no cambia. */
  estadoTurno: string
}

export const CUANTOS_ULTIMOS = 4

/**
 * Proyeccion pura. Se separa de la consulta para poder probarla sin base.
 *
 * El bloque grande es "a quien estamos llamando", no "a quien llamamos ultimo".
 * Por eso `actual` existe solo mientras el turno del tope sigue en estado
 * "llamado": apenas el operador inicia la atencion —o lo marca ausente, o lo
 * deriva— ese turno baja a `ultimos` y el bloque grande queda libre. Dejarlo
 * arriba haria que la TV siga llamando a alguien que ya esta sentado en el box.
 *
 * LlamadoPantalla no tiene campo de tramite y no lo va a tener: el catalogo
 * incluye "Protesis" y "Programa Materno", y un nombre junto a un tramite
 * medico en un pasillo es un dato de salud identificable.
 */
export function proyectarLlamados(ala: string, filas: FilaLlamado[]): SnapshotPantalla {
  const aLlamado = (f: FilaLlamado): LlamadoPantalla => ({
    eventoId: f.eventoId,
    numero: f.numero,
    boxNombre: f.boxNombre,
    identificacion: f.nombreAfiliado ?? f.dni ?? null,
    llamadoEn: f.timestamp.toISOString(),
  })

  // El estado es el del turno hoy, no el del evento: el evento de llamado no
  // cambia nunca, y es justamente el turno el que avanza por debajo.
  const enEspera = filas[0]?.estadoTurno === "llamado"

  return {
    ala,
    actual: enEspera ? aLlamado(filas[0]) : null,
    // Cuando el tope ya no espera, entra el primero a la repesca: es el llamado
    // mas reciente y quien levanto la vista tarde todavia lo necesita.
    ultimos: (enEspera ? filas.slice(1) : filas).slice(0, CUANTOS_ULTIMOS).map(aLlamado),
  }
}

/**
 * Corte del dia en hora local, a proposito.
 *
 * TurnoEvento.timestamp es DATETIME2: guarda un instante real, sin la
 * conversion implicita que SQL Server hace con las columnas DATE. Usar
 * Date.UTC() aca —como si correspondiera, porque es lo que SP2 hace con
 * Turno.fecha— correria el corte tres horas y mostraria llamados de ayer entre
 * las 21:00 y la medianoche.
 */
function desdeMedianoche(): Date {
  const a = new Date()
  return new Date(a.getFullYear(), a.getMonth(), a.getDate())
}

export async function armarSnapshotPantalla(ala: string): Promise<SnapshotPantalla> {
  const eventos = await prisma.turnoEvento.findMany({
    where: {
      tipo: { in: ["llamado", "rellamado"] },
      timestamp: { gte: desdeMedianoche() },
      box: { ala: { nombre: ala } },
    },
    orderBy: { timestamp: "desc" },
    take: 1 + CUANTOS_ULTIMOS,
    select: {
      id: true,
      timestamp: true,
      box: { select: { nombre: true } },
      turno: { select: { numero: true, nombreAfiliado: true, dni: true, estado: true } },
    },
  })

  return proyectarLlamados(
    ala,
    eventos.map((e) => ({
      eventoId: e.id,
      numero: e.turno.numero,
      boxNombre: e.box?.nombre ?? "",
      nombreAfiliado: e.turno.nombreAfiliado,
      dni: e.turno.dni,
      timestamp: e.timestamp,
      estadoTurno: e.turno.estado,
    }))
  )
}
