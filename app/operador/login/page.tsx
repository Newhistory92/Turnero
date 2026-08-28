"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Box {
  id: string
  nombre: string
}

const PANEL = "__panel__"

export default function LoginOperador() {
  const router = useRouter()
  const [usuario, setUsuario] = useState("")
  const [clave, setClave] = useState("")
  const [boxes, setBoxes] = useState<Box[] | null>(null)
  const [panel, setPanel] = useState(false)
  const [destino, setDestino] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function pedirAcceso(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const r = await fetch("/api/auth/boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, clave }),
      })
      const datos = await r.json()
      if (!datos.ok) {
        setError(datos.mensaje)
        return
      }
      setBoxes(datos.boxes)
      setPanel(datos.panel)
      // Un solo destino posible no merece que la persona elija.
      if (datos.boxes.length === 1 && !datos.panel) setDestino(datos.boxes[0].id)
      if (datos.boxes.length === 0 && datos.panel) setDestino(PANEL)
    } catch {
      setError("No se pudo conectar con el servidor")
    } finally {
      setEnviando(false)
    }
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario,
          clave,
          boxId: destino === PANEL ? null : destino,
        }),
      })
      const datos = await r.json()
      if (!datos.ok) {
        setError(datos.mensaje)
        return
      }
      if (destino === PANEL) {
        // director puede ver el tablero pero no el catálogo.
        const puedeAdmin = datos.rol === "admin" || datos.rol === "supervisor"
        router.push(puedeAdmin ? "/admin" : "/tablero")
      } else {
        router.push("/operador")
      }
    } catch {
      setError("No se pudo conectar con el servidor")
    } finally {
      setEnviando(false)
    }
  }

  const campo =
    "w-full rounded-xl border-2 border-gris-70 bg-white px-4 py-3 text-lg " +
    "focus:border-gris-principal focus:outline-none"

  const eligiendo = boxes !== null

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="mb-8 flex items-center gap-3">
        <h1 className="font-titulo text-3xl font-semibold">Turnero</h1>
        {error && (
          <img
            src="/gmdKBCklQ7ElxAN7oH.webp"
            alt=""
            aria-hidden="true"
            className="h-14 w-14 animate-in zoom-in-75 fade-in duration-200"
          />
        )}
      </div>

      <form onSubmit={eligiendo ? entrar : pedirAcceso} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Usuario</span>
          <input
            className={campo}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            disabled={eligiendo}
            required
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Contraseña</span>
          <input
            className={campo}
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete="current-password"
            disabled={eligiendo}
            required
          />
        </label>

        {eligiendo && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Dónde entrar</span>
            <select
              className={campo}
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              required
            >
              <option value="">Elegí un destino</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
              {panel && <option value={PANEL}>Panel de administración</option>}
            </select>
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-osp px-4 py-3 text-white">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando || (eligiendo && !destino)}
          className="mt-2 rounded-xl bg-gris-principal px-6 py-4 text-lg font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
        >
          {enviando ? "Un momento…" : eligiendo ? "Entrar" : "Continuar"}
        </button>
      </form>
    </main>
  )
}
