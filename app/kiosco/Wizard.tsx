"use client"

import { useCallback, useEffect, useState } from "react"
import { crearTemporizadorInactividad } from "@/lib/kiosco/inactividad"

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

  const [avisoInactividad, setAvisoInactividad] = useState(false)

  useEffect(() => {
    const temporizador = crearTemporizadorInactividad({
      onAviso: () => setAvisoInactividad(true),
      onExpirar: () => {
        setAvisoInactividad(false)
        reiniciar()
      },
    })
    temporizador.iniciar()

    const actividad = () => {
      setAvisoInactividad(false)
      temporizador.registrarActividad()
    }
    window.addEventListener("pointerdown", actividad)

    return () => {
      window.removeEventListener("pointerdown", actividad)
      temporizador.detener()
    }
  }, [reiniciar])

  return (
    <div
      className="flex h-full flex-col"
      data-paso={paso.nombre}
      data-testid="wizard"
    >
      {/* Los pasos se agregan en las tareas 3 a 7 */}

      {avisoInactividad && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/60"
          data-testid="aviso-inactividad"
        >
          <div className="flex flex-col items-center gap-8 rounded-3xl bg-white p-16 text-center">
            <p className="text-k-titulo font-titulo">¿Sigue ahí?</p>
            <button
              type="button"
              onClick={() => setAvisoInactividad(false)}
              className="rounded-2xl bg-gris-principal px-12 py-6 text-k-sub text-white"
            >
              Sí, continuar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
