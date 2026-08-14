# SP3 — Pantallas de llamado por ala y audio — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dos televisores, uno por ala, que muestran a quién se llama y a qué box tiene que ir, con una campanilla en cada llamado nuevo.

**Architecture:** Ruta `/pantalla/[ala]` con un Server Component que resuelve el ala y un cliente que se une al room `ala:<slug>` por socket. Cada `TURNO_LLAMADO` o `TURNO_RELLAMADO` dispara un re-snapshot completo desde `TurnoEvento` — una sola proyección, sin deltas que se desincronicen. La campanilla suena cuando cambia el `eventoId` del llamado actual.

**Tech Stack:** Next.js 15 (App Router, React 19), socket.io 4, Prisma 6 sobre SQL Server 2022, Vitest, Playwright, Tailwind. Web Audio API para el sonido.

**Spec:** `docs/superpowers/specs/2026-08-14-sp3-pantallas-audio-design.md`

## Global Constraints

- TypeScript estricto. Sin `any`, sin `@ts-ignore`.
- **La pantalla es pública y no pide sesión.** `ENTRAR_PANTALLA` no valida cookie, a diferencia de `ENTRAR_BOX`.
- **`SnapshotPantalla` no lleva campo de trámite, nunca.** Nombre + trámite médico juntos en un pasillo son un dato de salud identificable (Ley 25.326).
- **Identificación:** `nombreAfiliado` si existe; si no, `dni`; si no hay ninguno, `null`. Nunca los dos a la vez.
- **`TurnoEvento.timestamp` es `DATETIME2`: el corte del día se calcula en hora local, sin `Date.UTC()`.** La regla de SP2 que usa `Date.UTC()` aplica a `Turno.fecha`, que es `DATE`. Son opuestas.
- Tipos de evento exactos: `"llamado"` y `"rellamado"` (de `TipoEvento` en `lib/queue/tipos.ts`).
- `ultimos` lleva exactamente **4** llamados.
- Todo el texto de la pantalla va en **blanco**. La jerarquía se sostiene con tamaño, peso y espaciado.
- Pastilla del box: `#f2564e` (variante clara del `--osp`) con texto oscuro encima.
- Fondo: degradé diagonal de `#101c3d` a `#24407e`.
- El logo `/OSP_Gobierno.webp` va sobre placa blanca, **sin recolorear**.
- El reloj usa `tabular-nums`.
- El estado de conexión nunca se comunica sólo por color: punto **y** texto.
- La pantalla nunca se vacía ni muestra un error a pantalla completa.
- Tests de integración corren contra `Turnero_Test`. Si `npm test` aborta por la guarda, `DATABASE_URL` quedó apuntando a la base real.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `server/snapshotPantalla.ts` | Tipos, proyección pura y consulta del snapshot |
| `server/index.ts` | *(modificar)* registrar `ENTRAR_PANTALLA` |
| `server/rooms.ts` | *(modificar)* exportar la `slug` que ya existe |
| `app/pantalla/usarCampanilla.ts` | `debeSonar` puro + síntesis del tono |
| `app/pantalla/usarSocketPantalla.ts` | Conexión, `ENTRAR_PANTALLA`, re-snapshot |
| `app/pantalla/EncabezadoPantalla.tsx` | Logo, ala, reloj, estado |
| `app/pantalla/LlamadoActual.tsx` | Número, nombre, pastilla del box |
| `app/pantalla/UltimosLlamados.tsx` | Columna lateral |
| `app/pantalla/[ala]/PantallaAla.tsx` | Orquesta |
| `app/pantalla/[ala]/page.tsx` | Server Component, resuelve el ala, 404 |
| `app/public-display/` | *(eliminar)* |

---

## Task 1: Proyección y snapshot de la pantalla

**Files:**
- Create: `server/snapshotPantalla.ts`
- Test: `tests/unit/snapshotPantalla.test.ts`, `tests/integration/snapshotPantalla.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/db`
- Produces:
  - `interface LlamadoPantalla { eventoId: string; numero: string; boxNombre: string; identificacion: string | null; llamadoEn: string }`
  - `interface SnapshotPantalla { ala: string; actual: LlamadoPantalla | null; ultimos: LlamadoPantalla[] }`
  - `interface FilaLlamado { eventoId: string; numero: string; boxNombre: string; nombreAfiliado: string | null; dni: string | null; timestamp: Date }`
  - `proyectarLlamados(ala: string, filas: FilaLlamado[]): SnapshotPantalla`
  - `armarSnapshotPantalla(ala: string): Promise<SnapshotPantalla>`
  - `CUANTOS_ULTIMOS = 4`

- [ ] **Step 1: Escribir el test unitario que falla**

