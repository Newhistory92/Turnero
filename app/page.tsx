import Link from "next/link"
import { Monitor, Tablet, ArrowRight } from "lucide-react"

/**
 * Landing raíz. No es parte del kiosco (que corre en tótem, canvas fijo
 * 1920x1080) — esta pantalla la usa cualquier operador desde cualquier
 * dispositivo para llegar a la pantalla pública o al tótem, así que va con
 * el mismo sistema visual institucional pero totalmente responsive.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gris-20 px-6 py-16 font-cuerpo text-gris-principal">
      <img src="/OSP_Gobierno.webp" alt="Obra Social Provincia" className="h-16 sm:h-20" />

      <div className="mt-10 max-w-xl text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Sistema de Gestión de Turnos</h1>
        <p className="mt-3 text-base text-gris-80 sm:text-lg">
          Seleccioná la interfaz a la que necesitás acceder
        </p>
      </div>

      <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
        <Link
          href="/public-display"
          className="group flex flex-col gap-4 rounded-2xl border-2 border-gris-70 bg-white p-8 shadow-sm transition-colors hover:border-osp focus-visible:outline focus-visible:outline-4 focus-visible:outline-gris-principal"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gris-20">
            <Monitor className="h-7 w-7 text-gris-80" aria-hidden />
          </span>
          <span>
            <span className="block text-xl font-semibold">Pantalla Pública</span>
            <span className="mt-1 block text-sm text-gris-80">
              Visualización en tiempo real de turnos llamados
            </span>
          </span>
          <span className="mt-2 flex items-center gap-2 text-sm font-medium text-osp">
            Ver pantalla
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </span>
        </Link>

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
