import Link from "next/link"
import { redirect } from "next/navigation"
import { actorActual, puedeVerCatalogo, puedeEditarCatalogo, puedeVerTablero } from "@/lib/admin/acceso"

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode
}) {
  const actor = await actorActual()

  // El guard vive en el layout, no en cada pagina: asi cubre toda la rama
  // /admin/* sin que haya que acordarse de repetirlo en una pagina nueva.
  if (!actor || !puedeVerCatalogo(actor.rol)) redirect("/operador/login")

  const soloLectura = !puedeEditarCatalogo(actor.rol)
  const conTablero = puedeVerTablero(actor.rol)

  return (
    <div className="min-h-dvh bg-gris-20">
      <header className="flex items-center justify-between border-b border-gainsboro bg-white px-6 py-4">
        <nav className="flex items-center gap-6">
          <Link href="/admin" className="font-titulo text-lg font-semibold">
            Administración
          </Link>
          <Link href="/admin/catalogo/tramites" className="text-sm hover:underline">
            Trámites
          </Link>
          <Link href="/admin/catalogo/boxes" className="text-sm hover:underline">
            Boxes
          </Link>
          <Link href="/admin/catalogo/simples" className="text-sm hover:underline">
            Sedes, alas, pisos y categorías
          </Link>
          {puedeEditarCatalogo(actor.rol) && (
            <Link href="/admin/alcance" className="text-sm hover:underline">
              Alcance de métricas
            </Link>
          )}
          {conTablero && (
            <Link href="/tablero" className="text-sm hover:underline">
              Tablero
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-4 text-sm">
          {soloLectura && (
            <span className="rounded-lg bg-gainsboro px-3 py-1 font-semibold">
              Sólo lectura
            </span>
          )}
          <span>{actor.nombre}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