Crear `tests/unit/snapshotPantalla.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { proyectarLlamados, type FilaLlamado } from "@/server/snapshotPantalla"

const fila = (over: Partial<FilaLlamado> = {}): FilaLlamado => ({
  eventoId: "e1",
  numero: "P01",
  boxNombre: "Box 3",
  nombreAfiliado: "González, María",
  dni: "20123456",
  timestamp: new Date("2026-08-14T14:32:00Z"),
  ...over,
})

describe("proyectarLlamados", () => {
  it("sin llamados, no hay actual ni anteriores", () => {
    const s = proyectarLlamados("Norte", [])
    expect(s.ala).toBe("Norte")
    expect(s.actual).toBeNull()
    expect(s.ultimos).toEqual([])
  })

  it("la primera fila es el llamado actual", () => {
    const s = proyectarLlamados("Norte", [fila({ eventoId: "e9", numero: "T04" })])
    expect(s.actual?.eventoId).toBe("e9")
    expect(s.actual?.numero).toBe("T04")
    expect(s.ultimos).toEqual([])
  })

  it("los anteriores son los que siguen, tope de cuatro", () => {
    const filas = ["e1", "e2", "e3", "e4", "e5", "e6", "e7"].map((id) => fila({ eventoId: id }))
    const s = proyectarLlamados("Norte", filas)
    expect(s.actual?.eventoId).toBe("e1")
    expect(s.ultimos.map((l) => l.eventoId)).toEqual(["e2", "e3", "e4", "e5"])
  })

  it("identifica por nombre cuando el afiliado está en el padrón", () => {
    const s = proyectarLlamados("Norte", [fila()])
    expect(s.actual?.identificacion).toBe("González, María")
  })

  it("cae al DNI cuando no hay nombre cargado", () => {
    const s = proyectarLlamados("Norte", [fila({ nombreAfiliado: null })])
    expect(s.actual?.identificacion).toBe("20123456")
  })

  it("sin nombre ni DNI, la identificación queda vacía", () => {
    const s = proyectarLlamados("Norte", [fila({ nombreAfiliado: null, dni: null })])
    expect(s.actual?.identificacion).toBeNull()
  })

  it("nunca expone el trámite: la pantalla es pública", () => {
    const s = proyectarLlamados("Norte", [fila()])
    expect(Object.keys(s.actual!).sort()).toEqual(
      ["boxNombre", "eventoId", "identificacion", "llamadoEn", "numero"]
    )
  })

  it("el nombre y el DNI nunca aparecen juntos", () => {
    const s = proyectarLlamados("Norte", [fila()])
    expect(s.actual?.identificacion).not.toContain("20123456")
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/snapshotPantalla.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/snapshotPantalla"`

- [ ] **Step 3: Implementar**

Crear `server/snapshotPantalla.ts`:

```typescript
import { prisma } from "@/lib/db"

export interface LlamadoPantalla {
  eventoId: string
  numero: string
  boxNombre: string
  identificacion: string | null
  llamadoEn: string
}

export interface SnapshotPantalla {
  ala: string
  actual: LlamadoPantalla | null
  ultimos: LlamadoPantalla[]
}

/** Fila cruda del evento de llamado, ya unida al turno y al box. */
export interface FilaLlamado {
  eventoId: string
  numero: string
  boxNombre: string
  nombreAfiliado: string | null
  dni: string | null
  timestamp: Date
}

export const CUANTOS_ULTIMOS = 4

/**
 * Proyeccion pura: la primera fila es el llamado actual y las siguientes son la
 * repesca para quien levanto la vista tarde. Se separa de la consulta para
 * poder probarla sin base.
 *
 * LlamadoPantalla no tiene campo de tramite y no lo va a tener: el catalogo
 * incluye "Protesis" y "Programa Materno", y un nombre junto a un tramite
 * medico en un pasillo es un dato de salud identificable.
 */
export function proyectarLlamados(ala: string, filas: FilaLlamado[]): SnapshotPantalla {
  const aLlamado = (f: FilaLlamado): LlamadoPantalla => ({
    eventoId: f.eventoId,
    numero: f.numero,
    boxNombre: f.boxNombre,
    identificacion: f.nombreAfiliado ?? f.dni ?? null,
    llamadoEn: f.timestamp.toISOString(),
  })

  return {
    ala,
    actual: filas[0] ? aLlamado(filas[0]) : null,
    ultimos: filas.slice(1, 1 + CUANTOS_ULTIMOS).map(aLlamado),
  }
}

/**
 * Corte del dia en hora local, a proposito.
 *
 * TurnoEvento.timestamp es DATETIME2: guarda un instante real, sin la
 * conversion implicita que SQL Server hace con las columnas DATE. Usar
 * Date.UTC() aca —como si correspondiera, porque es lo que SP2 hace con
 * Turno.fecha— correria el corte tres horas y mostraria llamados de ayer entre
 * las 21:00 y la medianoche.
 */
function desdeMedianoche(): Date {
  const a = new Date()
  return new Date(a.getFullYear(), a.getMonth(), a.getDate())
}

export async function armarSnapshotPantalla(ala: string): Promise<SnapshotPantalla> {
  const eventos = await prisma.turnoEvento.findMany({
    where: {
      tipo: { in: ["llamado", "rellamado"] },
      timestamp: { gte: desdeMedianoche() },
      box: { ala: { nombre: ala } },
    },
    orderBy: { timestamp: "desc" },
    take: 1 + CUANTOS_ULTIMOS,
    select: {
      id: true,
      timestamp: true,
      box: { select: { nombre: true } },
      turno: { select: { numero: true, nombreAfiliado: true, dni: true } },
    },
  })

  return proyectarLlamados(
    ala,
    eventos.map((e) => ({
      eventoId: e.id,
      numero: e.turno.numero,
      boxNombre: e.box?.nombre ?? "",
      nombreAfiliado: e.turno.nombreAfiliado,
      dni: e.turno.dni,
      timestamp: e.timestamp,
    }))
  )
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/snapshotPantalla.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Escribir el test de integración**

Crear `tests/integration/snapshotPantalla.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { armarSnapshotPantalla } from "@/server/snapshotPantalla"

