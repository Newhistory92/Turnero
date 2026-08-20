import { NextResponse } from "next/server"
import { verificarCredencial } from "@/lib/auth/institucional"
import { accesoDe } from "@/lib/auth/operador"
import { puedeVerCatalogo, puedeVerTablero } from "@/lib/admin/acceso"

export async function POST(req: Request) {
  const { usuario, clave } = await req.json()
  if (!usuario || !clave) {
    return NextResponse.json({ ok: false, mensaje: "Faltan datos" }, { status: 400 })
  }

  const credencial = await verificarCredencial(usuario, clave)
  if (!credencial.ok) {
    return NextResponse.json(
      { ok: false, mensaje: credencial.mensaje },
      { status: 401 }
    )
  }

  const { boxes, rol } = await accesoDe(credencial.usuario.documento)
  const panel = rol !== null && (puedeVerCatalogo(rol) || puedeVerTablero(rol))

  // Sin boxes y sin panel no hay nada que ofrecerle.
  if (boxes.length === 0 && !panel) {
    return NextResponse.json(
      { ok: false, mensaje: "Tu usuario es válido pero no estás habilitado en el turnero" },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true, boxes, panel, rol })
}
