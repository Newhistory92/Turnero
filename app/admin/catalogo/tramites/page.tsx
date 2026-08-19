import { prisma } from "@/lib/db"
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { contarReferencias, sePuedeBorrar } from "@/lib/admin/referencias"
import { avisoDestino } from "@/lib/admin/avisos"
import { NOMBRES_DE_ICONO } from "@/lib/kiosco/iconos"
import { TablaAbm, type FilaAbm } from "../../_componentes/TablaAbm"
import { FormularioTramite, type TramiteEditar } from "./FormularioTramite"

export default async function PaginaTramites({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>
}) {
  const { editar: editarRaw } = await searchParams
  const editarId = editarRaw?.startsWith("tramite:") ? editarRaw.slice("tramite:".length) : undefined
  const actor = await actorActual()
  const soloLectura = !actor || !puedeEditarCatalogo(actor.rol)

  const [tramites, categorias, alas, pisos, boxes] = await Promise.all([
    prisma.tramite.findMany({
      orderBy: { orden: "asc" },
      include: {
        categoria: true,
        destinoAla: true,
        boxes: { include: { box: { include: { ala: true } } } },
      },
    }),
    prisma.categoria.findMany({ where: { activa: true }, orderBy: { orden: "asc" } }),
    prisma.ala.findMany({ where: { activa: true }, orderBy: { orden: "asc" } }),
    prisma.piso.findMany({ where: { activa: true }, orderBy: { nivel: "asc" } }),
    prisma.box.findMany({
      where: { activo: true },
      orderBy: { numero: "asc" },
      include: { ala: true },
    }),
  ])

  const tEditar = editarId ? tramites.find((t) => t.id === editarId) : undefined
  const editar: TramiteEditar | undefined = tEditar
    ? {
        id: tEditar.id,
        nombre: tEditar.nombre,
        subtitulo: tEditar.subtitulo,
        categoriaId: tEditar.categoriaId,
        icono: tEditar.icono,
        prefijo: tEditar.prefijo,
        destinoAlaId: tEditar.destinoAlaId,
        destinoPisoId: tEditar.destinoPisoId,
        horaApertura: tEditar.horaApertura,
        horaCierre: tEditar.horaCierre,
        duracionMinimaEsperada: tEditar.duracionMinimaEsperada,
        diasSemana: tEditar.diasSemana,
        orden: tEditar.orden,
        boxIds: tEditar.boxes.map((bt) => bt.box.id),
      }
    : undefined

  const avisos = tramites
    .map((t) => ({
      nombre: t.nombre,
      aviso: avisoDestino(t.destinoAla.nombre, t.boxes.map((bt) => bt.box.ala.nombre)),
    }))
    .filter((a): a is { nombre: string; aviso: string } => a.aviso !== null)

  const filas: FilaAbm[] = await Promise.all(
    tramites.map(async (t) => ({
      id: t.id,
      celdas: [
        t.nombre,
        t.prefijo,
        t.categoria.nombre,
        t.destinoAla.nombre,
        `${t.horaApertura}–${t.horaCierre}`,
        String(t.boxes.length),
      ],
      activa: t.activo,
      borrable: sePuedeBorrar(await contarReferencias("tramite", t.id)),
    }))
  )

  return (
    <>
      <h1 className="mb-6 font-titulo text-2xl font-semibold">Trámites</h1>

      {avisos.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-amber-500 bg-amber-50 p-4">
          <p className="mb-2 font-semibold">Destinos que no coinciden con los boxes</p>
          <ul className="list-inside list-disc text-sm">
            {avisos.map((a) => (
              <li key={a.nombre}>
                <strong>{a.nombre}</strong>: {a.aviso}
              </li>
            ))}
          </ul>
        </div>
      )}

      <FormularioTramite
        categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
        alas={alas.map((a) => ({ id: a.id, nombre: a.nombre }))}
        pisos={pisos.map((p) => ({ id: p.id, nombre: p.nombre }))}
        boxes={boxes.map((b) => ({ id: b.id, nombre: `${b.nombre} — ${b.ala.nombre}` }))}
        iconos={NOMBRES_DE_ICONO}
        soloLectura={soloLectura}
        editar={editar}
      />

      <TablaAbm
        entidad="tramite"
        columnas={["Nombre", "Prefijo", "Categoría", "Destino", "Horario", "Boxes"]}
        filas={filas}
        soloLectura={soloLectura}
      />
    </>
  )
}