async function limpiar() {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()
}

function hoyFecha(): Date {
  const a = new Date()
  return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()))
}

async function sembrarLlamado(
  boxId: string,
  tramiteId: string,
  numero: string,
  tipo: "llamado" | "rellamado",
  datos: { nombreAfiliado?: string | null; dni?: string | null } = {}
) {
  const turno = await prisma.turno.create({
    data: {
      numero,
      fecha: hoyFecha(),
      tramiteId,
      estado: "llamado",
      boxId,
      dni: datos.dni ?? null,
      nombreAfiliado: datos.nombreAfiliado ?? null,
      requestId: `int-${numero}-${Date.now()}-${Math.random()}`,
    },
  })
  await prisma.turnoEvento.create({ data: { turnoId: turno.id, tipo, boxId } })
  return turno
}

describe("armarSnapshotPantalla", () => {
  beforeEach(limpiar)
  afterAll(async () => {
    await limpiar()
    await prisma.$disconnect()
  })

  it("devuelve el último llamado del ala como actual", async () => {
    const box = await prisma.box.findFirstOrThrow({ include: { ala: true } })
    const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: box.id } })

    await sembrarLlamado(box.id, bt.tramiteId, "A01", "llamado")
    await sembrarLlamado(box.id, bt.tramiteId, "A02", "llamado", {
      nombreAfiliado: "González, María",
    })

    const s = await armarSnapshotPantalla(box.ala.nombre)
    expect(s.actual?.numero).toBe("A02")
    expect(s.actual?.identificacion).toBe("González, María")
    expect(s.actual?.boxNombre).toBe(box.nombre)
    expect(s.ultimos.map((l) => l.numero)).toEqual(["A01"])
  })

  it("no muestra llamados de la otra ala", async () => {
    const boxes = await prisma.box.findMany({ include: { ala: true } })
    const norte = boxes.find((b) => b.ala.nombre === "Norte")
    const sur = boxes.find((b) => b.ala.nombre === "Sur")
    if (!norte || !sur) return

    const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: norte.id } })
    await sembrarLlamado(norte.id, bt.tramiteId, "N01", "llamado")

    const s = await armarSnapshotPantalla("Sur")
    expect(s.actual).toBeNull()
  })

  it("un rellamado vuelve a poner el turno arriba", async () => {
    const box = await prisma.box.findFirstOrThrow({ include: { ala: true } })
    const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: box.id } })

    const primero = await sembrarLlamado(box.id, bt.tramiteId, "B01", "llamado")
    await sembrarLlamado(box.id, bt.tramiteId, "B02", "llamado")
    await prisma.turnoEvento.create({
      data: { turnoId: primero.id, tipo: "rellamado", boxId: box.id },
    })

    const s = await armarSnapshotPantalla(box.ala.nombre)
    expect(s.actual?.numero).toBe("B01")
  })
})
```

- [ ] **Step 6: Correr el test de integración**

Run: `npx vitest run tests/integration/snapshotPantalla.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 7: Commit**

```bash
git add server/snapshotPantalla.ts tests/unit/snapshotPantalla.test.ts tests/integration/snapshotPantalla.test.ts
git commit -m "feat: proyección y snapshot de la pantalla de ala"
```

---

## Task 2: `ENTRAR_PANTALLA` en el socket

**Files:**
- Modify: `server/rooms.ts` (exportar `slug`)
- Modify: `server/index.ts` (registrar el evento)
- Test: `tests/unit/rooms.test.ts` (extender)

**Interfaces:**
- Consumes: `armarSnapshotPantalla(ala)`, `roomAla(ala)`
- Produces:
  - `slug(s: string): string` exportado de `server/rooms.ts`
  - Evento de socket `ENTRAR_PANTALLA { ala: string }` → ack `{ ok: true, snapshot: SnapshotPantalla }`

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `tests/unit/rooms.test.ts`:

