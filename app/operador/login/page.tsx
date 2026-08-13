"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Box {
  id: string
  nombre: string
}

export default function LoginOperador() {
  const router = useRouter()
  const [usuario, setUsuario] = useState("")
  const [clave, setClave] = useState("")
  const [boxes, setBoxes] = useState<Box[] | null>(null)
  const [boxId, setBoxId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function pedirBoxes(e: React.FormEvent) {
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
      if (datos.boxes.length === 1) setBoxId(datos.boxes[0].id)
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
        body: JSON.stringify({ usuario, clave, boxId }),
      })
      const datos = await r.json()
      if (!datos.ok) {
        setError(datos.mensaje)
        return
      }
      router.push("/operador")
    } catch {
      setError("No se pudo conectar con el servidor")
    } finally {
      setEnviando(false)
    }
  }

  const campo =
    "w-full rounded-xl border-2 border-gris-70 bg-white px-4 py-3 text-lg " +
    "focus:border-gris-principal focus:outline-none"

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="mb-8 font-titulo text-3xl font-semibold">Panel de operador</h1>

      <form onSubmit={boxes ? entrar : pedirBoxes} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Usuario</span>
          <input
            className={campo}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            disabled={!!boxes}
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
            disabled={!!boxes}
            required
          />
        </label>

        {boxes && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Box</span>
            <select
              className={campo}
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
              required
            >
              <option value="">Elegí un box</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
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
          disabled={enviando || (!!boxes && !boxId)}
          className="mt-2 rounded-xl bg-gris-principal px-6 py-4 text-lg font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
        >
          {enviando ? "Un momento…" : boxes ? "Entrar al box" : "Continuar"}
        </button>
      </form>
    </main>
  )
}
