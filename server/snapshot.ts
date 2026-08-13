import { prisma } from "@/lib/db"
import { obtenerCatalogo } from "@/lib/catalogo"
import { resumirCola, type ResumenCola } from "@/lib/queue/resumen"
import type { TurnoDominio } from "@/lib/queue/tipos"

export interface TurnoPanel {
  id: string
  numero: string
  tramiteId: string
  tramiteNombre: string
  nombreAfiliado: string | null
  estado: string
  createdAt: string
}

export interface SnapshotOperador {
  boxId: string
  boxNombre: string
  resumen: ResumenCola
  cola: TurnoPanel[]
  ausentes: TurnoPanel[]
  activo: TurnoPanel | null
}

function hoy(): Date {
  const a = new Date()
  return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()))
}

export async function armarSnapshot(boxId: string): Promise<SnapshotOperador> {
  const catalogo = await obtenerCatalogo()
  const box = catalogo.boxes.find((b) => b.id === boxId)
  const boxDb = await prisma.box.findUniqueOrThrow({ where: { id: boxId } })

  const nombres = new Map(
    catalogo.tramites.map((t) => [
      t.id,
      {
        tramite: t.nombre,
        categoria: catalogo.categorias.find((c) => c.id === t.categoriaId)?.nombre ?? "",
      },
    ])
  )

  const turnosDb = await prisma.turno.findMany({
    where: { fecha: hoy(), estado: { in: ["esperando", "ausente", "llamado", "atendiendo"] } },
    orderBy: { createdAt: "asc" },
  })

  const aPanel = (t: (typeof turnosDb)[number]): TurnoPanel => ({
    id: t.id,
    numero: t.numero,
    tramiteId: t.tramiteId,
    tramiteNombre: nombres.get(t.tramiteId)?.tramite ?? t.tramiteId,
    nombreAfiliado: t.nombreAfiliado,
    estado: t.estado,
    createdAt: t.createdAt.toISOString(),
  })

  const dominio: TurnoDominio[] = turnosDb.map((t) => ({
    id: t.id,
    numero: t.numero,
    tramiteId: t.tramiteId,
    estado: t.estado as TurnoDominio["estado"],
    boxId: t.boxId,
    createdAt: t.createdAt,
    derivadoDeId: t.derivadoDeId,
  }))

  const delBox = box ? box.tramiteIds : []
  const resumen = box
    ? resumirCola(dominio, box, nombres)
    : { total: 0, lineas: [], esperaMasVieja: null }

  return {
    boxId,
    boxNombre: boxDb.nombre,
    resumen,
    cola: turnosDb
      .filter((t) => t.estado === "esperando" && delBox.includes(t.tramiteId))
      .map(aPanel),
    ausentes: turnosDb
      .filter((t) => t.estado === "ausente" && t.boxId === boxId)
      .map(aPanel),
    // El turno en curso: es lo que permite recuperar la pantalla tras un
    // refresh o un corte de red, porque la sesion vive en la base.
    activo:
      turnosDb
        .filter((t) => t.boxId === boxId && ["llamado", "atendiendo"].includes(t.estado))
        .map(aPanel)[0] ?? null,
  }
}
