"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  BarChart3,
  Building2,
  DoorOpen,
  FileText,
  LayoutGrid,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface Enlace {
  href: string
  texto: string
  icono: LucideIcon
  /** Coincide con subrutas: /admin/catalogo/boxes marca activo a /admin/catalogo. */
  exacto?: boolean
}

interface Grupo {
  titulo: string
  enlaces: Enlace[]
}

export function BarraLateral({
  nombre,
  rol,
  puedeEditar,
  conTablero,
}: {
  nombre: string
  rol: string
  puedeEditar: boolean
  conTablero: boolean
}) {
  const [abierta, setAbierta] = useState(false)
  const ruta = usePathname()

  // Agrupados por lo que la persona viene a hacer, no por como esta armado el
  // codigo. Siete enlaces sueltos en una fila obligan a leerlos todos cada vez.
  const grupos: Grupo[] = [
    {
      titulo: "Catálogo",
      enlaces: [
        { href: "/admin", texto: "Resumen", icono: LayoutGrid, exacto: true },
        { href: "/admin/catalogo/tramites", texto: "Trámites", icono: FileText },
        { href: "/admin/catalogo/boxes", texto: "Boxes", icono: DoorOpen },
        { href: "/admin/catalogo/simples", texto: "Sedes y categorías", icono: Building2 },
      ],
    },
  ]

  if (puedeEditar) {
    grupos.push({
      titulo: "Gestión",
      enlaces: [
        { href: "/admin/usuarios", texto: "Usuarios", icono: Users },
        { href: "/admin/alcance", texto: "Alcance de métricas", icono: ShieldCheck },
      ],
    })
  }

  if (conTablero) {
    grupos.push({
      titulo: "Métricas",
      enlaces: [{ href: "/tablero", texto: "Tablero", icono: BarChart3 }],
    })
  }

  function estaActivo(e: Enlace): boolean {
    return e.exacto ? ruta === e.href : ruta.startsWith(e.href)
  }

  const contenido = (
    <>
      <div className="flex items-center gap-2 px-6 py-6">
        {/* El cyan claro con texto blanco queda en 3.68:1, por debajo del
            minimo. El tono fuerte lo lleva a 5.37:1. */}
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-panel-primario-fuerte font-titulo text-lg font-bold text-white">
          T
        </div>
        <div>
          <p className="font-titulo text-sm font-semibold text-white">Turnero</p>
          <p className="text-xs text-panel-nav-texto">Panel interno</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        {grupos.map((g) => (
          <div key={g.titulo} className="mb-6">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-panel-nav-texto">
              {g.titulo}
            </p>
            <ul className="flex flex-col gap-1">
              {g.enlaces.map((e) => {
                const activo = estaActivo(e)
                const Icono = e.icono
                return (
                  <li key={e.href}>
                    <Link
                      href={e.href}
                      onClick={() => setAbierta(false)}
                      aria-current={activo ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-nav-activo ${
                        activo
                          ? "bg-panel-nav-suave font-semibold text-panel-nav-activo"
                          : "text-panel-nav-texto hover:bg-panel-nav-suave hover:text-white"
                      }`}
                    >
                      <Icono size={18} strokeWidth={1.75} aria-hidden="true" />
                      {e.texto}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-panel-nav-suave px-3 py-4">
        <div className="px-3 pb-3">
          <p className="truncate text-sm font-medium text-white">{nombre}</p>
          <p className="text-xs capitalize text-panel-nav-texto">{rol}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-panel-nav-texto transition-colors duration-150 hover:bg-panel-nav-suave hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-nav-activo"
          >
            <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </>
  )

  return (
    <>
      {/* Barra superior con el boton de menu: solo aparece cuando la lateral
          no entra en pantalla. */}
      <div className="flex items-center gap-3 border-b border-panel-borde bg-panel-superficie px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setAbierta(true)}
          aria-label="Abrir menú"
          className="grid h-11 w-11 place-items-center rounded-lg text-panel-texto hover:bg-panel-fondo focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-primario"
        >
          <Menu size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span className="font-titulo font-semibold text-panel-texto">Turnero</span>
      </div>

      {abierta && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setAbierta(false)}
          aria-hidden="true"
        />
      )}

      {/* Se muestra u oculta con display y no con un translate: la utilidad de
          transform no compone bien en este proyecto y la lateral quedaba
          visible sobre el contenido en pantallas chicas. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex-col bg-panel-nav lg:flex ${
          abierta ? "flex" : "hidden"
        }`}
      >
        <button
          type="button"
          onClick={() => setAbierta(false)}
          aria-label="Cerrar menú"
          className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-lg text-panel-nav-texto hover:bg-panel-nav-suave hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-nav-activo lg:hidden"
        >
          <X size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
        {contenido}
      </aside>
    </>
  )
}
