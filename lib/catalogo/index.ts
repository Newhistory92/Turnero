import { prisma } from "@/lib/db"
import type { BoxDominio, TramiteDominio } from "@/lib/queue/tipos"
import { CATALOGO_FIXTURE } from "./fixture"

export interface TramiteCatalogo extends TramiteDominio {
  nombre: string
  subtitulo: string
  icono: string
  prefijo: string
  orden: number
  categoriaId: string
  duracionMinimaEsperada: number
  destino: { ala: string; piso: string }
  boxes: BoxDominio[]
}

export interface CategoriaCatalogo {
  id: string
  nombre: string
  icono: string
  orden: number
  tramites: TramiteCatalogo[]
}

export interface Catalogo {
  categorias: CategoriaCatalogo[]
  tramites: TramiteCatalogo[]
  boxes: BoxDominio[]
}

let cache: Catalogo | null = null
let cargando: Promise<Catalogo> | null = null

export function invalidarCatalogo(): void {
  cache = null
  cargando = null
}

async function cargar(): Promise<Catalogo> {
  const categoriasDb = await prisma.categoria.findMany({
    where: { activa: true },
    orderBy: { orden: "asc" },
    include: {
      tramites: {
        where: { activo: true },
        orderBy: { orden: "asc" },
        include: {
          destinoAla: true,
          destinoPiso: true,
          boxes: { include: { box: true } },
        },
      },
    },
  })

  const categorias: CategoriaCatalogo[] = categoriasDb.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    icono: c.icono,
    orden: c.orden,
    tramites: c.tramites.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      subtitulo: t.subtitulo,
      icono: t.icono,
      prefijo: t.prefijo,
      orden: t.orden,
      activo: t.activo,
      categoriaId: t.categoriaId,
      duracionMinimaEsperada: t.duracionMinimaEsperada,
      horaApertura: t.horaApertura,
      horaCierre: t.horaCierre,
      diasSemana: t.diasSemana,
      destino: { ala: t.destinoAla.nombre, piso: t.destinoPiso.nombre },
      boxes: t.boxes.map((bt) => ({
        id: bt.box.id,
        activo: bt.box.activo,
        horaApertura: bt.box.horaApertura,
        horaCierre: bt.box.horaCierre,
        diasSemana: bt.box.diasSemana,
        tramiteIds: [t.id],
      })),
    })),
  }))

  const tramites = categorias.flatMap((c) => c.tramites)

  const boxesDb = await prisma.box.findMany({ include: { tramites: true } })
  const boxes: BoxDominio[] = boxesDb.map((b) => ({
    id: b.id,
    activo: b.activo,
    horaApertura: b.horaApertura,
    horaCierre: b.horaCierre,
    diasSemana: b.diasSemana,
    tramiteIds: b.tramites.map((bt) => bt.tramiteId),
  }))

  return { categorias, tramites, boxes }
}

export async function obtenerCatalogo(): Promise<Catalogo> {
  if (process.env.CATALOGO_FIXTURE === "on") return CATALOGO_FIXTURE

  if (cache) return cache
  if (!cargando) {
    cargando = cargar().then((c) => {
      cache = c
      cargando = null
      return c
    })
  }
  return cargando
}
