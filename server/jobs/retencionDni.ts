import { prisma } from "@/lib/db"
import { leerConfig } from "@/lib/config"

/** El turno queda; el dato personal no. Turno.dni es dato personal. */
export async function borrarDniVencidos(
  ahora: Date = new Date()
): Promise<{ borrados: number }> {
  const corte = new Date(ahora.getTime() - leerConfig().retencionDniDias * 24 * 60 * 60 * 1000)

  const { count } = await prisma.turno.updateMany({
    where: { createdAt: { lt: corte }, dni: { not: null } },
    data: { dni: null, nombreAfiliado: null },
  })

  return { borrados: count }
}
