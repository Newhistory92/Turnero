import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { prisma } from "@/lib/db"
import { FormularioAlcance } from "./FormularioAlcance"

export default async function PaginaAlcance() {
  const actor = await actorActual()
  if (!actor) return null

  const soloLectura = !puedeEditarCatalogo(actor.rol)

  const [supervisores, tramites] = await Promise.all([
    prisma.empleado.findMany({
      where: { rol: "supervisor", activo: true },
      include: { alcances: { select: { tramiteId: true } } },
      orderBy: { nombre: "asc" },
    }),
    prisma.tramite.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { orden: "asc" },
    }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-titulo text-2xl font-semibold">Alcance de métricas</h1>
        <p className="mt-1 text-sm text-gris-80">
          Cada supervisor ve en el tablero sólo los trámites que tenga asignados acá. Sin
          ninguno, su tablero aparece vacío.
        </p>
      </div>

      {supervisores.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-sm text-gris-80">
          No hay supervisores activos.
        </p>
      ) : (
        supervisores.map((s) => (
          <FormularioAlcance
            key={s.id}
            empleadoId={s.id}
            empleadoNombre={s.nombre}
            tramites={tramites}
            asignados={s.alcances.map((a) => a.tramiteId)}
            soloLectura={soloLectura}
          />
        ))
      )}
    </div>
  )
}
