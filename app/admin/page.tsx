import Link from "next/link"
import { ArrowRight, Building2, DoorOpen, FileText, Users } from "lucide-react"
import { prisma } from "@/lib/db"
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"

export default async function PaginaAdmin() {
  const actor = await actorActual()
  const puedeEditar = actor ? puedeEditarCatalogo(actor.rol) : false

  const [tramites, boxes, categorias, empleados] = await Promise.all([
    prisma.tramite.count({ where: { activo: true } }),
    prisma.box.count({ where: { activo: true } }),
    prisma.categoria.count({ where: { activa: true } }),
    prisma.empleado.count({ where: { activo: true } }),
  ])

  const tarjetas = [
    {
      href: "/admin/catalogo/tramites",
      titulo: "Trámites",
      cuantos: tramites,
      icono: FileText,
      pie: "Lo que el público elige en el tótem",
    },
    {
      href: "/admin/catalogo/boxes",
      titulo: "Boxes",
      cuantos: boxes,
      icono: DoorOpen,
      pie: "Puestos de atención habilitados",
    },
    {
      href: "/admin/catalogo/simples",
      titulo: "Categorías",
      cuantos: categorias,
      icono: Building2,
      pie: "Agrupan trámites en el tótem",
    },
    {
      href: puedeEditar ? "/admin/usuarios" : null,
      titulo: "Personas",
      cuantos: empleados,
      icono: Users,
      pie: "Con acceso al turnero",
    },
  ]

  return (
    <>
      <header className="mb-8">
        <h1 className="font-titulo text-2xl font-semibold text-panel-texto">
          {actor ? `Hola, ${actor.nombre.split(",")[1]?.trim() ?? actor.nombre}` : "Resumen"}
        </h1>
        <p className="mt-1 text-sm text-panel-texto-suave">
          Esto es lo que hay activo en el turnero ahora mismo.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => {
          const Icono = t.icono

          // Las mismas cifras se muestran a todos; solo el que puede editar
          // llega a la pantalla que hay detras.
          const cuerpo = (
            <>
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-panel-primario-suave text-panel-primario-fuerte">
                  <Icono size={20} strokeWidth={1.75} aria-hidden="true" />
                </div>
                {t.href && (
                  <ArrowRight
                    size={18}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className="text-panel-texto-suave transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-panel-primario-fuerte"
                  />
                )}
              </div>
              <p className="mt-4 font-titulo text-3xl font-semibold tabular-nums text-panel-texto">
                {t.cuantos}
              </p>
              <p className="mt-0.5 text-sm font-medium text-panel-texto">{t.titulo}</p>
              <p className="mt-1 text-xs text-panel-texto-suave">{t.pie}</p>
            </>
          )

          const clases = "rounded-xl border border-panel-borde bg-panel-superficie p-5 shadow-sm shadow-black/5"

          return t.href ? (
            <Link
              key={t.titulo}
              href={t.href}
              className={`group ${clases} transition-[box-shadow,border-color] duration-150 hover:border-panel-primario hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-panel-primario`}
            >
              {cuerpo}
            </Link>
          ) : (
            <div key={t.titulo} className={clases}>
              {cuerpo}
            </div>
          )
        })}
      </div>
    </>
  )
}
