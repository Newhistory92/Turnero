import { redirect } from "next/navigation"
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { prisma } from "@/lib/db"
import { listarUsuarios } from "@/lib/admin/usuarios"
import { listarImportables, type Importable } from "@/lib/admin/importacion"
import { TablaUsuarios } from "./TablaUsuarios"
import { PanelImportar } from "./PanelImportar"

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

  // Si la base de la obra social no responde, la pantalla lo dice. Una lista
  // vacia se leeria como "no hay nadie para importar", que es lo contrario.
  let importables: Importable[] = []
  let errorImportar: string | null = null
  try {
    importables = await listarImportables()
  } catch {
    errorImportar = "No se pudo consultar la base de la obra social"
  }

  const boxes = boxesCrudos.map((b) => ({
    id: b.id,
    nombre: `${b.nombre} — Ala ${b.ala.nombre}`,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-titulo text-2xl font-semibold">Usuarios</h1>
        <p className="mt-1 text-sm text-gris-80">
          Las contraseñas viven en la base de la obra social y se validan en cada ingreso.
          Acá sólo se decide quién entra al turnero, con qué rol y en qué boxes atiende.
        </p>
      </div>

      <PanelImportar importables={importables} error={errorImportar} />

      <TablaUsuarios usuarios={usuarios} boxes={boxes} actorId={actor.empleadoId} />
    </div>
  )
}
