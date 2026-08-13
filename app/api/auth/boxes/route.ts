import { NextResponse } from "next/server"
import { verificarCredencial } from "@/lib/auth/institucional"
import { boxesDe } from "@/lib/auth/operador"

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

  const boxes = await boxesDe(credencial.usuario.documento)
  if (boxes.length === 0) {
    return NextResponse.json(
      { ok: false, mensaje: "Tu usuario es válido pero no estás habilitado en el turnero" },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true, boxes })
}
