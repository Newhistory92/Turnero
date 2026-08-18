import Link from "next/link"
import { prisma } from "@/lib/db"

export default async function PaginaAdmin() {
  const [tramites, boxes, categorias] = await Promise.all([
    prisma.tramite.count({ where: { activo: true } }),
    prisma.box.count({ where: { activo: true } }),
    prisma.categoria.count({ where: { activa: true } }),
  ])

  const tarjetas = [
    { href: "/admin/catalogo/tramites", titulo: "Trámites", cuantos: tramites },
    { href: "/admin/catalogo/boxes", titulo: "Boxes", cuantos: boxes },
    { href: "/admin/catalogo/simples", titulo: "Categorías", cuantos: categorias },
  ]

  return (
    <>
      <h1 className="mb-6 font-titulo text-2xl font-semibold">Catálogo</h1>
      <div className="grid grid-cols-3 gap-4">
        {tarjetas.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-xl border border-gainsboro bg-white p-6 hover:border-gris-principal"
          >
            <p className="text-3xl font-semibold">{t.cuantos}</p>
            <p className="mt-1 text-sm text-gris-principal">{t.titulo} activos</p>
          </Link>
        ))}
      </div>
    </>
  )
}
