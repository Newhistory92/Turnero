import { NextResponse } from "next/server"
import { login } from "@/lib/auth/operador"
import { firmarCookie, NOMBRE_COOKIE } from "@/lib/auth/sesion"

export async function POST(req: Request) {
  const { usuario, clave, boxId } = await req.json()

  // boxId null es explicito: es la sesion del panel. Undefined es un dato
  // que falta, y eso si es un error del cliente.
  if (!usuario || !clave || boxId === undefined) {
    return NextResponse.json({ ok: false, mensaje: "Faltan datos" }, { status: 400 })
  }

  const r = await login(usuario, clave, boxId)
  if (!r.ok) {
    return NextResponse.json({ ok: false, codigo: r.codigo, mensaje: r.mensaje }, { status: 401 })
  }

  const res = NextResponse.json({
    ok: true,
    empleado: r.empleado,
    boxId: r.boxId,
    rol: r.rol,
  })
  res.cookies.set(NOMBRE_COOKIE, firmarCookie(r.sesionId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 5 * 60 * 60, // 5 horas
    // secure queda en false a proposito: el totem y los mostradores acceden
    // por HTTP en la red interna, y con secure la cookie no viajaria.
    secure: false,
  })
  return res
}
