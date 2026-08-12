"use client"

import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { TecladoNumerico } from "./TecladoNumerico"
import { formatearDni, dniEsValido, MIN_DIGITOS_DNI } from "@/lib/kiosco/dni"

interface Props {
  dni: string
  onCambioDni: (dni: string) => void
  nombre: string | null
  onNombre: (n: string | null) => void
  onContinuar: () => void
}

export function PasoDni({ dni, onCambioDni, nombre, onNombre, onContinuar }: Props) {
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (dni.length < MIN_DIGITOS_DNI) {
      onNombre(null)
      return
    }

    const control = new AbortController()
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const r = await fetch(`/api/afiliados/${dni}`, { signal: control.signal })
        const { nombre } = await r.json()
        onNombre(nombre)
      } catch {
        // La busqueda nunca bloquea el flujo.
        onNombre(null)
      } finally {
        setBuscando(false)
      }
    }, 400)

    return () => {
      clearTimeout(t)
      control.abort()
    }
  }, [dni, onNombre])

  return (
    <div className="grid h-full grid-cols-2">
      <section className="flex flex-col justify-center px-16">
        <h1 className="text-k-pregunta font-titulo">Ingrese su DNI</h1>

        <p
          className="mt-12 font-mono text-[72px] tabular-nums tracking-wide"
          data-testid="dni-visible"
          aria-live="polite"
        >
          {formatearDni(dni) || <span className="text-gris-70">—</span>}
        </p>
        <div className="h-1 w-full max-w-[520px] bg-gris-principal" />

        {nombre && !buscando && (
          <p className="mt-12 flex items-center gap-4 text-k-titulo" data-testid="saludo">
            <CheckCircle2 className="h-12 w-12 text-gris-80" aria-hidden />
            Bienvenido, {nombre}
          </p>
        )}
      </section>

      <section className="flex items-center justify-center">
        <TecladoNumerico
          valor={dni}
          onCambio={onCambioDni}
          onConfirmar={onContinuar}
          puedeConfirmar={dniEsValido(dni)}
        />
      </section>
    </div>
  )
}
