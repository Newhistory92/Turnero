"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

// crypto.randomUUID solo existe en contexto seguro (HTTPS/localhost).
// En HTTP de red local (tótem) y en SSR no está disponible: fallback a Math.random.
function nuevoUuid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
    })
  }
}
import { crearTemporizadorInactividad } from "@/lib/kiosco/inactividad"
import { aplicarHardening } from "@/lib/kiosco/hardening"
import { generarTurnoPorSocket, conexionKiosco, type TurnoDelServidor } from "@/lib/kiosco/socket"
import { sePuedeRefrescar } from "@/lib/kiosco/catalogoVencido"
import { formatearDni } from "@/lib/kiosco/dni"
import { EncabezadoKiosco } from "./EncabezadoKiosco"
import { PieKiosco } from "./PieKiosco"
import { PantallaNoDisponible } from "./PantallaNoDisponible"
import { PasoDni } from "./pasos/PasoDni"
import { PasoCategoria } from "./pasos/PasoCategoria"
import { PasoTramite, type EstadoTramite } from "./pasos/PasoTramite"
import { PasoResultado } from "./pasos/PasoResultado"

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
  | { nombre: "error" }

/**
 * Lo que se muestra e imprime sale entero de la respuesta del servidor: el
 * numero, y la hora del createdAt de la fila. El reloj del totem no participa
 * (regla 6), y no hay numero en pantalla que no este guardado (regla 1).
 */
function aTurnoEmitido(
  turno: TurnoDelServidor,
  tramite: TramiteVista,
  dni: string,
  nombreAfiliado: string | null
): TurnoEmitido {
  const emitido = new Date(turno.createdAt)
  return {
    numero: turno.numero,
    nombreODni: nombreAfiliado ?? formatearDni(dni),
    tramite: tramite.nombre,
    destino: tramite.destino,
    hora: emitido.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    codigo: turno.id.slice(0, 8).toUpperCase(),
  }
}

export function Wizard({
  categorias,
  estadosTramites = {},
}: {
  categorias: CategoriaVista[]
  estadosTramites?: Record<string, EstadoTramite>
}) {
  const [paso, setPaso] = useState<Paso>({ nombre: "dni" })
  const [dni, setDni] = useState("")
  const [nombreAfiliado, setNombreAfiliado] = useState<string | null>(null)

  const reiniciar = useCallback(() => {
    if (catalogoVencido) {
      router.refresh()
      setCatalogoVencido(false)
    }
    setPaso({ nombre: "dni" })
    setDni("")
    // Borrar el DNI del usuario anterior no es UX, es privacidad.
    setNombreAfiliado(null)
  }, [catalogoVencido, router])

  const volver = useCallback(() => {
    setPaso((p) => {
      if (p.nombre === "tramite") return { nombre: "categoria" }
      if (p.nombre === "categoria") return { nombre: "dni" }
      return p
    })
  }, [])

  useEffect(() => aplicarHardening(), [])

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

  const router = useRouter()
  const [catalogoVencido, setCatalogoVencido] = useState(false)

  // El admin guardo un cambio. Si el kiosco esta ocioso se aplica ya; si hay
  // alguien usandolo, se anota y se aplica cuando vuelva al inicio.
  useEffect(() => {
    const s = conexionKiosco()
    const alCambiar = () => setCatalogoVencido(true)
    s.on("CATALOGO_ACTUALIZADO", alCambiar)
    return () => {
      s.off("CATALOGO_ACTUALIZADO", alCambiar)
    }
  }, [])

  useEffect(() => {
    if (!catalogoVencido) return
    if (!sePuedeRefrescar(paso.nombre, dni)) return

    setCatalogoVencido(false)
    // La pagina del kiosco es un Server Component: refresh vuelve a leer el
    // catalogo en el servidor y baja las categorias nuevas por props.
    router.refresh()
  }, [catalogoVencido, paso.nombre, dni, router])

  // Un requestId por sesion del wizard: si el toque se repite o la respuesta
  // se pierde, el servidor devuelve el mismo turno en vez de emitir otro.
  const [requestId, setRequestId] = useState(() => nuevoUuid())
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    if (paso.nombre === "dni") setRequestId(nuevoUuid())
  }, [paso.nombre])

  const elegirTramite = useCallback(
    async (t: TramiteVista) => {
      if (generando) return // primer toque gana; el requestId cubre el resto
      setGenerando(true)
      try {
        const r = await generarTurnoPorSocket({
          tramiteId: t.id,
          dni: dni || null,
          nombreAfiliado,
          requestId,
        })
        if (!r.ok) {
          setPaso({ nombre: "error" })
          return
        }
        setPaso({
          nombre: "resultado",
          turno: aTurnoEmitido(r.turno, t, dni, nombreAfiliado),
        })
      } finally {
        setGenerando(false)
      }
    },
    [dni, nombreAfiliado, requestId, generando]
  )

  return (
    <div
      className="flex h-full flex-col"
      data-paso={paso.nombre}
      data-testid="wizard"
    >
      <EncabezadoKiosco />

      <main className="flex-1">
        {paso.nombre === "dni" && (
          <PasoDni
            dni={dni}
            onCambioDni={setDni}
            nombre={nombreAfiliado}
            onNombre={setNombreAfiliado}
            onContinuar={() => setPaso({ nombre: "categoria" })}
          />
        )}

        {paso.nombre === "categoria" && (
          <PasoCategoria
            categorias={categorias}
            nombre={nombreAfiliado}
            onElegir={(c) => setPaso({ nombre: "tramite", categoria: c })}
          />
        )}

        {paso.nombre === "tramite" && (
          <PasoTramite
            categoria={paso.categoria}
            estados={estadosTramites}
            onElegir={elegirTramite}
          />
        )}

        {paso.nombre === "resultado" && (
          <PasoResultado turno={paso.turno} onTerminar={reiniciar} />
        )}

        {paso.nombre === "error" && <PantallaNoDisponible onReintentar={reiniciar} />}
      </main>

      <PieKiosco
        paso={paso.nombre}
        puedeVolver={paso.nombre === "categoria" || paso.nombre === "tramite"}
        onVolver={volver}
        onReiniciar={reiniciar}
      />

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
