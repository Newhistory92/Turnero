import { redirect } from "next/navigation"
import { actorActual, puedeVerCatalogo, puedeEditarCatalogo, puedeVerTablero } from "@/lib/admin/acceso"
import { BarraLateral } from "./_componentes/BarraLateral"

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

  return (
    <div className="min-h-dvh bg-panel-fondo">
      <BarraLateral
        nombre={actor.nombre}
        rol={actor.rol}
        puedeEditar={puedeEditarCatalogo(actor.rol)}
        conTablero={puedeVerTablero(actor.rol)}
      />

      {/* El margen deja lugar a la lateral fija; en pantallas chicas la
          lateral se corre fuera y el contenido ocupa todo el ancho. */}
      <div className="lg:ml-64">
        {soloLectura && (
          <div className="border-b border-panel-borde bg-panel-primario-suave px-6 py-2.5 text-sm text-panel-primario-fuerte">
            Estás viendo el catálogo en modo sólo lectura.
          </div>
        )}
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  )
}
