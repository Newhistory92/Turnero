import { type NextRequest, NextResponse } from "next/server"
import { prisma, executePrismaOperation } from "@/app/config/primsma"

export async function POST(request: NextRequest) {
  return executePrismaOperation(async () => {
    try {
      const body = await request.json()

      const {
        numero,
        servicio,
        departamento,
        timestamp,
        estado,
      }: {
        numero: string
        departamento: string
        servicio: string
        timestamp: number
        estado: string
        boxAsignado:string | undefined
      } = body
      if (  !numero || !servicio || !departamento || !timestamp) {
        return NextResponse.json(
          { success: false, error: "Faltan datos requeridos" },
          { status: 400 }
        )
      }

      await prisma.$executeRaw`
        INSERT INTO Turno ( numero, servicio, departamento, estado, timestamp)
        VALUES (${numero}, ${servicio}, ${departamento}, ${estado},${timestamp})
      `

      console.log("✅ Turno insertado correctamente:", numero)

      return NextResponse.json({ success: true, message: "Turno generado correctamente" }, { status: 201 })
    } catch (error) {
      console.error("❌ Error al insertar turno:", error)
      return NextResponse.json({ success: false, error: "Error al generar el turno" }, { status: 500 })
    }
  })
}


export async function GET() {
  return executePrismaOperation(async () => {
    try {
      const turnos = await prisma.$queryRaw<
        {
          id: number
          numero: string
          servicio: string
          departamento: string
          estado: string
          boxAsignado: string | null
          timestamp: Date
        }[]
      >`
        SELECT * 
        FROM Turno 
        WHERE CONVERT(date, timestamp) = CONVERT(date, GETDATE())
        ORDER BY timestamp ASC
      `

      return NextResponse.json({ success: true, data: turnos }, { status: 200 })
    } catch (error) {
      console.error("❌ Error al obtener turnos:", error)
      return NextResponse.json({ success: false, error: "Error al obtener turnos" }, { status: 500 })
    }
  })
}
