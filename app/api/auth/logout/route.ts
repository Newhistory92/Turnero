import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { cerrarSesion, leerCookie, NOMBRE_COOKIE } from "@/lib/auth/sesion"

export async function POST() {
  const almacen = await cookies()
  const sesionId = leerCookie(almacen.get(NOMBRE_COOKIE)?.value)
  if (sesionId) await cerrarSesion(sesionId)

  const res = NextResponse.json({ ok: true })
  res.cookies.delete(NOMBRE_COOKIE)
  return res
}
