

export async function guardarTurnoEnBackend({
        numero,
        servicio,
        departamento,
        timestamp,
        estado,
        boxAsignado
}: {
  numero: string
  departamento: string
  servicio: string
  timestamp: Date
  estado: string
  boxAsignado?:string

}) {
  try {
    const response = await fetch("/api/turnos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ numero, departamento, servicio, timestamp, estado,boxAsignado }),
    })

    if (!response.ok) {
      console.error("Error al guardar turno en backend", await response.text())
    }
  } catch (error) {
    console.error("Error de red al guardar turno:", error)
  }
}
