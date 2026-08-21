import { redirect } from "next/navigation"
import { actorActual, puedeVerCatalogo, puedeEditarCatalogo, puedeVerTablero } from "@/lib/admin/acceso"
import { BarraLateral } from "./_componentes/BarraLateral"
import { panelTitulo, panelCuerpo } from "@/lib/fuentesPanel"

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
    <div
      className={`min-h-dvh bg-panel-fondo panel-shell ${panelTitulo.variable} ${panelCuerpo.variable}`}
    >
      <BarraLateral
        nombre={actor.nombre}
        rol={actor.rol}
        puedeEditar={puedeEditarCatalogo(actor.rol)}
        conTablero={puedeVerTablero(actor.rol)}
      />

      {/* El margen deja lugar a la lateral fija y sigue su ancho via una
          variable CSS: la lateral puede colapsarse a un riel de iconos y
          este margen se ajusta solo, sin que este Server Component necesite
          conocer ese estado. En pantallas chicas la lateral se corre fuera
          y el contenido ocupa todo el ancho. */}
      {/* Sin transicion por la misma razon que la lateral: animar un margen
          atado a una custom property con fallback queda trabado en este
          motor. Ver comentario en BarraLateral.tsx. */}
      <div className="panel-margen-lateral">
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
