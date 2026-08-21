"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, LogOut } from "lucide-react"

export function NavTablero({
  nombre,
  rol,
  conPanel,
}: {
  nombre: string
  rol: string
  conPanel: boolean
}) {
  const ruta = usePathname()

  // El tablero tiene dos vistas nada mas, asi que van en pestanas arriba y no
  // en una lateral como en /admin. La lateral seria mas peso que ayuda.
  const pestanas = [
    { href: "/tablero", texto: "Hoy", exacto: true },
    { href: "/tablero/historico", texto: "Histórico", exacto: false },
  ]

  return (
    <header className="border-b border-panel-borde bg-panel-superficie">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 pt-4">
        <div className="flex items-center gap-3">
          {conPanel && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-panel-texto-suave transition-colors duration-150 hover:bg-panel-fondo hover:text-panel-texto focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-primario"
            >
              <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              Panel
            </Link>
          )}
          <h1 className="font-titulo text-lg font-semibold text-panel-texto">Tablero</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-panel-texto">{nombre}</p>
            <p className="text-xs capitalize text-panel-texto-suave">{rol}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-panel-texto-suave transition-colors duration-150 hover:bg-panel-fondo hover:text-panel-texto focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-primario"
            >
              <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>

      <nav className="mx-auto flex max-w-6xl gap-1 px-6">
        {pestanas.map((p) => {
          const activa = p.exacto ? ruta === p.href : ruta.startsWith(p.href)
          return (
            <Link
              key={p.href}
              href={p.href}
              aria-current={activa ? "page" : undefined}
              // El borde inferior marca donde estas: en pestanas se lee mas
              // rapido que un cambio de color solo.
              className={`border-b-2 px-3 py-3 text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-primario ${
                activa
                  ? "border-panel-primario font-semibold text-panel-primario-fuerte"
                  : "border-transparent text-panel-texto-suave hover:text-panel-texto"
              }`}
            >
              {p.texto}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