```typescript
describe("slug exportado", () => {
  it("normaliza igual que los nombres de room", () => {
    expect(slug("Norte")).toBe("norte")
    expect(slug("Planta Alta")).toBe("planta-alta")
  })

  // La URL de la pantalla y el nombre del room tienen que normalizar con la
  // misma funcion: si divergen, la TV se une a un room al que nadie emite.
  it("el slug de la URL coincide con el room del ala", () => {
    expect(roomAla("Norte")).toBe(`ala:${slug("Norte")}`)
  })
})
```

Y cambiar la línea del import, arriba del archivo:

```typescript
import { roomAla, roomPisoAla, roomBox, destinatarios, slug } from "@/server/rooms"
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/rooms.test.ts`
Expected: FAIL — `slug` no está exportado por `@/server/rooms`

- [ ] **Step 3: Exportar `slug`**

En `server/rooms.ts`, agregar `export` a la constante que ya existe. Queda:

```typescript
export const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")
```

No se cambia nada más del archivo.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/rooms.test.ts`
Expected: PASS

- [ ] **Step 5: Registrar el evento en el socket**

En `server/index.ts`, cambiar la línea del import de rooms para sumar `roomAla`:

```typescript
import { destinatarios, roomAla, roomBox, TODOS, type EventoTurnero } from "./rooms"
```

Agregar el import del snapshot debajo del de `armarSnapshot`:

```typescript
import { armarSnapshotPantalla } from "./snapshotPantalla"
```

Y agregar el handler dentro de `io.on("connection", ...)`, después del bloque `DERIVAR_TURNO`:

```typescript
    // --- Pantallas de ala ---

    // Sin sesion, a diferencia de ENTRAR_BOX: la TV es una pantalla publica sin
    // login. Por eso el snapshot expone solo numero, nombre y box, que es lo
    // que ya esta a la vista de cualquiera que mire el televisor.
    socket.on(
      "ENTRAR_PANTALLA",
      async ({ ala }: { ala: string }, ack?: (r: unknown) => void) => {
        socket.join(roomAla(ala))
        ack?.({ ok: true, snapshot: await armarSnapshotPantalla(ala) })
      }
    )
```

- [ ] **Step 6: Verificar tipos y suite**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `server/`

Run: `npm test`
Expected: PASS — todo verde

- [ ] **Step 7: Commit**

```bash
git add server/rooms.ts server/index.ts tests/unit/rooms.test.ts
git commit -m "feat: evento ENTRAR_PANTALLA sin sesión para las TVs de ala"
```

---

## Task 3: La campanilla

**Files:**
- Create: `app/pantalla/usarCampanilla.ts`
- Test: `tests/unit/campanilla.test.ts`

**Interfaces:**
- Produces:
  - `debeSonar(anterior: string | null | undefined, actual: string | null): boolean`
  - `usarCampanilla(eventoIdActual: string | null): { bloqueado: boolean; desbloquear: () => void }`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/campanilla.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { debeSonar } from "@/app/pantalla/usarCampanilla"

describe("debeSonar", () => {
  it("no suena en la carga inicial, aunque ya haya llamados del día", () => {
    expect(debeSonar(undefined, "e5")).toBe(false)
  })

  it("no suena en la carga inicial sin llamados", () => {
    expect(debeSonar(undefined, null)).toBe(false)
  })

  // Distinto de la carga inicial: acá ya hubo snapshot y estaba vacío.
  it("el primer llamado del día sí suena", () => {
    expect(debeSonar(null, "e1")).toBe(true)
  })

  it("suena cuando entra un llamado nuevo", () => {
    expect(debeSonar("e1", "e2")).toBe(true)
  })

  it("no suena al reconectar si nadie llamó mientras tanto", () => {
    expect(debeSonar("e1", "e1")).toBe(false)
  })

  // Rellamar produce un TurnoEvento nuevo aunque el turno sea el mismo, y el
  // sentido de rellamar es volver a llamar la atención.
  it("suena en el rellamado del mismo turno", () => {
    expect(debeSonar("evento-llamado", "evento-rellamado")).toBe(true)
  })

  it("no suena si el actual queda vacío", () => {
    expect(debeSonar("e1", null)).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/campanilla.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/pantalla/usarCampanilla"`

- [ ] **Step 3: Implementar**

Crear `app/pantalla/usarCampanilla.ts`:

