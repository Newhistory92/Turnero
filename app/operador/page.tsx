import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { leerCookie, NOMBRE_COOKIE, sesionActiva } from "@/lib/auth/sesion"
import { PanelOperador } from "./PanelOperador"

export default async function PaginaOperador() {
  const almacen = await cookies()
  const sesionId = leerCookie(almacen.get(NOMBRE_COOKIE)?.value)
  const sesion = sesionId ? await sesionActiva(sesionId) : null
  if (!sesion) redirect("/operador/login")

  return <PanelOperador />
}
