"use client"

import { useCallback, useState } from "react"

export interface TramiteVista {
  id: string
  nombre: string
  subtitulo: string
  icono: string
  destino: { ala: string; piso: string }
}

export interface CategoriaVista {
  id: string
  nombre: string
  icono: string
  tramites: TramiteVista[]
}

export interface TurnoEmitido {
  numero: string
  nombreODni: string
  tramite: string
  destino: { ala: string; piso: string }
  hora: string
  codigo: string
}

type Paso =
  | { nombre: "dni" }
  | { nombre: "categoria" }
  | { nombre: "tramite"; categoria: CategoriaVista }
  | { nombre: "resultado"; turno: TurnoEmitido }

export function Wizard({ categorias }: { categorias: CategoriaVista[] }) {
  const [paso, setPaso] = useState<Paso>({ nombre: "dni" })
  const [dni, setDni] = useState("")
  const [nombreAfiliado, setNombreAfiliado] = useState<string | null>(null)

  const reiniciar = useCallback(() => {
    setPaso({ nombre: "dni" })
    setDni("")
    // Borrar el DNI del usuario anterior no es UX, es privacidad.
    setNombreAfiliado(null)
  }, [])

  const volver = useCallback(() => {
    setPaso((p) => {
      if (p.nombre === "tramite") return { nombre: "categoria" }
      if (p.nombre === "categoria") return { nombre: "dni" }
      return p
    })
  }, [])

  return (
    <div
      className="flex h-full flex-col"
      data-paso={paso.nombre}
      data-testid="wizard"
    >
      {/* Los pasos se agregan en las tareas 3 a 7 */}
    </div>
  )
}
