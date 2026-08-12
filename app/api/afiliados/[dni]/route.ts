import { NextResponse } from "next/server"
import {
  crearRepositorioAfiliados,
  conTimeout,
  TIMEOUT_AFILIADO_MS,
} from "@/lib/afiliados/repositorio"

const repositorio = crearRepositorioAfiliados()

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dni: string }> }
) {
  const { dni } = await params
  const limpio = dni.replace(/\D/g, "")

  if (limpio.length < 7) return NextResponse.json({ nombre: null })

  const afiliado = await conTimeout(repositorio.buscarPorDni(limpio), TIMEOUT_AFILIADO_MS)
  return NextResponse.json({ nombre: afiliado?.nombre ?? null })
}
