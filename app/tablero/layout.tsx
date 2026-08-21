import { redirect } from "next/navigation"
import { actorActual, puedeVerTablero, puedeVerCatalogo } from "@/lib/admin/acceso"
import { NavTablero } from "./NavTablero"
import { panelTitulo, panelCuerpo } from "@/lib/fuentesPanel"

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
    <div
      className={`min-h-dvh bg-panel-fondo panel-shell ${panelTitulo.variable} ${panelCuerpo.variable}`}
    >
      <NavTablero
        nombre={actor.nombre}
        rol={actor.rol}
        conPanel={puedeVerCatalogo(actor.rol)}
      />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