```typescript
"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * `undefined` en anterior significa que todavia no llego ningun snapshot: es la
 * carga inicial y no tiene que sonar aunque haya llamados previos del dia.
 * `null` significa que si hubo snapshot y no habia nadie llamado, asi que el
 * primer llamado del dia si suena.
 */
export function debeSonar(
  anterior: string | null | undefined,
  actual: string | null
): boolean {
  if (anterior === undefined) return false
  if (actual === null) return false
  return anterior !== actual
}

/** Dos tonos descendentes. No hay archivo que se rompa en el deploy. */
function tocar(ctx: AudioContext): void {
  const ahora = ctx.currentTime
  const tonos = [880, 660]

  for (let i = 0; i < tonos.length; i++) {
    const osc = ctx.createOscillator()
    const vol = ctx.createGain()
    const t = ahora + i * 0.18

    osc.type = "sine"
    osc.frequency.value = tonos[i]
    vol.gain.setValueAtTime(0, t)
    vol.gain.linearRampToValueAtTime(0.35, t + 0.02)
    vol.gain.exponentialRampToValueAtTime(0.001, t + 0.35)

    osc.connect(vol)
    vol.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.4)
  }
}

export function usarCampanilla(eventoIdActual: string | null) {
  const anterior = useRef<string | null | undefined>(undefined)
  const ctxRef = useRef<AudioContext | null>(null)
  const [bloqueado, setBloqueado] = useState(false)

  const contexto = useCallback((): AudioContext => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    return ctxRef.current
  }, [])

  // Chrome deja el AudioContext suspendido hasta que haya un gesto, y en una TV
  // nadie hace clic nunca. Se resuelve al instalar, lanzando el navegador con
  // --autoplay-policy=no-user-gesture-required. Esto es la red de contencion:
  // si igual queda bloqueado, la pantalla lo dice en vez de quedar muda.
  const desbloquear = useCallback(() => {
    contexto()
      .resume()
      .then(() => setBloqueado(false))
      .catch(() => setBloqueado(true))
  }, [contexto])

  useEffect(() => {
    if (debeSonar(anterior.current, eventoIdActual)) {
      const ctx = contexto()
      if (ctx.state === "suspended") {
        ctx.resume().then(
          () => tocar(ctx),
          () => setBloqueado(true)
        )
      } else {
        tocar(ctx)
      }
    }
    anterior.current = eventoIdActual
  }, [eventoIdActual, contexto])

  return { bloqueado, desbloquear }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/campanilla.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add app/pantalla/usarCampanilla.ts tests/unit/campanilla.test.ts
git commit -m "feat: campanilla sintetizada con detección de llamado nuevo"
```

---

## Task 4: El hook del socket

**Files:**
- Create: `app/pantalla/usarSocketPantalla.ts`

**Interfaces:**
- Consumes: `SnapshotPantalla` de `@/server/snapshotPantalla`
- Produces: `usarSocketPantalla(ala: string): { snapshot: SnapshotPantalla | null; conectado: boolean }`

- [ ] **Step 1: Implementar el hook**

Crear `app/pantalla/usarSocketPantalla.ts`:

```typescript
"use client"

import { useCallback, useEffect, useState } from "react"
import { io, type Socket } from "socket.io-client"
import type { SnapshotPantalla } from "@/server/snapshotPantalla"

export function usarSocketPantalla(ala: string) {
  const [snapshot, setSnapshot] = useState<SnapshotPantalla | null>(null)
  const [conectado, setConectado] = useState(false)

  const refrescar = useCallback(
    (s: Socket) => {
      s.emit(
        "ENTRAR_PANTALLA",
        { ala },
        (r: { ok: boolean; snapshot?: SnapshotPantalla }) => {
          // Si falla se conserva lo que ya hay. La pantalla nunca se vacia: en
          // un pasillo, una TV en blanco parece rota y una con un dato viejo
          // sigue sirviendo a quien esta esperando.
          if (r?.ok && r.snapshot) setSnapshot(r.snapshot)
        }
      )
    },
    [ala]
  )

  useEffect(() => {
    const s = io()

    s.on("connect", () => {
      setConectado(true)
      refrescar(s)
    })
    s.on("disconnect", () => setConectado(false))

    // Solo estos dos eventos llegan al room del ala. Ante cualquiera de los dos
    // se pide el snapshot completo: una sola proyeccion, sin deltas que se
    // desincronicen del servidor.
    s.on("TURNO_LLAMADO", () => refrescar(s))
    s.on("TURNO_RELLAMADO", () => refrescar(s))

    return () => {
      s.close()
    }
  }, [refrescar])

  return { snapshot, conectado }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `app/pantalla/`

- [ ] **Step 3: Commit**

```bash
git add app/pantalla/usarSocketPantalla.ts
git commit -m "feat: hook de socket de la pantalla con re-snapshot por evento"
```

---

## Task 5: Los componentes visuales

**Files:**
- Create: `app/pantalla/EncabezadoPantalla.tsx`, `app/pantalla/LlamadoActual.tsx`, `app/pantalla/UltimosLlamados.tsx`

**Interfaces:**
- Consumes: `LlamadoPantalla` de `@/server/snapshotPantalla`
- Produces:
  - `<EncabezadoPantalla ala={string} conectado={boolean} />`
  - `<LlamadoActual llamado={LlamadoPantalla | null} />`
  - `<UltimosLlamados llamados={LlamadoPantalla[]} />`

- [ ] **Step 1: El encabezado**

Crear `app/pantalla/EncabezadoPantalla.tsx`:

```typescript
"use client"

