import { prisma } from "@/lib/db"

export interface ComandoLatido {
  id: string
  version: string
  errorImpresion?: string | null
}

export async function registrarLatido(cmd: ComandoLatido): Promise<void> {
  await prisma.kiosco.upsert({
    where: { id: cmd.id },
    create: {
      id: cmd.id,
      nombre: cmd.id,
      version: cmd.version,
      ultimoLatido: new Date(),
      ultimoErrorImpresion: cmd.errorImpresion ?? null,
    },
    update: {
      version: cmd.version,
      ultimoLatido: new Date(),
      ...(cmd.errorImpresion !== undefined
        ? { ultimoErrorImpresion: cmd.errorImpresion }
        : {}),
    },
  })
}
