import { prisma } from "@/lib/db"
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { contarReferencias, sePuedeBorrar } from "@/lib/admin/referencias"
import { TablaAbm, type FilaAbm } from "../../_componentes/TablaAbm"
import { FormularioBox, type BoxEditar } from "./FormularioBox"

export default async function PaginaBoxes({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>
}) {
  const { editar: editarRaw } = await searchParams
  const editarId = editarRaw?.startsWith("box:") ? editarRaw.slice("box:".length) : undefined
  const actor = await actorActual()
  const soloLectura = !actor || !puedeEditarCatalogo(actor.rol)

  const [boxes, alas, pisos, tramites] = await Promise.all([
    prisma.box.findMany({
      orderBy: [{ ala: { orden: "asc" } }, { numero: "asc" }],
      include: { ala: true, piso: true, tramites: true },
    }),
    prisma.ala.findMany({ where: { activa: true }, orderBy: { orden: "asc" } }),
    prisma.piso.findMany({ where: { activa: true }, orderBy: { nivel: "asc" } }),
    prisma.tramite.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
  ])

  const bEditar = editarId ? boxes.find((b) => b.id === editarId) : undefined
  const editar: BoxEditar | undefined = bEditar
    ? {
        id: bEditar.id,
        nombre: bEditar.nombre,
        numero: bEditar.numero,
        alaId: bEditar.alaId,
        pisoId: bEditar.pisoId,
        horaApertura: bEditar.horaApertura,
        horaCierre: bEditar.horaCierre,
        diasSemana: bEditar.diasSemana,
        tramiteIds: bEditar.tramites.map((bt) => bt.tramiteId),
      }
    : undefined

  const filas: FilaAbm[] = await Promise.all(
    boxes.map(async (b) => ({
      id: b.id,
      celdas: [
        b.nombre,
        b.ala.nombre,
        b.piso.nombre,
        `${b.horaApertura}–${b.horaCierre}`,
        String(b.tramites.length),
      ],
      activa: b.activo,
      borrable: sePuedeBorrar(await contarReferencias("box", b.id)),
    }))
  )

  return (
    <>
      <h1 className="mb-6 font-titulo text-2xl font-semibold">Boxes</h1>

      <FormularioBox
        alas={alas.map((a) => ({ id: a.id, nombre: a.nombre }))}
        pisos={pisos.map((p) => ({ id: p.id, nombre: p.nombre }))}
        tramites={tramites.map((t) => ({ id: t.id, nombre: t.nombre }))}
        soloLectura={soloLectura}
        editar={editar}
      />

      <TablaAbm
        entidad="box"
        columnas={["Nombre", "Ala", "Piso", "Horario", "Trámites"]}
        filas={filas}
        soloLectura={soloLectura}
      />
    </>
  )
}
