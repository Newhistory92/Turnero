import { prisma } from "@/lib/db"
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { contarReferencias, sePuedeBorrar, type Entidad } from "@/lib/admin/referencias"
import { NOMBRES_DE_ICONO } from "@/lib/kiosco/iconos"
import { TablaAbm, type FilaAbm } from "../../_componentes/TablaAbm"
import { FormularioSimple, type SimpleEditar } from "./FormularioSimple"

async function filasDe(
  entidad: Entidad,
  registros: { id: string; activa: boolean; celdas: string[] }[]
): Promise<FilaAbm[]> {
  return Promise.all(
    registros.map(async (r) => ({
      id: r.id,
      celdas: r.celdas,
      activa: r.activa,
      borrable: sePuedeBorrar(await contarReferencias(entidad, r.id)),
    }))
  )
}

/** El editar de la URL es "entidad:id"; separa por sección. */
function editarDe(
  raw: string | undefined,
  entidad: string
): string | undefined {
  if (!raw) return undefined
  const [e, id] = raw.split(":")
  return e === entidad ? id : undefined
}

export default async function PaginaSimples({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>
}) {
  const { editar: editarRaw } = await searchParams
  const actor = await actorActual()
  const soloLectura = !actor || !puedeEditarCatalogo(actor.rol)

  const [sedes, alas, pisos, categorias] = await Promise.all([
    prisma.sede.findMany({ orderBy: { nombre: "asc" } }),
    prisma.ala.findMany({ orderBy: { orden: "asc" }, include: { sede: true } }),
    prisma.piso.findMany({ orderBy: { nivel: "asc" }, include: { sede: true } }),
    prisma.categoria.findMany({ orderBy: { orden: "asc" } }),
  ])

  const opcionesSede = sedes.map((s) => ({ id: s.id, nombre: s.nombre }))

  const idEditarSede = editarDe(editarRaw, "sede")
  const idEditarAla = editarDe(editarRaw, "ala")
  const idEditarPiso = editarDe(editarRaw, "piso")
  const idEditarCategoria = editarDe(editarRaw, "categoria")

  const sedeEditar = sedes.find((s) => s.id === idEditarSede)
  const alaEditar = alas.find((a) => a.id === idEditarAla)
  const pisoEditar = pisos.find((p) => p.id === idEditarPiso)
  const categoriaEditar = categorias.find((c) => c.id === idEditarCategoria)

  const editarSede: SimpleEditar | undefined = sedeEditar
    ? { id: sedeEditar.id, nombre: sedeEditar.nombre, posicion: 0 }
    : undefined
  const editarAla: SimpleEditar | undefined = alaEditar
    ? { id: alaEditar.id, nombre: alaEditar.nombre, posicion: alaEditar.orden, sedeId: alaEditar.sedeId }
    : undefined
  const editarPiso: SimpleEditar | undefined = pisoEditar
    ? { id: pisoEditar.id, nombre: pisoEditar.nombre, posicion: pisoEditar.nivel, sedeId: pisoEditar.sedeId }
    : undefined
  const editarCategoria: SimpleEditar | undefined = categoriaEditar
    ? {
        id: categoriaEditar.id,
        nombre: categoriaEditar.nombre,
        posicion: categoriaEditar.orden,
        icono: categoriaEditar.icono,
      }
    : undefined

  const [filasSedes, filasAlas, filasPisos, filasCategorias] = await Promise.all([
    filasDe("sede", sedes.map((s) => ({ id: s.id, activa: s.activa, celdas: [s.nombre] }))),
    filasDe("ala", alas.map((a) => ({
      id: a.id,
      activa: a.activa,
      celdas: [a.nombre, a.sede.nombre, String(a.orden)],
    }))),
    filasDe("piso", pisos.map((p) => ({
      id: p.id,
      activa: p.activa,
      celdas: [p.nombre, p.sede.nombre, String(p.nivel)],
    }))),
    filasDe("categoria", categorias.map((c) => ({
      id: c.id,
      activa: c.activa,
      celdas: [c.nombre, c.icono, String(c.orden)],
    }))),
  ])

  return (
    <>
      <h1 className="mb-6 font-titulo text-2xl font-semibold">
        Sedes, alas, pisos y categorías
      </h1>

      <section className="mb-10">
        <h2 className="mb-3 font-titulo text-lg font-semibold">Sedes</h2>
        <FormularioSimple
          entidad="sede"
          etiquetaPosicion={null}
          sedes={[]}
          iconos={null}
          soloLectura={soloLectura}
          editar={editarSede}
        />
        <TablaAbm
          entidad="sede"
          columnas={["Nombre"]}
          filas={filasSedes}
          soloLectura={soloLectura}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-titulo text-lg font-semibold">Alas</h2>
        <FormularioSimple
          entidad="ala"
          etiquetaPosicion="Orden"
          sedes={opcionesSede}
          iconos={null}
          soloLectura={soloLectura}
          editar={editarAla}
        />
        <TablaAbm
          entidad="ala"
          columnas={["Nombre", "Sede", "Orden"]}
          filas={filasAlas}
          soloLectura={soloLectura}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-titulo text-lg font-semibold">Pisos</h2>
        <FormularioSimple
          entidad="piso"
          etiquetaPosicion="Nivel"
          sedes={opcionesSede}
          iconos={null}
          soloLectura={soloLectura}
          editar={editarPiso}
        />
        <TablaAbm
          entidad="piso"
          columnas={["Nombre", "Sede", "Nivel"]}
          filas={filasPisos}
          soloLectura={soloLectura}
        />
      </section>

      <section>
        <h2 className="mb-3 font-titulo text-lg font-semibold">Categorías</h2>
        <FormularioSimple
          entidad="categoria"
          etiquetaPosicion="Orden"
          sedes={[]}
          iconos={NOMBRES_DE_ICONO}
          soloLectura={soloLectura}
          editar={editarCategoria}
        />
        <TablaAbm
          entidad="categoria"
          columnas={["Nombre", "Icono", "Orden"]}
          filas={filasCategorias}
          soloLectura={soloLectura}
        />
      </section>
    </>
  )
}
