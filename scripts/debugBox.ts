import { PrismaClient } from "@prisma/client"

async function main() {
const p = new PrismaClient()

const emp = await p.empleado.findFirst({
  where: { dniInstitucional: "01234567" },
  include: { boxes: { include: { box: { include: { tramites: { include: { tramite: true } } } } } } }
})

const box = emp?.boxes[0]?.box
console.log("Box del operador:", box?.nombre, "| id:", box?.id)
console.log("Trámites del box:", box?.tramites.map(t => t.tramite.nombre).join(", ") || "NINGUNO")

const hoy = new Date()
const dia = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
const turnos = await p.turno.findMany({
  where: { fecha: dia, estado: { in: ["esperando", "llamado", "atendiendo", "ausente"] } },
  include: { tramite: true },
})
console.log("\nTurnos activos hoy:")
if (turnos.length === 0) console.log("  (ninguno)")
for (const t of turnos) console.log(" ", t.numero, t.tramite.nombre, "[" + t.estado + "]", "boxId:", t.boxId)

// Ver si los tramites del box coinciden con los de los turnos
if (box && turnos.length > 0) {
  const tramiteIds = new Set(box.tramites.map(t => t.tramiteId))
  const coinciden = turnos.filter(t => tramiteIds.has(t.tramiteId))
  console.log("\nTurnos que SÍ debería ver este box:", coinciden.length)
}

await p.$disconnect()
}
main()