import { useEffect, useState } from "react"

function Reloj() {
  const [hora, setHora] = useState("")

  useEffect(() => {
    const tick = () =>
      setHora(
        new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      )
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [])

  // tabular-nums: sin esto el ancho del 1 difiere del 8 y el reloj se corre
  // unos pixeles a cada cambio de minuto. En una pantalla fija se nota.
  return <span className="text-[1.6vw] tabular-nums text-white">{hora}</span>
}

export function EncabezadoPantalla({
  ala,
  conectado,
}: {
  ala: string
  conectado: boolean
}) {
  return (
    <header className="flex items-center justify-between border-b border-white/15 px-[2vw] py-[1vh]">
      {/* Placa blanca: el logo es un lockup con tipografia negra, hecho para
          fondo claro. Se le da fondo propio en vez de recolorearlo. */}
      <div className="rounded-lg bg-white px-[1vw] py-[0.6vh]">
        <img src="/OSP_Gobierno.webp" alt="Obra Social Provincia" className="h-[4vh]" />
      </div>

      <h1 className="text-[1.5vw] tracking-[0.14em] text-white">
        ALA {ala.toUpperCase()}
      </h1>

      <div className="flex items-center gap-[1.2vw]">
        {/* Punto y texto: el estado no se comunica solo por color, porque nadie
            puede acercarse a inspeccionar una TV mal calibrada. */}
        <span className="flex items-center gap-[0.4vw] text-[0.9vw] text-white">
          <span
            aria-hidden
            className={`inline-block h-[0.7vw] w-[0.7vw] rounded-full ${
              conectado ? "bg-green-400" : "bg-amber-400"
            }`}
          />
          {conectado ? "En línea" : "Sin conexión"}
        </span>
        <Reloj />
      </div>
    </header>
  )
}
```

- [ ] **Step 2: El llamado actual**

Crear `app/pantalla/LlamadoActual.tsx`:

```typescript
"use client"

import type { LlamadoPantalla } from "@/server/snapshotPantalla"

export function LlamadoActual({ llamado }: { llamado: LlamadoPantalla | null }) {
  if (!llamado) {
    return (
      <section className="flex flex-col items-center justify-center px-[3vw]">
        <img
          src="/OSP_Gobierno.webp"
          alt="Obra Social Provincia"
          className="w-[22vw] rounded-2xl bg-white p-[1.5vw]"
        />
      </section>
    )
  }

  return (
    <section
      // key: remonta el bloque en cada llamado nuevo y reinicia la animacion.
      key={llamado.eventoId}
      className="flex flex-col justify-center px-[3vw] motion-safe:animate-[entrar_400ms_ease-out]"
    >
      <p className="text-[9vw] font-semibold leading-none text-white">{llamado.numero}</p>

      {llamado.identificacion && (
        <p className="mt-[1.2vh] text-[2.4vw] text-white">{llamado.identificacion}</p>
      )}

      <p className="mt-[2vh]">
        <span className="inline-block rounded-xl bg-[#f2564e] px-[2vw] py-[0.8vh] text-[3.2vw] font-semibold text-[#2a0806]">
          {llamado.boxNombre}
        </span>
      </p>

      <style>{`
        @keyframes entrar {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </section>
  )
}
```

- [ ] **Step 3: La columna de anteriores**

Crear `app/pantalla/UltimosLlamados.tsx`:

```typescript
"use client"

import type { LlamadoPantalla } from "@/server/snapshotPantalla"

export function UltimosLlamados({ llamados }: { llamados: LlamadoPantalla[] }) {
  return (
    <aside className="flex flex-col bg-white/[0.06] px-[1.6vw] py-[2vh]">
      {/* Blanca como todo el texto, pero mas chica y con mas tracking: la
          jerarquia se sostiene con tamaño y espaciado, no con color. */}
      <h2 className="text-[0.9vw] tracking-[0.16em] text-white">ANTERIORES</h2>

      <ul className="mt-[1.5vh] flex flex-col">
        {llamados.map((l) => (
          <li
            key={l.eventoId}
            className="flex items-baseline justify-between border-b border-white/10 py-[1.1vh] last:border-b-0"
          >
            <span className="text-[2vw] font-semibold text-white">{l.numero}</span>
            <span className="text-[1.5vw] text-white">{l.boxNombre}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `app/pantalla/`

- [ ] **Step 5: Commit**

```bash
git add app/pantalla/EncabezadoPantalla.tsx app/pantalla/LlamadoActual.tsx app/pantalla/UltimosLlamados.tsx
git commit -m "feat: componentes visuales de la pantalla de ala"
```

---

## Task 6: La ruta y la orquestación

**Files:**
- Create: `app/pantalla/[ala]/PantallaAla.tsx`, `app/pantalla/[ala]/page.tsx`

**Interfaces:**
- Consumes: `usarSocketPantalla`, `usarCampanilla`, los tres componentes, `slug` de `@/server/rooms`
- Produces: las rutas `/pantalla/norte` y `/pantalla/sur`

- [ ] **Step 1: El orquestador**

Crear `app/pantalla/[ala]/PantallaAla.tsx`:

```typescript
"use client"

import { usarSocketPantalla } from "../usarSocketPantalla"
import { usarCampanilla } from "../usarCampanilla"
import { EncabezadoPantalla } from "../EncabezadoPantalla"
import { LlamadoActual } from "../LlamadoActual"
import { UltimosLlamados } from "../UltimosLlamados"

export function PantallaAla({ ala }: { ala: string }) {
  const { snapshot, conectado } = usarSocketPantalla(ala)
  const { bloqueado, desbloquear } = usarCampanilla(snapshot?.actual?.eventoId ?? null)

  return (
    <main
      onClick={bloqueado ? desbloquear : undefined}
      className="grid h-dvh grid-rows-[auto_1fr] bg-[linear-gradient(150deg,#101c3d_0%,#1c2f61_55%,#24407e_100%)]"
    >
      <EncabezadoPantalla ala={ala} conectado={conectado} />

      <div className="grid grid-cols-[1.9fr_1fr] overflow-hidden">
        <LlamadoActual llamado={snapshot?.actual ?? null} />
        <UltimosLlamados llamados={snapshot?.ultimos ?? []} />
      </div>

      {/* Una TV lanzada sin --autoplay-policy=no-user-gesture-required queda
          muda. Esto hace que se note y se pueda arreglar tocando la pantalla. */}
      {bloqueado && (
        <p className="absolute bottom-[2vh] left-1/2 -translate-x-1/2 rounded-lg bg-white/90 px-[1.5vw] py-[0.8vh] text-[1vw] text-[#101c3d]">
          Tocar la pantalla para activar el sonido
        </p>
      )}
    </main>
  )
}
```

- [ ] **Step 2: La ruta**

Crear `app/pantalla/[ala]/page.tsx`:

```typescript
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { slug } from "@/server/rooms"
import { PantallaAla } from "./PantallaAla"

// Cada TV arranca Chrome apuntado a su URL: /pantalla/norte o /pantalla/sur.
export default async function PaginaPantalla({
  params,
}: {
  params: Promise<{ ala: string }>
}) {
  const { ala } = await params

  // Se resuelve contra la base y se pasa el nombre real, no el slug: el room
  // lo calcula el servidor con la misma slug() de rooms.ts.
  const alas = await prisma.ala.findMany({ select: { nombre: true } })
  const encontrada = alas.find((a) => slug(a.nombre) === ala.toLowerCase())
  if (!encontrada) notFound()

  return <PantallaAla ala={encontrada.nombre} />
}
```

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `app/pantalla/`

Run: `npm run build`
Expected: compila, y `/pantalla/[ala]` aparece en la lista de rutas

- [ ] **Step 4: Commit**

```bash
git add app/pantalla/
git commit -m "feat: ruta /pantalla/[ala] con orquestación de la TV"
```

---

## Task 7: E2E de aislamiento y retiro del legacy

**Files:**
- Create: `e2e/pantalla.spec.ts`
- Delete: `app/public-display/`

**Interfaces:**
- Consumes: todo lo anterior

- [ ] **Step 1: Escribir el E2E**

Crear `e2e/pantalla.spec.ts`:

```typescript
import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

test.beforeEach(async () => {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

function hoyFecha(): Date {
  const a = new Date()
  return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()))
}

async function llamarEn(alaNombre: string, numero: string, nombreAfiliado: string) {
  const box = await prisma.box.findFirstOrThrow({
    where: { ala: { nombre: alaNombre } },
    include: { ala: true },
  })
  const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: box.id } })

  const turno = await prisma.turno.create({
    data: {
      numero,
      fecha: hoyFecha(),
      tramiteId: bt.tramiteId,
      estado: "llamado",
      boxId: box.id,
      nombreAfiliado,
      requestId: `e2e-pantalla-${numero}-${Date.now()}`,
    },
  })
  await prisma.turnoEvento.create({
    data: { turnoId: turno.id, tipo: "llamado", boxId: box.id },
  })
  return box
}

test("la pantalla del ala muestra el llamado con número, nombre y box", async ({ page }) => {
  const box = await llamarEn("Norte", "N01", "González, María")

  await page.goto("/pantalla/norte")

  await expect(page.getByText("N01")).toBeVisible()
  await expect(page.getByText("González, María")).toBeVisible()
  await expect(page.getByText(box.nombre, { exact: true })).toBeVisible()
})

// La asercion que importa es la negativa: la positiva sola pasaria igual si el
// servidor emitiera a todas las pantallas.
test("un llamado del Norte no aparece en la pantalla del Sur", async ({ page }) => {
  const hayDosAlas = await prisma.ala.count()
  test.skip(hayDosAlas < 2, "hacen falta dos alas")

  await llamarEn("Norte", "N02", "Pérez, Juan")

  await page.goto("/pantalla/sur")

  await expect(page.getByText("N02")).toHaveCount(0)
  await expect(page.getByText("Pérez, Juan")).toHaveCount(0)
})

test("la pantalla no expone el trámite", async ({ page }) => {
  const box = await llamarEn("Norte", "N03", "López, Ana")
  const bt = await prisma.boxTramite.findFirstOrThrow({
    where: { boxId: box.id },
    include: { tramite: true },
  })

  await page.goto("/pantalla/norte")
  await expect(page.getByText("N03")).toBeVisible()

  await expect(page.getByText(bt.tramite.nombre)).toHaveCount(0)
})

test("un ala inexistente devuelve 404", async ({ page }) => {
  const r = await page.goto("/pantalla/oeste")
  expect(r?.status()).toBe(404)
})
```

- [ ] **Step 2: Correr el E2E**

Run: `npm run test:e2e -- e2e/pantalla.spec.ts`
Expected: PASS — 4 tests

Requiere el servidor y SQL Server accesibles. Playwright levanta `npm run dev` solo, según `playwright.config.ts`.

- [ ] **Step 3: Retirar el panel público legacy**

```bash
git rm -r app/public-display
```

Revisar si algo lo enlaza:

```bash
grep -rn "public-display\|DEPARTAMENTOS" app/ lib/ server/ e2e/ --include=*.tsx --include=*.ts
```

Si `app/page.tsx` enlaza a `/public-display`, cambiarlo a `/pantalla/norte`.

- [ ] **Step 4: Correr toda la suite**

Run: `npm test`
Expected: PASS — todo verde

Run: `npx tsc --noEmit`
Expected: los errores de `app/public-display/` desaparecieron porque el directorio ya no existe. **No debe haber ninguno nuevo en `app/pantalla/` ni en `server/`.**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: E2E de la pantalla y retiro de app/public-display"
```

---

## Task 8: Documentación

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Actualizar la tabla de sub-proyectos**

En la tabla de alcance, cambiar la fila de SP3 de "Sin spec" a **COMPLETO**.

- [ ] **Step 2: Actualizar "Estado real"**

Agregar debajo de la línea de SP2:

```markdown
**SP3 — COMPLETO.** Dos pantallas de llamado, una por ala, en `/pantalla/norte` y `/pantalla/sur`.
Campanilla sintetizada, reloj y estado de conexión. `app/public-display/` retirado.

Cada TV arranca Chrome apuntado a su URL. **Hay que lanzarlo con
`--autoplay-policy=no-user-gesture-required`**, o la campanilla queda bloqueada: sin gesto del
usuario Chrome no deja sonar nada, y en una TV nadie hace clic. Si igual queda bloqueada, la pantalla
muestra un cartel para tocarla una vez.

La pantalla muestra número, nombre y box. **No muestra el trámite, a propósito:** un nombre junto a
un trámite médico en un pasillo es un dato de salud identificable.
```

- [ ] **Step 3: Documentar la trampa de fechas**

En la sección de notas para quien implemente, agregar:

```markdown
**`Date.UTC()` es para `Turno.fecha`, no para `TurnoEvento.timestamp`.** El primero es `DATE` y SQL
Server lo convierte a medianoche UTC, así que hay que consultarlo con `Date.UTC()`. El segundo es
`DATETIME2` y guarda un instante real: ahí el corte del día va en hora local. Aplicar la regla de uno
al otro corre el corte tres horas.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: SP3 completo"
```

---

## Notas para quien ejecute

**Lo que más fácil se hace mal:**

1. **El trámite no va a la pantalla.** Si aparece un `tramiteNombre` en `LlamadoPantalla`, está mal. Hay un test que verifica las claves exactas del objeto justamente para eso.

2. **`Date.UTC()` en el corte del día.** Es lo que SP2 enseñó a hacer con `Turno.fecha`, y acá es un error: `TurnoEvento.timestamp` es `DATETIME2`. Con `Date.UTC()` la pantalla muestra llamados de ayer entre las 21:00 y la medianoche.

3. **`ENTRAR_PANTALLA` no pide sesión.** Es deliberado: la TV no tiene login. Si se le copia la guarda de `ENTRAR_BOX`, la pantalla nunca carga.

4. **El identificador del llamado es el `eventoId`, no el id del turno.** Si se usa el del turno, rellamar el mismo número no suena la campanilla, que es exactamente lo que rellamar busca.

5. **La pantalla nunca se vacía.** Si el ack falla, se conserva el snapshot anterior. Poner un `setSnapshot(null)` en el camino de error rompe el requisito principal de degradación.

6. **El E2E que vale es el negativo.** Verificar que el llamado del Norte **no** aparece en el Sur es lo que prueba el ruteo por ala.
