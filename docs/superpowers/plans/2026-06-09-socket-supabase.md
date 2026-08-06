# Socket.io + Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un servidor Node.js (`server.ts`) que integre Next.js + Socket.io + Supabase, reemplazando el estado en memoria y la conexión WebSocket nativa actual, y mostrando el estado de conexión a Supabase en la UI.

**Architecture:** Un proceso único corre Next.js y Socket.io sobre el mismo servidor HTTP. El servidor conecta a Supabase al iniciar, persiste todos los eventos de turno, y emite `SUPABASE_STATUS` a los clientes. El contexto React (`turno-context.tsx`) pasa de WebSocket nativo a socket.io-client.

**Tech Stack:** Node.js + TypeScript, Next.js 15, Socket.io 4, @supabase/supabase-js, tsx (runner)

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `server.ts` | CREAR | Servidor HTTP + Socket.io + Supabase. Entry point del proceso. |
| `lib/supabase.ts` | CREAR | Cliente Supabase (service_role). Solo se importa en server.ts. |
| `lib/turno-context.tsx` | MODIFICAR | Reemplazar WebSocket nativo por socket.io-client. Agregar `supabaseConnected`. |
| `.env.local` | CREAR | Variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. |
| `package.json` | MODIFICAR | Scripts `dev` y `start` usan `tsx server.ts`. |
| `components/supabase-status.tsx` | CREAR | Badge visual verde/rojo de conexión a Supabase. |
| `app/layout.tsx` | MODIFICAR | Agregar `<SupabaseStatus />` en el layout. |

---

## Task 1: Instalar dependencias

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar @supabase/supabase-js y tsx**

Ejecutar en la raíz del proyecto (`D:\Mi Documentos\Documents\Turnero`):

```bash
npm install @supabase/supabase-js
npm install --save-dev tsx
```

- [ ] **Step 2: Verificar instalación**

```bash
npm list @supabase/supabase-js tsx
```

Expected output (versiones pueden variar):
```
turnero@0.1.0
├── @supabase/supabase-js@2.x.x
└── tsx@4.x.x
```

---

## Task 2: Crear variables de entorno

**Files:**
- Create: `.env.local`

- [ ] **Step 1: Crear archivo .env.local en la raíz del proyecto**

Crear `D:\Mi Documentos\Documents\Turnero\.env.local` con este contenido exacto:

```env
SUPABASE_URL=https://zpleuaekkxohguuwxoxt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwbGV1YWVra3hvaGd1dXd4b3h0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA0Mzg4MywiZXhwIjoyMDk2NjE5ODgzfQ.RGhqe_fh5DFDklXzIjshK4lJITM1T82X3q9hMQBCT90
```

- [ ] **Step 2: Verificar que .env.local no está en git**

```bash
cat .gitignore | grep env
```

Expected: debe aparecer `.env.local` o `*.local` o `.env*`. Si no aparece, agregar `.env.local` al `.gitignore`.

---

## Task 3: Crear tablas en Supabase

**Files:**
- SQL ejecutado en Supabase Dashboard → SQL Editor

- [ ] **Step 1: Abrir Supabase SQL Editor**

Ir a https://supabase.com/dashboard/project/zpleuaekkxohguuwxoxt/sql/new

- [ ] **Step 2: Ejecutar SQL para crear tablas**

Copiar y ejecutar este SQL completo:

```sql
-- Tabla de turnos
CREATE TABLE IF NOT EXISTS turnos (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  servicio TEXT NOT NULL,
  departamento TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado TEXT NOT NULL DEFAULT 'esperando',
  box_asignado TEXT,
  tiempo_llamado TIMESTAMPTZ,
  tiempo_atencion INTEGER
);

-- Tabla de contadores por servicio
CREATE TABLE IF NOT EXISTS contadores (
  servicio TEXT PRIMARY KEY,
  valor INTEGER NOT NULL DEFAULT 0
);

-- Insertar contadores iniciales
INSERT INTO contadores (servicio, valor) VALUES
  ('auditoria', 0),
  ('planes', 0),
  ('social', 0),
  ('personalizada', 0),
  ('emision_carnet', 0),
  ('atencion_personalizada_afiliaciones', 0),
  ('control_aportes', 0),
  ('inicio_expediente', 0)
ON CONFLICT (servicio) DO NOTHING;

-- Tabla de empleados
CREATE TABLE IF NOT EXISTS empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  box_id TEXT NOT NULL UNIQUE
);

-- Tabla de registros de atención
CREATE TABLE IF NOT EXISTS registros_atencion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_turno TEXT NOT NULL,
  servicio TEXT NOT NULL,
  departamento TEXT NOT NULL,
  box_asignado TEXT NOT NULL,
  empleado_id UUID REFERENCES empleados(id),
  tiempo_atencion INTEGER NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 3: Verificar que las tablas se crearon**

En el SQL Editor ejecutar:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected: ver `contadores`, `empleados`, `registros_atencion`, `turnos`.

---

## Task 4: Crear cliente Supabase

**Files:**
- Create: `lib/supabase.ts`

- [ ] **Step 1: Crear lib/supabase.ts**

```typescript
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase.ts .env.local .gitignore
git commit -m "feat: add supabase client and env config"
```

---

## Task 5: Crear server.ts

**Files:**
- Create: `server.ts`

- [ ] **Step 1: Crear server.ts en la raíz del proyecto**

```typescript
import { createServer } from "http"
import { Server } from "socket.io"
import next from "next"
import { supabase } from "./lib/supabase"

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Prefijos por servicio
const PREFIJOS: Record<string, string> = {
  auditoria: "A",
  planes: "P",
  social: "S",
  personalizada: "T",
  emision_carnet: "C",
  atencion_personalizada_afiliaciones: "AP",
  control_aportes: "CA",
  inicio_expediente: "E",
}

