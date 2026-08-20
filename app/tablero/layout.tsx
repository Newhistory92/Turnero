import Link from "next/link"
import { redirect } from "next/navigation"
import { actorActual, puedeVerTablero } from "@/lib/admin/acceso"

export default async function LayoutTablero({
  children,
}: {
  children: React.ReactNode
}) {
  const actor = await actorActual()

  // El guard vive en el layout, no en cada pagina: asi cubre toda la rama
  // /tablero/* sin que haya que acordarse de repetirlo en una pagina nueva.
  if (!actor || !puedeVerTablero(actor.rol)) redirect("/operador/login")

  return (
    <div className="min-h-dvh bg-gris-20">
      <header className="flex items-center justify-between border-b border-gainsboro bg-white px-6 py-4">
        <nav className="flex items-center gap-6">
          <Link href="/tablero" className="font-titulo text-lg font-semibold">
            Tablero
          </Link>
          <Link href="/tablero" className="text-sm hover:underline">
            Hoy
          </Link>
          <Link href="/tablero/historico" className="text-sm hover:underline">
            Histórico
          </Link>
        </nav>

        <span className="text-sm">{actor.nombre}</span>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
