import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { slug } from "@/server/rooms"
import { PantallaAla } from "./PantallaAla"

// Cada TV arranca Chrome apuntado a su URL: /pantalla/norte o /pantalla/sur.
export default async function PaginaPantalla({
  params,
}: {
  params: Promise<{ ala: string }>
}) {
  const { ala } = await params

  // Se resuelve contra la base y se pasa el nombre real, no el slug: el room
  // lo calcula el servidor con la misma slug() de rooms.ts.
  const alas = await prisma.ala.findMany({ select: { nombre: true } })
  const encontrada = alas.find((a) => slug(a.nombre) === ala.toLowerCase())
  if (!encontrada) notFound()

  return <PantallaAla ala={encontrada.nombre} />
}
