import { obtenerCatalogo } from "@/lib/catalogo"
import { estaDisponible } from "@/lib/queue/disponibilidad"
import { Wizard } from "./Wizard"
import type { EstadoTramite } from "./pasos/PasoTramite"

// El catalogo se lee en el servidor: no cambia entre toques.
export default async function PaginaKiosco() {
  const catalogo = await obtenerCatalogo()

  // La disponibilidad tambien se calcula aca: la hora sale del servidor,
  // nunca del reloj del totem (regla 6).
  const ahora = new Date()
  const estadosTramites: Record<string, EstadoTramite> = {}
  for (const t of catalogo.tramites) {
    const d = estaDisponible(t, t.boxes, ahora)
    estadosTramites[t.id] = { disponible: d.disponible, ventana: d.ventanaEfectiva }
  }

  return (
    <Wizard
      estadosTramites={estadosTramites}
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
