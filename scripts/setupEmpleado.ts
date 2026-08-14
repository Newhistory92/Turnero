import { PrismaClient } from "@prisma/client"

async function main() {
  const p = new PrismaClient()
  const emp = await p.empleado.findFirst({ where: { dniInstitucional: "01234567" } })
  if (!emp) { console.log("No se encontró empleado con DNI 01234567"); await p.$disconnect(); return }

  const box = await p.box.findFirst({ orderBy: { nombre: "asc" } })
  if (!box) { console.log("No hay boxes"); await p.$disconnect(); return }

  await p.empleadoBox.upsert({
    where: { empleadoId_boxId: { empleadoId: emp.id, boxId: box.id } },
    create: { empleadoId: emp.id, boxId: box.id },
    update: {},
  })

  const resultado = await p.empleado.findFirst({
    where: { id: emp.id },
    include: { boxes: { include: { box: true } } },
  })
  console.log("Empleado:", resultado?.nombre, "| DNI:", resultado?.dniInstitucional)
  console.log("Box asignado:", resultado?.boxes.map(b => b.box.nombre).join(", "))
  await p.$disconnect()
}

main()
