import { prisma } from "@/lib/db"

/**
 * Corre a hora fija y no al cerrar el ultimo box: "cerrado" solo detiene la
 * emision de tickets, y los turnos en cola se siguen atendiendo despues del
 * horario.
 *
 * Los "atendiendo" huerfanos son los que quedaron abiertos porque el operador
 * se fue sin finalizarlos. estado.ts no tiene salida de atendiendo salvo
 * finalizado y derivado, y agregar un estado obligaria a una migracion que SP2
 * no necesita, asi que se cierran como finalizado con un evento "revision".
 * SP5 debe excluir de las metricas de duracion los turnos con ese evento: su
 * tiempo medido no corresponde a una atencion real.
 */
export async function marcarAbandonados(
  fecha: Date = new Date()
): Promise<{ abandonados: number; huerfanos: number }> {
  const dia = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()))

  const { count: abandonados } = await prisma.turno.updateMany({
    where: { fecha: dia, estado: "esperando" },
    data: { estado: "abandonado" },
  })

  const huerfanos = await prisma.turno.findMany({
    where: { fecha: dia, estado: "atendiendo" },
    select: { id: true, boxId: true },
  })

  for (const t of huerfanos) {
    await prisma.$transaction([
      prisma.turno.update({ where: { id: t.id }, data: { estado: "finalizado" } }),
      prisma.turnoEvento.create({
        data: {
          turnoId: t.id,
          tipo: "revision",
          boxId: t.boxId,
          detalle: "cerrado por el job diario: quedó en atendiendo sin finalizar",
        },
      }),
    ])
  }

  return { abandonados, huerfanos: huerfanos.length }
}
