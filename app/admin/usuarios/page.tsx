import { redirect } from "next/navigation"
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { prisma } from "@/lib/db"
import { listarUsuarios } from "@/lib/admin/usuarios"
import { TablaUsuarios } from "./TablaUsuarios"

export default async function PaginaUsuarios() {
  const actor = await actorActual()
  if (!actor) return null

  // El layout ya dejo afuera a operador y director. Aca cae el supervisor:
  // repartir roles es autoridad de admin.
  if (!puedeEditarCatalogo(actor.rol)) redirect("/admin")

  const [usuarios, boxesCrudos] = await Promise.all([
    listarUsuarios(),
    prisma.box.findMany({
      where: { activo: true },
      include: { ala: { select: { nombre: true } } },
      orderBy: { numero: "asc" },
    }),
  ])

  const boxes = boxesCrudos.map((b) => ({
    id: b.id,
    nombre: `${b.nombre} — Ala ${b.ala.nombre}`,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-titulo text-2xl font-semibold">Usuarios</h1>
        <p className="mt-1 text-sm text-gris-80">
          Las contrasenas viven en la base de la obra social y se validan en cada ingreso.
          Aca solo se decide quien entra al turnero, con que rol y en que boxes atiende.
        </p>
      </div>

      <TablaUsuarios usuarios={usuarios} boxes={boxes} actorId={actor.empleadoId} />
    </div>
  )
}
