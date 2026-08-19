import { prisma } from "@/lib/db"
import type { TipoEvento } from "@/lib/queue/tipos"
import type { Alcance, RangoFechas } from "./tipos"
import { filtroTramiteId } from "./alcance"
import type { EventoDuracion } from "./duraciones"

export interface FilaTurno {
  id: string
  numero: string
  fecha: Date
  tramiteId: string
  tramiteNombre: string
  umbralMinutos: number
  derivadoDeId: string | null
  estado: string
  boxId: string | null
  boxNombre: string | null
  empleadoId: string | null
  empleadoNombre: string | null
  eventos: EventoDuracion[]
}

export interface LineaCola {
  tramiteId: string
  tramiteNombre: string
  esperando: number
  esperaMasViejaSegundos: number | null
}

export interface EstadoBox {
  boxId: string
  boxNombre: string
  alaNombre: string
  empleadoNombre: string | null
  estado: "atendiendo" | "ocioso" | "cerrado"
  turnoNumero: string | null
}

/**
 * El alcance va primero en la firma de todas estas funciones a proposito:
 * es un limite de autorizacion, no un filtro opcional, y como parametro
 * obligatorio no se puede olvidar sin que deje de compilar.
 */
export async function turnosDelRango(
  alcance: Alcance,
  rango: RangoFechas
): Promise<FilaTurno[]> {
  // Prisma envia Date como datetime2 a SQL Server. La columna fecha es DATE,
  // que SQL Server promueve a medianoche UTC al comparar. Si rango.desde viene
  // con hora local (p.ej. 03:00 UTC en Argentina) la comparacion falla porque
  // la fila cae en 00:00 UTC. Normalizamos a medianoche UTC para alinear los
  // dos lados del predicado.
  const desdeUtc = new Date(rango.desde)
  desdeUtc.setUTCHours(0, 0, 0, 0)
  const hastaUtc = new Date(rango.hasta)
  hastaUtc.setUTCHours(23, 59, 59, 999)

  const turnos = await prisma.turno.findMany({
    where: {
      fecha: { gte: desdeUtc, lte: hastaUtc },
      tramiteId: filtroTramiteId(alcance),
    },
    include: {
      tramite: { select: { nombre: true, duracionMinimaEsperada: true } },
      box: { select: { nombre: true } },
      eventos: {
        select: { tipo: true, timestamp: true, empleadoId: true, empleado: { select: { nombre: true } } },
        orderBy: { timestamp: "asc" },
      },
    },
  })

  return turnos.map((t) => {
    // El empleado de la atencion es el que la inicio; si el turno se
    // finalizo sin iniciar (no deberia pasar), vale el del cierre.
    const conEmpleado =
      t.eventos.find((e) => e.tipo === "iniciado" && e.empleadoId) ??
      t.eventos.find((e) => e.tipo === "finalizado" && e.empleadoId) ??
      null

    return {
      id: t.id,
      numero: t.numero,
      fecha: t.fecha,
      tramiteId: t.tramiteId,
      tramiteNombre: t.tramite.nombre,
      umbralMinutos: t.tramite.duracionMinimaEsperada,
      derivadoDeId: t.derivadoDeId,
      estado: t.estado,
      boxId: t.boxId,
      boxNombre: t.box?.nombre ?? null,
      empleadoId: conEmpleado?.empleadoId ?? null,
      empleadoNombre: conEmpleado?.empleado?.nombre ?? null,
      eventos: t.eventos.map((e) => ({
        tipo: e.tipo as TipoEvento,
        timestamp: e.timestamp,
      })),
    }
  })
}

export async function colaActual(
  alcance: Alcance,
  ahora: Date = new Date()
): Promise<LineaCola[]> {
  const turnos = await prisma.turno.findMany({
    where: { estado: "esperando", tramiteId: filtroTramiteId(alcance) },
    include: {
      tramite: { select: { nombre: true } },
      eventos: {
        where: { tipo: "generado" },
        select: { timestamp: true },
        orderBy: { timestamp: "asc" },
        take: 1,
      },
    },
  })

  const acumulado = new Map<string, LineaCola>()

  for (const t of turnos) {
    const linea = acumulado.get(t.tramiteId) ?? {
      tramiteId: t.tramiteId,
      tramiteNombre: t.tramite.nombre,
      esperando: 0,
      esperaMasViejaSegundos: null,
    }
    linea.esperando += 1

    const generado = t.eventos[0]?.timestamp
    if (generado) {
      const espera = Math.round((ahora.getTime() - generado.getTime()) / 1000)
      if (linea.esperaMasViejaSegundos === null || espera > linea.esperaMasViejaSegundos) {
        linea.esperaMasViejaSegundos = espera
      }
    }

    acumulado.set(t.tramiteId, linea)
  }

  // Lo que mas urge, arriba: el supervisor mira esta lista para decidir
  // donde abrir otro box.
  return [...acumulado.values()].sort(
    (a, b) => (b.esperaMasViejaSegundos ?? 0) - (a.esperaMasViejaSegundos ?? 0)
  )
}

export async function estadoBoxes(alcance: Alcance): Promise<EstadoBox[]> {
  const filtro = filtroTramiteId(alcance)

  const boxes = await prisma.box.findMany({
    where: {
      activo: true,
      // Un box entra si atiende al menos un tramite del alcance: mostrar
      // boxes de areas ajenas no le sirve a quien solo puede actuar sobre
      // la suya.
      ...(filtro ? { tramites: { some: { tramiteId: filtro } } } : {}),
    },
    include: {
      ala: { select: { nombre: true } },
      sesiones: {
        where: { fin: null },
        include: { empleado: { select: { nombre: true } } },
        orderBy: { inicio: "desc" },
        take: 1,
      },
      turnos: {
        where: { estado: { in: ["llamado", "atendiendo"] } },
        select: { numero: true },
        take: 1,
      },
    },
    orderBy: [{ ala: { orden: "asc" } }, { numero: "asc" }],
  })

  return boxes.map((b) => {
    const sesion = b.sesiones[0]
    const turno = b.turnos[0]

    const estado: EstadoBox["estado"] = !sesion
      ? "cerrado"
      : turno
        ? "atendiendo"
        : "ocioso"

    return {
      boxId: b.id,
      boxNombre: b.nombre,
      alaNombre: b.ala.nombre,
      empleadoNombre: sesion?.empleado.nombre ?? null,
      estado,
      turnoNumero: turno?.numero ?? null,
    }
  })
}
