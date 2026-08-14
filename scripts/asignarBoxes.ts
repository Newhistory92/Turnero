import { PrismaClient } from "@prisma/client"

async function main() {
  const p = new PrismaClient()

  const emp = await p.empleado.findFirstOrThrow({ where: { dniInstitucional: "01234567" } })

  // Box 1 Auditoría Médica (Prótesis) + Box 2 Auditoría Médica (Planes Especiales)
  // + Box 1 Prácticas y Estudios (ya lo tiene)
  const boxIds = [
    "089342ed-7a33-4e8d-97e6-9e6dc1928e21", // Box 1 – Prácticas y Estudios
    "13ae9f9a-8f5f-4b30-b3ba-8b88579bf58c", // Box 1 – Auditoría Médica (Prótesis)
    "008d4e5a-00cf-4776-92db-15e501eb3aa9", // Box 2 – Auditoría Médica (Planes Especiales)
  ]

  for (const boxId of boxIds) {
    await p.empleadoBox.upsert({
      where: { empleadoId_boxId: { empleadoId: emp.id, boxId } },
      create: { empleadoId: emp.id, boxId },
      update: {},
    })
  }

  const resultado = await p.empleado.findFirst({
    where: { id: emp.id },
    include: { boxes: { include: { box: { include: { tramites: { include: { tramite: true } } } } } } },
  })

  console.log("Boxes asignados:")
  for (const eb of resultado!.boxes) {
    console.log(`  - ${eb.box.nombre} (${eb.box.tramites.map(t => t.tramite.nombre).join(", ")})`)
  }

  await p.$disconnect()
}
main()
