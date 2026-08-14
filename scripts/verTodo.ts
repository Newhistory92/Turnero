import { PrismaClient } from "@prisma/client"

async function main() {
  const p = new PrismaClient()

  const boxes = await p.box.findMany({
    include: { tramites: { include: { tramite: { include: { categoria: true } } } } },
    orderBy: { nombre: "asc" },
  })

  for (const b of boxes) {
    console.log(`\n[${b.nombre}] id: ${b.id}`)
    for (const bt of b.tramites) {
      console.log(`  - ${bt.tramite.categoria.nombre} > ${bt.tramite.nombre}`)
    }
  }

  await p.$disconnect()
}
main()
