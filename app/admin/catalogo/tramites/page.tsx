import { prisma } from "@/lib/db"
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { contarReferencias, sePuedeBorrar } from "@/lib/admin/referencias"
import { avisoDestino } from "@/lib/admin/avisos"
import { NOMBRES_DE_ICONO } from "@/lib/kiosco/iconos"
import { TablaAbm, type FilaAbm } from "../../_componentes/TablaAbm"
import { FormularioTramite } from "./FormularioTramite"

export default async function PaginaTramites() {
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
