import Link from "next/link"
import { Tablet, ArrowRight } from "lucide-react"
import { prisma } from "@/lib/db"
import { slug } from "@/server/rooms"
import { SelectorPantalla } from "./SelectorPantalla"

/**
 * Landing raíz. No es parte del kiosco (que corre en tótem, canvas fijo
 * 1920x1080) — esta pantalla la usa cualquier operador desde cualquier
 * dispositivo para llegar a la pantalla pública o al tótem, así que va con
 * el mismo sistema visual institucional pero totalmente responsive.
 */
export default async function HomePage() {
  const alas = await prisma.ala.findMany({
    where: { activa: true },
    orderBy: { orden: "asc" },
    select: { nombre: true },
  })

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-16 font-cuerpo text-gris-principal">
      <img src="/OSP_Gobierno.webp" alt="Obra Social Provincia" className="h-24 sm:h-32" />

      <div className="mt-10 max-w-xl text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Sistema de Gestión de Turnos</h1>
        <p className="mt-3 text-base text-gris-80 sm:text-lg">
          Seleccioná la interfaz a la que necesitás acceder
        </p>
      </div>

      <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
        <SelectorPantalla alas={alas.map((a) => ({ nombre: a.nombre, slug: slug(a.nombre) }))} />

        <Link
          href="/kiosco"
          className="group flex flex-col gap-4 rounded-2xl border-2 border-gris-70 bg-white p-8 shadow-sm transition-colors hover:border-osp focus-visible:outline focus-visible:outline-4 focus-visible:outline-gris-principal"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gris-20">
            <Tablet className="h-7 w-7 text-gris-80" aria-hidden />
          </span>
          <span>
            <span className="block text-xl font-semibold">Turnero</span>
            <span className="mt-1 block text-sm text-gris-80">
              Interfaz para que los afiliados soliciten turnos
            </span>
          </span>
          <span className="mt-2 flex items-center gap-2 text-sm font-medium text-osp">
            Solicitar turno
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </span>
        </Link>
      </div>
    </div>
  )
}
