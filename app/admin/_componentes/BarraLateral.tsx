"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  BarChart3,
  Building2,
  ChevronsLeft,
  ChevronsRight,
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

const CLAVE_COLAPSADA = "panel-lateral-colapsada"

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
  const [colapsada, setColapsada] = useState(false)
  const ruta = usePathname()

  // El ancho vive en una variable CSS y no en el estado de React: asi el
  // margen del contenido en layout.tsx (un Server Component que no conoce
  // este estado) se ajusta solo con CSS, sin prop drilling entre ambos.
  useEffect(() => {
    const guardada = localStorage.getItem(CLAVE_COLAPSADA) === "1"
    setColapsada(guardada)
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--panel-ancho-lateral",
      colapsada ? "80px" : "256px"
    )
    localStorage.setItem(CLAVE_COLAPSADA, colapsada ? "1" : "0")
  }, [colapsada])

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
      <div
        className={`flex items-center gap-2 px-4 py-6 ${colapsada ? "lg:justify-center lg:px-0" : ""}`}
      >
        {/* El cyan claro con texto blanco queda en 3.68:1, por debajo del
            minimo. El tono fuerte lo lleva a 5.37:1. */}
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-panel-primario-fuerte font-titulo text-lg font-bold text-white shadow-sm shadow-black/30">
          T
        </div>
        <div className={colapsada ? "lg:hidden" : ""}>
          <p className="font-titulo text-sm font-semibold text-white">Turnero</p>
          <p className="text-xs text-panel-nav-texto">Panel interno</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3">
        {grupos.map((g) => (
          <div key={g.titulo} className="mb-6">
            <p
              className={`px-3 pb-2 text-xs font-medium uppercase tracking-wider text-panel-nav-texto ${
                colapsada ? "lg:hidden" : ""
              }`}
            >
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
                      title={colapsada ? e.texto : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-nav-activo ${
                        colapsada ? "lg:justify-center lg:px-0" : ""
                      } ${
                        activo
                          ? "bg-panel-nav-suave font-medium text-panel-nav-activo"
                          : "text-panel-nav-texto hover:bg-panel-nav-suave hover:text-white"
                      }`}
                    >
                      <Icono size={18} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
                      <span className={colapsada ? "lg:hidden" : ""}>{e.texto}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-panel-nav-suave px-3 py-4">
        <div className={`px-3 pb-3 ${colapsada ? "lg:hidden" : ""}`}>
          <p className="truncate text-sm font-medium text-white">{nombre}</p>
          <p className="text-xs capitalize text-panel-nav-texto">{rol}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            title={colapsada ? "Cerrar sesión" : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-panel-nav-texto transition-colors duration-150 hover:bg-panel-nav-suave hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-nav-activo ${
              colapsada ? "lg:justify-center lg:px-0" : ""
            }`}
          >
            <LogOut size={18} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
            <span className={colapsada ? "lg:hidden" : ""}>Cerrar sesión</span>
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
          className="grid h-11 w-11 place-items-center rounded-lg text-panel-texto shadow-sm shadow-black/5 hover:bg-panel-fondo focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-primario"
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
          visible sobre el contenido en pantallas chicas. El ancho en lg lee
          la variable CSS que controla el colapso, sin transicion: animar un
          width que depende de una custom property con fallback se traba en
          el valor inicial en este motor (mismo tipo de problema que el de
          transform). El colapso es instantaneo pero confiable. */}
      <aside
        className={`panel-lateral fixed inset-y-0 left-0 z-50 flex-col bg-panel-nav lg:flex ${
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

        {/* Colapsar es una preferencia de escritorio: en mobile el drawer ya
            se cierra con la X de arriba, un segundo control haria lo mismo
            dos veces. */}
        <button
          type="button"
          onClick={() => setColapsada((v) => !v)}
          aria-label={colapsada ? "Expandir barra lateral" : "Ocultar barra lateral"}
          className="absolute -right-3 top-6 hidden h-6 w-6 place-items-center rounded-full border border-panel-nav-suave bg-panel-nav text-panel-nav-texto shadow-md shadow-black/30 transition-colors duration-150 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-nav-activo lg:grid"
        >
          {colapsada ? (
            <ChevronsRight size={14} strokeWidth={2} aria-hidden="true" />
          ) : (
            <ChevronsLeft size={14} strokeWidth={2} aria-hidden="true" />
          )}
        </button>

        {contenido}
      </aside>
    </>
  )
}
