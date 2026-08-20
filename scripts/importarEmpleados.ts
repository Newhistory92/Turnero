import { prisma } from "@/lib/db"
import { importarEmpleados } from "@/lib/admin/importacion"

// Uso: npm run importar:empleados -- silviaflores gonzalotello
const usuarios = process.argv.slice(2)

if (usuarios.length === 0) {
  console.error("Pasá al menos un nombreUsuario. Ej: npm run importar:empleados -- silviaflores")
  process.exit(1)
}

importarEmpleados(usuarios)
  .then((r) => {
    console.log(`Creados: ${r.creados} · Actualizados: ${r.actualizados}`)
    if (r.noEncontrados.length > 0) {
      console.warn(`No encontrados (no son empleados o están anulados): ${r.noEncontrados.join(", ")}`)
    }
  })
  .catch((e) => {
    console.error("Falló la importación:", e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
