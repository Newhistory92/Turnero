import { obtenerCatalogo } from "@/lib/catalogo"
import { Wizard } from "./Wizard"

// El catalogo se lee en el servidor: no cambia entre toques.
export default async function PaginaKiosco() {
  const catalogo = await obtenerCatalogo()

  return (
    <Wizard
      categorias={catalogo.categorias.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        icono: c.icono,
        tramites: c.tramites.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          subtitulo: t.subtitulo,
          icono: t.icono,
          destino: t.destino,
        })),
      }))}
    />
  )
}
