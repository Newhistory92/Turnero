import { NextResponse } from "next/server"
import { obtenerCatalogo } from "@/lib/catalogo"

export async function GET() {
  const catalogo = await obtenerCatalogo()
  return NextResponse.json({
    categorias: catalogo.categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tramites: c.tramites.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        ala: t.destino.ala,
        piso: t.destino.piso,
      })),
    })),
  })
}