async function loadStateFromSupabase() {
  const [{ data: turnos }, { data: contadoresRows }, { data: registros }] =
    await Promise.all([
      supabase.from("turnos").select("*").order("timestamp", { ascending: true }),
      supabase.from("contadores").select("*"),
      supabase.from("registros_atencion").select("*").order("fecha", { ascending: false }).limit(100),
    ])

  const contadores: Record<string, number> = {}
  for (const row of contadoresRows ?? []) {
    contadores[row.servicio] = row.valor
  }

  return {
    turnos: (turnos ?? []).map((t) => ({
      id: t.id,
      numero: t.numero,
      servicio: t.servicio,
      departamento: t.departamento,
      timestamp: t.timestamp,
      estado: t.estado,
      boxAsignado: t.box_asignado,
      tiempoLlamado: t.tiempo_llamado,
      tiempoAtencion: t.tiempo_atencion,
    })),
    turnoActual:
      (turnos ?? [])
        .filter((t) => t.estado === "llamado")
        .map((t) => ({
          id: t.id,
          numero: t.numero,
          servicio: t.servicio,
          departamento: t.departamento,
          timestamp: t.timestamp,
          estado: t.estado,
          boxAsignado: t.box_asignado,
          tiempoLlamado: t.tiempo_llamado,
          tiempoAtencion: t.tiempo_atencion,
        }))[0] ?? null,
    contadores,
    registrosAtencion: (registros ?? []).map((r) => ({
      id: r.id,
      numeroTurno: r.numero_turno,
      servicio: r.servicio,
      departamento: r.departamento,
      boxAsignado: r.box_asignado,
      empleado: r.empleado_id ?? "",
      tiempoAtencion: r.tiempo_atencion,
      fecha: r.fecha,
    })),
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res))

  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  })

  let supabaseConnected = false

  async function checkSupabase() {
    try {
      const { error } = await supabase.from("contadores").select("servicio").limit(1)
      supabaseConnected = !error
    } catch {
      supabaseConnected = false
    }
    console.log(`🗄️  Supabase: ${supabaseConnected ? "✅ conectado" : "❌ desconectado"}`)
    io.emit("SUPABASE_STATUS", { connected: supabaseConnected })
  }

  io.on("connection", async (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`)

    // Enviar estado de Supabase inmediatamente
    socket.emit("SUPABASE_STATUS", { connected: supabaseConnected })

    // Enviar estado actual desde Supabase
    try {
      const state = await loadStateFromSupabase()
      socket.emit("STATE_UPDATE", { state })
    } catch (err) {
      console.error("Error cargando estado inicial:", err)
    }

    // Generar turno
    socket.on("GENERAR_TURNO", async ({ servicio, departamento }) => {
      try {
        const { data: contador } = await supabase
          .from("contadores")
          .select("valor")
          .eq("servicio", servicio)
          .single()

        const nuevoValor = (contador?.valor ?? 0) + 1
        const prefijo = PREFIJOS[servicio] ?? "X"
        const numero = `${prefijo}${nuevoValor.toString().padStart(2, "0")}`
        const id = `${servicio}-${nuevoValor}`

        await supabase.from("turnos").insert({
          id,
          numero,
          servicio,
          departamento,
          timestamp: new Date().toISOString(),
          estado: "esperando",
        })

        await supabase
          .from("contadores")
          .update({ valor: nuevoValor })
          .eq("servicio", servicio)

        const state = await loadStateFromSupabase()
        io.emit("STATE_UPDATE", { state })
      } catch (err) {
        console.error("Error generando turno:", err)
      }
    })

    // Llamar turno
    socket.on("LLAMAR_TURNO", async ({ turnoId, boxAsignado }) => {
      try {
        await supabase
          .from("turnos")
          .update({
            estado: "llamado",
            box_asignado: boxAsignado,
            tiempo_llamado: new Date().toISOString(),
          })
          .eq("id", turnoId)

        const state = await loadStateFromSupabase()
        io.emit("STATE_UPDATE", { state })
      } catch (err) {
        console.error("Error llamando turno:", err)
      }
    })

    // Finalizar atención
    socket.on("FINALIZAR_ATENCION", async ({ turnoId, tiempoAtencion }) => {
      try {
        await supabase
          .from("turnos")
          .update({ estado: "finalizado", tiempo_atencion: tiempoAtencion })
          .eq("id", turnoId)

        const state = await loadStateFromSupabase()
        io.emit("STATE_UPDATE", { state })
      } catch (err) {
        console.error("Error finalizando atención:", err)
      }
    })

    // Registrar atención
    socket.on("REGISTRAR_ATENCION", async ({ registro }) => {
      try {
        await supabase.from("registros_atencion").insert({
          numero_turno: registro.numeroTurno,
          servicio: registro.servicio,
          departamento: registro.departamento,
          box_asignado: registro.boxAsignado,
          empleado_id: registro.empleado || null,
          tiempo_atencion: registro.tiempoAtencion,
          fecha: registro.fecha ?? new Date().toISOString(),
        })

        const state = await loadStateFromSupabase()
        io.emit("STATE_UPDATE", { state })
      } catch (err) {
        console.error("Error registrando atención:", err)
      }
    })

    socket.on("disconnect", () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`)
    })
  })

  // Verificar conexión a Supabase al arrancar y cada 30s
  checkSupabase()
  setInterval(checkSupabase, 30_000)

  httpServer.listen(port, () => {
    console.log(`🚀 Servidor listo en http://${hostname}:${port}`)
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add server.ts lib/supabase.ts
git commit -m "feat: add socket.io server with supabase integration"
```

---

## Task 6: Actualizar scripts en package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Actualizar scripts en package.json**

Reemplazar el bloque `"scripts"` actual:

```json
"scripts": {
  "build": "next build",
  "dev": "tsx server.ts",
  "lint": "next lint",
  "start": "NODE_ENV=production tsx server.ts"
},
```

- [ ] **Step 2: Verificar que tsx está disponible**

```bash
npx tsx --version
```

Expected: imprime la versión de tsx (ej: `4.x.x`).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: update dev/start scripts to use tsx server.ts"
```

---

## Task 7: Actualizar turno-context.tsx para socket.io-client

**Files:**
- Modify: `lib/turno-context.tsx`

- [ ] **Step 1: Reemplazar el contenido completo de lib/turno-context.tsx**

```typescript
"use client"

import type React from "react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import type { Turno, RegistroAtencion } from "./types"

interface TurnoState {
  turnos: Turno[]
  turnoActual: Turno | null
  contadores: Record<string, number>
  registrosAtencion: RegistroAtencion[]
}

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  supabaseConnected: boolean
  state: TurnoState
  generarTurno: (servicio: string, departamento: string) => void
  llamarTurno: (turnoId: string, boxAsignado: string) => void
  finalizarAtencion: (turnoId: string, tiempoAtencion: number) => void
  registrarAtencion: (registro: RegistroAtencion) => void
}

const initialState: TurnoState = {
  turnos: [],
  turnoActual: null,
  contadores: {
    auditoria: 0,
    planes: 0,
    social: 0,
    personalizada: 0,
    emision_carnet: 0,
    atencion_personalizada_afiliaciones: 0,
    control_aportes: 0,
    inicio_expediente: 0,
  },
  registrosAtencion: [],
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  supabaseConnected: false,
  state: initialState,
  generarTurno: () => {},
  llamarTurno: () => {},
  finalizarAtencion: () => {},
  registrarAtencion: () => {},
})

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TurnoState>(initialState)
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [supabaseConnected, setSupabaseConnected] = useState(false)

  useEffect(() => {
    const socket = io({
      transports: ["websocket"],
      autoConnect: true,
    })

    socketRef.current = socket

    socket.on("connect", () => {
      console.log("✅ Socket.io conectado:", socket.id)
      setIsConnected(true)
    })

    socket.on("disconnect", () => {
      console.log("❌ Socket.io desconectado")
      setIsConnected(false)
    })

    socket.on("SUPABASE_STATUS", ({ connected }: { connected: boolean }) => {
      console.log(`🗄️ Supabase: ${connected ? "conectado" : "desconectado"}`)
      setSupabaseConnected(connected)
    })

    socket.on("STATE_UPDATE", ({ state: newState }: { state: TurnoState }) => {
      console.log("📨 Estado actualizado desde servidor")
      setState(newState)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const sendCommand = (event: string, data: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
    } else {
      console.warn("⚠️ Socket no conectado, no se puede enviar:", event)
    }
  }

  const generarTurno = (servicio: string, departamento: string) =>
    sendCommand("GENERAR_TURNO", { servicio, departamento })

  const llamarTurno = (turnoId: string, boxAsignado: string) =>
    sendCommand("LLAMAR_TURNO", { turnoId, boxAsignado })

  const finalizarAtencion = (turnoId: string, tiempoAtencion: number) =>
    sendCommand("FINALIZAR_ATENCION", { turnoId, tiempoAtencion })

  const registrarAtencion = (registro: RegistroAtencion) =>
    sendCommand("REGISTRAR_ATENCION", { registro })

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        supabaseConnected,
        state,
        generarTurno,
        llamarTurno,
        finalizarAtencion,
        registrarAtencion,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error("useSocket debe ser usado dentro de SocketProvider")
  }
  return context
}

export const useTurno = () => {
  const { state } = useSocket()
  return {
    state,
    dispatch: () => {},
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/turno-context.tsx
git commit -m "feat: migrate turno-context to socket.io-client, add supabaseConnected state"
```

---

## Task 8: Crear componente SupabaseStatus

**Files:**
- Create: `components/supabase-status.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Crear components/supabase-status.tsx**

```typescript
"use client"

import { useSocket } from "@/lib/turno-context"

export function SupabaseStatus() {
  const { supabaseConnected, isConnected } = useSocket()

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border rounded-full px-3 py-1.5 shadow text-xs font-medium">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-gray-700 dark:text-gray-300">
          {isConnected ? "Servidor conectado" : "Servidor desconectado"}
        </span>
      </div>
      <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border rounded-full px-3 py-1.5 shadow text-xs font-medium">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            supabaseConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-gray-700 dark:text-gray-300">
          {supabaseConnected ? "Supabase conectado" : "Supabase desconectado"}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Agregar SupabaseStatus al layout**

En `app/layout.tsx`, importar y agregar el componente:

```typescript
import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SocketProvider } from "@/lib/turno-context"
import { SupabaseStatus } from "@/components/supabase-status"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Sistema de Gestión de Turnos",
  description: "Sistema completo para gestión de turnos en oficinas",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <SocketProvider>
          {children}
          <SupabaseStatus />
        </SocketProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/supabase-status.tsx app/layout.tsx
git commit -m "feat: add SupabaseStatus indicator component"
```

---

## Task 9: Verificar funcionamiento completo

- [ ] **Step 1: Arrancar el servidor**

```bash
npm run dev
```

Expected en consola:
```
🗄️  Supabase: ✅ conectado
🚀 Servidor listo en http://localhost:3000
```

- [ ] **Step 2: Abrir http://localhost:3000 en el navegador**

Expected: se ven los dos badges en la esquina inferior derecha:
- "Servidor conectado" (verde)
- "Supabase conectado" (verde)

- [ ] **Step 3: Verificar en consola del navegador**

Abrir DevTools → Console. Expected:
```
✅ Socket.io conectado: <id>
🗄️ Supabase: conectado
📨 Estado actualizado desde servidor
```

- [ ] **Step 4: Probar generación de turno**

Navegar a la pantalla de turnero y generar un turno. Luego verificar en Supabase Dashboard → Table Editor → `turnos` que aparece el nuevo registro.

- [ ] **Step 5: Verificar contadores en Supabase**

En Supabase Dashboard → Table Editor → `contadores`, confirmar que el valor del servicio incrementó en 1.
