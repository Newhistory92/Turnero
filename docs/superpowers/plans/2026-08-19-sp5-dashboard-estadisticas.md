# SP5 — Dashboard de estadísticas: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dos pantallas de estadísticas —"Hoy" operativa e "Histórico" de revisión— que leen el diario de eventos ya existente, con alcance por trámite para supervisores y productividad restringida a director y admin.

**Architecture:** Tres capas siguiendo el patrón de `lib/queue/`. Siete módulos puros en `lib/estadisticas/` que reciben arrays y devuelven objetos (sin Prisma, sin `next/*`), una única capa `consultas.ts` que toca Prisma y aplica el alcance, y Server Components en `app/tablero/` que componen. El filtro de autorización vive en la firma de las funciones de consulta, así que omitirlo no compila.

**Tech Stack:** Next.js 15.2.4 (App Router), React 19, Prisma 6 sobre SQL Server, Vitest, Playwright, Tailwind, Recharts (nuevo).

## Global Constraints

- **Rol nuevo `director`.** `Empleado.rol` es `String @db.VarChar(15)`, no enum: **no hay migración de datos** para el rol.
- `puedeVerTablero(rol)` → `supervisor | director | admin`. `puedeVerProductividad(rol)` → `director | admin`.
- `puedeVerCatalogo` y `puedeEditarCatalogo` **no cambian**: `director` no entra a `/admin`.
- **Alcance vacío = no ve nada.** Un `{ tipo: "limitado", tramiteIds: [] }` no devuelve filas.
- Toda función exportada de `lib/estadisticas/consultas.ts` recibe `alcance: Alcance` como **primer parámetro**.
- Todos los tiempos salen de `TurnoEvento.timestamp`. Nunca de `createdAt` ni del cliente.
- Clasificación: **anomalía** `< 30 s`, **breve** `>= 30 s` y `< duracionMinimaEsperada * 60`, **válida** el resto.
- **Personas** = turnos con `derivadoDeId === null`. **Atenciones** = todas las filas.
- La espera usa el evento `generado` **del propio turno**, nunca `createdAt` (los derivados heredan `createdAt` del original).
- Refresco de la vista Hoy: `router.refresh()` cada **45 s**.
- CSV con **BOM UTF-8** (`﻿`) al inicio, separador coma, comillas dobles escapadas duplicando.
- **Convención del repo:** los comentarios en código van **sin tildes** (`atencion`, `asi`, `aca`). Los textos de interfaz y los nombres de tests **sí llevan tildes**.
- Comentarios que expliquen **por qué**, no qué. Ver `lib/queue/disponibilidad.ts` como referencia de tono.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `lib/admin/acceso.ts` *(modificar)* | Suma `director` al vocabulario y los dos predicados nuevos |
| `lib/estadisticas/tipos.ts` | `Alcance`, `RangoFechas`, `Clasificacion` y tipos de retorno compartidos |
| `lib/estadisticas/alcance.ts` | Resuelve el `Alcance` de un `Actor` contra la base; helpers de filtro |
| `lib/estadisticas/duraciones.ts` | Espera, atención y clasificación de **un** turno desde sus eventos |
| `lib/estadisticas/volumen.ts` | Agregados por trámite, día y hora; promedio y mediana |
| `lib/estadisticas/derivaciones.ts` | Pares origen→destino y cadenas |
| `lib/estadisticas/productividad.ts` | Por empleado, con mediana por trámite |
| `lib/estadisticas/rango.ts` | Presets y parseo de rangos de fecha |
| `lib/estadisticas/csv.ts` | Serialización a CSV, con omisión de columnas por rol |
| `lib/estadisticas/consultas.ts` | Única capa que toca Prisma; aplica el alcance |
| `app/tablero/layout.tsx` | Guard `puedeVerTablero` + navegación |
| `app/tablero/page.tsx` | Vista Hoy |
| `app/tablero/AutoRefresco.tsx` | Cliente: `router.refresh()` cada 45 s |
| `app/tablero/historico/page.tsx` | Vista Histórico |
| `app/tablero/exportar/route.ts` | Descarga CSV |
| `app/tablero/_componentes/*` | Tarjeta, BarraRanking, TablaDatos, SelectorRango, SinAlcance, gráficos |
| `app/admin/alcance/*` | Asignación de trámites por supervisor |

---

## Task 1: Rol `director` y predicados del tablero

**Files:**
- Modify: `lib/admin/acceso.ts`
- Test: `tests/unit/acceso.test.ts` *(ya existe — hay que corregir un test que quedará roto)*

**Interfaces:**
- Consumes: nada.
- Produces: `Rol` (ahora con `"director"`), `ROLES`, `puedeVerTablero(rol: Rol): boolean`, `puedeVerProductividad(rol: Rol): boolean`.

> **Atención:** `tests/unit/acceso.test.ts` tiene hoy un test que afirma `expect([...ROLES]).toEqual(["operador", "supervisor", "admin"])`. Va a fallar. **No lo borres** — actualizalo al vocabulario nuevo. Es el test que impide que alguien agregue un rol sin darse cuenta.

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazá el test de vocabulario y agregá los dos bloques nuevos en `tests/unit/acceso.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  esRol,
  puedeVerCatalogo,
  puedeEditarCatalogo,
  puedeVerTablero,
  puedeVerProductividad,
  ROLES,
} from "@/lib/admin/acceso"

describe("vocabulario de roles", () => {
  it("son exactamente cuatro", () => {
    expect([...ROLES]).toEqual(["operador", "supervisor", "director", "admin"])
  })

  it("reconoce los válidos", () => {
    expect(esRol("admin")).toBe(true)
    expect(esRol("director")).toBe(true)
    expect(esRol("supervisor")).toBe(true)
    expect(esRol("operador")).toBe(true)
  })
})

describe("quién entra al tablero", () => {
  it("supervisor, director y admin entran", () => {
    expect(puedeVerTablero("supervisor")).toBe(true)
    expect(puedeVerTablero("director")).toBe(true)
    expect(puedeVerTablero("admin")).toBe(true)
  })

  it("el operador no entra", () => {
    expect(puedeVerTablero("operador")).toBe(false)
  })
})

describe("quién ve productividad por operador", () => {
  it("director y admin la ven", () => {
    expect(puedeVerProductividad("director")).toBe(true)
    expect(puedeVerProductividad("admin")).toBe(true)
  })

  // Mide personas: el supervisor ve volumen y derivaciones de su area,
  // pero no el rendimiento individual de quienes atienden.
  it("el supervisor no la ve", () => {
    expect(puedeVerProductividad("supervisor")).toBe(false)
    expect(puedeVerProductividad("operador")).toBe(false)
  })
})

describe("el catálogo no cambió", () => {
  // director es un rol de lectura con mas alcance, no un admin con otro
  // nombre: no administra el catalogo.
  it("director no entra al panel de catálogo", () => {
    expect(puedeVerCatalogo("director")).toBe(false)
    expect(puedeEditarCatalogo("director")).toBe(false)
  })

  it("admin ve y edita; supervisor ve pero no edita", () => {
    expect(puedeVerCatalogo("admin")).toBe(true)
    expect(puedeEditarCatalogo("admin")).toBe(true)
    expect(puedeVerCatalogo("supervisor")).toBe(true)
    expect(puedeEditarCatalogo("supervisor")).toBe(false)
  })
})
```

Conservá el test existente `"rechaza cualquier otra cosa"` tal como está.

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npx vitest run tests/unit/acceso.test.ts
```

Esperado: FAIL. `puedeVerTablero` y `puedeVerProductividad` no existen; el vocabulario tiene tres roles.

- [ ] **Step 3: Implementar**

En `lib/admin/acceso.ts`, reemplazá el tipo y la constante, y agregá los predicados debajo de `puedeEditarCatalogo`:

```ts
export type Rol = "operador" | "supervisor" | "director" | "admin"

export const ROLES = ["operador", "supervisor", "director", "admin"] as const
```

```ts
/**
 * El tablero es de lectura: lo ve todo el que supervisa, no solo quien
 * administra. director existe para eso — mas alcance de lectura sin tocar
 * el catalogo.
 */
export function puedeVerTablero(rol: Rol): boolean {
  return rol === "supervisor" || rol === "director" || rol === "admin"
}

/**
 * La productividad mide personas. Se separa del resto del tablero a
 * proposito: el supervisor ve el volumen y las derivaciones de su area,
 * pero el rendimiento individual queda arriba.
 */
export function puedeVerProductividad(rol: Rol): boolean {
  return rol === "director" || rol === "admin"
}
```

`puedeVerCatalogo` y `puedeEditarCatalogo` quedan **sin tocar**.

- [ ] **Step 4: Correr los tests**

```bash
npx vitest run tests/unit/acceso.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Correr la suite entera**

```bash
npm test
```

Esperado: PASS. Si algo más se rompe, es porque asumía tres roles — arreglalo, no lo silencies.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/acceso.ts tests/unit/acceso.test.ts
git commit -m "feat(sp5): rol director y predicados de acceso al tablero"
```

---

## Task 2: Modelo `AlcanceMetrica` e índices de eventos

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_sp5_alcance_metrica/migration.sql` *(lo genera Prisma)*
- Test: `tests/integration/alcanceMetrica.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: modelo Prisma `AlcanceMetrica` con clave compuesta `[empleadoId, tramiteId]`, accesible como `prisma.alcanceMetrica`.

- [ ] **Step 1: Escribir el test que falla**

Creá `tests/integration/alcanceMetrica.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"

const DNI_PRUEBA = "99999901"

async function limpiar() {
  await prisma.alcanceMetrica.deleteMany({
    where: { empleado: { dniInstitucional: DNI_PRUEBA } },
  })
  await prisma.empleado.deleteMany({ where: { dniInstitucional: DNI_PRUEBA } })
}

describe("AlcanceMetrica", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("asocia un empleado con varios trámites", async () => {
    const empleado = await prisma.empleado.create({
      data: { dniInstitucional: DNI_PRUEBA, nombre: "Super Prueba", rol: "supervisor" },
    })
    const tramites = await prisma.tramite.findMany({ take: 2 })
    expect(tramites.length).toBe(2)

    await prisma.alcanceMetrica.createMany({
      data: tramites.map((t) => ({ empleadoId: empleado.id, tramiteId: t.id })),
    })

    const filas = await prisma.alcanceMetrica.findMany({
      where: { empleadoId: empleado.id },
    })
    expect(filas).toHaveLength(2)
  })

  // La clave compuesta es lo que impide asignar dos veces el mismo tramite
  // al mismo supervisor y que despues el conteo lo cuente doble.
  it("rechaza el par duplicado", async () => {
    const empleado = await prisma.empleado.create({
      data: { dniInstitucional: DNI_PRUEBA, nombre: "Super Prueba", rol: "supervisor" },
    })
    const tramite = await prisma.tramite.findFirstOrThrow()

    await prisma.alcanceMetrica.create({
      data: { empleadoId: empleado.id, tramiteId: tramite.id },
    })

    await expect(
      prisma.alcanceMetrica.create({
        data: { empleadoId: empleado.id, tramiteId: tramite.id },
      })
    ).rejects.toThrow()
  })

  // Si se borra al supervisor su alcance se va con el: dejar filas huerfanas
  // apuntando a un empleado inexistente no le sirve a nadie.
  it("borra el alcance en cascada al borrar el empleado", async () => {
    const empleado = await prisma.empleado.create({
      data: { dniInstitucional: DNI_PRUEBA, nombre: "Super Prueba", rol: "supervisor" },
    })
    const tramite = await prisma.tramite.findFirstOrThrow()
    await prisma.alcanceMetrica.create({
      data: { empleadoId: empleado.id, tramiteId: tramite.id },
    })

    await prisma.empleado.delete({ where: { id: empleado.id } })

    const filas = await prisma.alcanceMetrica.findMany({
      where: { empleadoId: empleado.id },
    })
    expect(filas).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx dotenv -e .env.test.local -- vitest run tests/integration/alcanceMetrica.test.ts
```

Esperado: FAIL. `prisma.alcanceMetrica` no existe.

- [ ] **Step 3: Agregar el modelo y los índices al schema**

En `prisma/schema.prisma`, agregá el modelo al final:

```prisma
model AlcanceMetrica {
  empleadoId String
  tramiteId  String
  empleado   Empleado @relation(fields: [empleadoId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  tramite    Tramite  @relation(fields: [tramiteId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@id([empleadoId, tramiteId])
}
```

Agregá la relación inversa en `Empleado` (después de `eventos`):

```prisma
  alcances         AlcanceMetrica[]
```

Y en `Tramite` (después de `contadores`):

```prisma
  alcances               AlcanceMetrica[]
```

En `TurnoEvento`, agregá dos índices junto a los existentes:

```prisma
  @@index([turnoId])
  @@index([timestamp])
  @@index([empleadoId, timestamp])
  @@index([boxId, timestamp])
```

- [ ] **Step 4: Generar y aplicar la migración**

```bash
npx dotenv -e .env.local -- prisma migrate dev --name sp5_alcance_metrica
```

Esperado: crea la carpeta de migración y aplica. Después, aplicala también a la base de tests:

```bash
npm run db:test:migrate
```

- [ ] **Step 5: Correr el test**

```bash
npx dotenv -e .env.test.local -- vitest run tests/integration/alcanceMetrica.test.ts
```

Esperado: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/integration/alcanceMetrica.test.ts
git commit -m "feat(sp5): modelo AlcanceMetrica e indices de TurnoEvento"
```

---

## Task 3: Tipos compartidos y resolución del alcance

**Files:**
- Create: `lib/estadisticas/tipos.ts`
- Create: `lib/estadisticas/alcance.ts`
- Test: `tests/integration/alcance.test.ts`

**Interfaces:**
- Consumes: `Actor` de `@/lib/admin/acceso`; `prisma.alcanceMetrica` de la Task 2.
- Produces:
  - `type Alcance = { tipo: "todos" } | { tipo: "limitado"; tramiteIds: string[] }`
  - `interface RangoFechas { desde: Date; hasta: Date }`
  - `type Clasificacion = "anomalia" | "breve" | "valida"`
  - `alcanceDe(actor: Actor): Promise<Alcance>`
  - `sinAlcance(a: Alcance): boolean`
  - `filtroTramiteId(a: Alcance): { in: string[] } | undefined`

- [ ] **Step 1: Escribir el test que falla**

Creá `tests/integration/alcance.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import type { Actor } from "@/lib/admin/acceso"
import { alcanceDe, sinAlcance, filtroTramiteId } from "@/lib/estadisticas/alcance"

const DNI_PRUEBA = "99999902"

async function limpiar() {
  await prisma.alcanceMetrica.deleteMany({
    where: { empleado: { dniInstitucional: DNI_PRUEBA } },
  })
  await prisma.empleado.deleteMany({ where: { dniInstitucional: DNI_PRUEBA } })
}

async function supervisorCon(tramiteIds: string[]): Promise<Actor> {
  const empleado = await prisma.empleado.create({
    data: { dniInstitucional: DNI_PRUEBA, nombre: "Super Prueba", rol: "supervisor" },
  })
  if (tramiteIds.length > 0) {
    await prisma.alcanceMetrica.createMany({
      data: tramiteIds.map((tramiteId) => ({ empleadoId: empleado.id, tramiteId })),
    })
  }
  return { empleadoId: empleado.id, nombre: empleado.nombre, rol: "supervisor" }
}

describe("alcanceDe", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("director y admin ven todos los trámites", async () => {
    const director: Actor = { empleadoId: "x", nombre: "Dire", rol: "director" }
    const admin: Actor = { empleadoId: "y", nombre: "Admin", rol: "admin" }
    expect(await alcanceDe(director)).toEqual({ tipo: "todos" })
    expect(await alcanceDe(admin)).toEqual({ tipo: "todos" })
  })

  it("el supervisor queda limitado a los trámites asignados", async () => {
    const tramites = await prisma.tramite.findMany({ take: 2 })
    const actor = await supervisorCon(tramites.map((t) => t.id))

    const alcance = await alcanceDe(actor)
    expect(alcance.tipo).toBe("limitado")
    if (alcance.tipo !== "limitado") throw new Error("tipo inesperado")
    expect([...alcance.tramiteIds].sort()).toEqual(tramites.map((t) => t.id).sort())
  })

  // Denegar por defecto: sin configuracion no ve nada, y el tipo obliga a
  // distinguirlo de "todos" en vez de confundirlo con acceso total.
  it("el supervisor sin asignar queda limitado a nada", async () => {
    const actor = await supervisorCon([])
    const alcance = await alcanceDe(actor)
    expect(alcance).toEqual({ tipo: "limitado", tramiteIds: [] })
    expect(sinAlcance(alcance)).toBe(true)
  })
})

describe("helpers de alcance", () => {
  it("sinAlcance sólo es cierto para el limitado vacío", () => {
    expect(sinAlcance({ tipo: "todos" })).toBe(false)
    expect(sinAlcance({ tipo: "limitado", tramiteIds: ["a"] })).toBe(false)
    expect(sinAlcance({ tipo: "limitado", tramiteIds: [] })).toBe(true)
  })

  // undefined es como Prisma expresa "sin filtro"; el limitado vacio produce
  // { in: [] }, que no matchea nada. Los dos casos son opuestos a proposito.
  it("filtroTramiteId traduce a un where de Prisma", () => {
    expect(filtroTramiteId({ tipo: "todos" })).toBeUndefined()
    expect(filtroTramiteId({ tipo: "limitado", tramiteIds: ["a", "b"] })).toEqual({
      in: ["a", "b"],
    })
    expect(filtroTramiteId({ tipo: "limitado", tramiteIds: [] })).toEqual({ in: [] })
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx dotenv -e .env.test.local -- vitest run tests/integration/alcance.test.ts
```

Esperado: FAIL. No existe `@/lib/estadisticas/alcance`.

- [ ] **Step 3: Implementar los tipos**

Creá `lib/estadisticas/tipos.ts`:

```ts
/**
 * Que tramites puede ver quien esta consultando. El tipo distingue "todos"
 * de "ninguno" a proposito: con un string[] plano, un array vacio se leeria
 * como "sin filtro" por accidente, que es exactamente el error que no
 * queremos cometer en silencio en un limite de autorizacion.
 */
export type Alcance =
  | { tipo: "todos" }
  | { tipo: "limitado"; tramiteIds: string[] }

export interface RangoFechas {
  desde: Date
  hasta: Date
}

export type Clasificacion = "anomalia" | "breve" | "valida"
```

- [ ] **Step 4: Implementar la resolución**

Creá `lib/estadisticas/alcance.ts`:

```ts
import { prisma } from "@/lib/db"
import type { Actor } from "@/lib/admin/acceso"
import type { Alcance } from "./tipos"

export async function alcanceDe(actor: Actor): Promise<Alcance> {
  if (actor.rol === "director" || actor.rol === "admin") return { tipo: "todos" }

  const filas = await prisma.alcanceMetrica.findMany({
    where: { empleadoId: actor.empleadoId },
    select: { tramiteId: true },
  })

  return { tipo: "limitado", tramiteIds: filas.map((f) => f.tramiteId) }
}

/** Supervisor todavia sin configurar: no ve nada y hay que decirselo. */
export function sinAlcance(a: Alcance): boolean {
  return a.tipo === "limitado" && a.tramiteIds.length === 0
}

/**
 * Traduce el alcance a la forma que espera un where de Prisma. undefined es
 * como Prisma expresa "sin filtro"; { in: [] } no matchea nada, que es
 * justo lo que tiene que pasar con un alcance vacio.
 */
export function filtroTramiteId(a: Alcance): { in: string[] } | undefined {
  return a.tipo === "todos" ? undefined : { in: a.tramiteIds }
}
```

- [ ] **Step 5: Correr el test**

```bash
npx dotenv -e .env.test.local -- vitest run tests/integration/alcance.test.ts
```

Esperado: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/estadisticas/tipos.ts lib/estadisticas/alcance.ts tests/integration/alcance.test.ts
git commit -m "feat(sp5): tipos compartidos y resolucion del alcance por tramite"
```

---

## Task 4: Duraciones y clasificación de un turno

**Files:**
- Create: `lib/estadisticas/duraciones.ts`
- Test: `tests/unit/duraciones.test.ts`

**Interfaces:**
- Consumes: `Clasificacion` de `./tipos`; `TipoEvento` de `@/lib/queue/tipos`.
- Produces:
  - `interface EventoDuracion { tipo: TipoEvento; timestamp: Date }`
  - `interface Duraciones { esperaSegundos: number | null; esperaEnCurso: boolean; atencionSegundos: number | null; clasificacion: Clasificacion | null }`
  - `calcularDuraciones(eventos: EventoDuracion[], umbralMinutos: number, ahora?: Date): Duraciones`
  - `clasificar(atencionSegundos: number, umbralMinutos: number): Clasificacion`
  - `const SEGUNDOS_ANOMALIA = 30`

- [ ] **Step 1: Escribir los tests que fallan**

Creá `tests/unit/duraciones.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  calcularDuraciones,
  clasificar,
  SEGUNDOS_ANOMALIA,
  type EventoDuracion,
} from "@/lib/estadisticas/duraciones"

function ev(tipo: EventoDuracion["tipo"], hhmmss: string): EventoDuracion {
  return { tipo, timestamp: new Date(`2026-08-19T${hhmmss}-03:00`) }
}

const UMBRAL = 5 // minutos -> 300 segundos

describe("clasificar", () => {
  it("bajo 30 segundos es anomalía", () => {
    expect(clasificar(0, UMBRAL)).toBe("anomalia")
    expect(clasificar(29, UMBRAL)).toBe("anomalia")
  })

  // El borde exacto de 30 s ya no es anomalia: el umbral de anomalia es
  // "menos de 30", no "hasta 30".
  it("30 segundos exactos ya es breve", () => {
    expect(clasificar(SEGUNDOS_ANOMALIA, UMBRAL)).toBe("breve")
  })

  it("bajo el umbral del trámite es breve", () => {
    expect(clasificar(299, UMBRAL)).toBe("breve")
  })

  // El umbral exacto cuenta como valida: duracionMinimaEsperada es el minimo
  // esperado, no el primero que se descarta.
  it("el umbral exacto ya es válida", () => {
    expect(clasificar(300, UMBRAL)).toBe("valida")
    expect(clasificar(1200, UMBRAL)).toBe("valida")
  })
})

describe("calcularDuraciones", () => {
  it("mide espera y atención de un turno completo", () => {
    const r = calcularDuraciones(
      [
        ev("generado", "10:00:00"),
        ev("llamado", "10:05:00"),
        ev("iniciado", "10:06:00"),
        ev("finalizado", "10:20:00"),
      ],
      UMBRAL
    )
    expect(r.esperaSegundos).toBe(300)
    expect(r.esperaEnCurso).toBe(false)
    expect(r.atencionSegundos).toBe(840)
    expect(r.clasificacion).toBe("valida")
  })

  // La espera se mide contra el PRIMER llamado: si no respondio y lo
  // llamaron de nuevo, la espera real termino en el primero.
  it("usa el primer llamado, no el rellamado", () => {
    const r = calcularDuraciones(
      [
        ev("generado", "10:00:00"),
        ev("llamado", "10:05:00"),
        ev("ausente", "10:06:00"),
        ev("llamado", "10:30:00"),
        ev("iniciado", "10:31:00"),
        ev("finalizado", "10:45:00"),
      ],
      UMBRAL
    )
    expect(r.esperaSegundos).toBe(300)
  })

  // La maquina de estados permite derivar desde "llamado" sin pasar por
  // "iniciado": ese turno es una derivacion, no una atencion.
  it("un turno derivado sin iniciar no aporta tiempo de atención", () => {
    const r = calcularDuraciones(
      [ev("generado", "10:00:00"), ev("llamado", "10:05:00"), ev("derivado", "10:07:00")],
      UMBRAL
    )
    expect(r.esperaSegundos).toBe(300)
    expect(r.atencionSegundos).toBeNull()
    expect(r.clasificacion).toBeNull()
  })

  it("la derivación cierra la atención igual que finalizar", () => {
    const r = calcularDuraciones(
      [
        ev("generado", "10:00:00"),
        ev("llamado", "10:05:00"),
        ev("iniciado", "10:06:00"),
        ev("derivado", "10:16:00"),
      ],
      UMBRAL
    )
    expect(r.atencionSegundos).toBe(600)
    expect(r.clasificacion).toBe("valida")
  })

  it("marca la anomalía de una atención de segundos", () => {
    const r = calcularDuraciones(
      [
        ev("generado", "10:00:00"),
        ev("llamado", "10:05:00"),
        ev("iniciado", "10:06:00"),
        ev("finalizado", "10:06:20"),
      ],
      UMBRAL
    )
    expect(r.atencionSegundos).toBe(20)
    expect(r.clasificacion).toBe("anomalia")
  })

  it("un turno que sigue esperando tiene la espera abierta", () => {
    const ahora = new Date("2026-08-19T10:10:00-03:00")
    const r = calcularDuraciones([ev("generado", "10:00:00")], UMBRAL, ahora)
    expect(r.esperaSegundos).toBe(600)
    expect(r.esperaEnCurso).toBe(true)
    expect(r.atencionSegundos).toBeNull()
  })

  // Un abandonado nunca fue llamado, pero su espera SI termino: medirla
  // contra "ahora" la haria crecer para siempre.
  it("el abandonado cierra la espera en el abandono", () => {
    const ahora = new Date("2026-08-19T23:00:00-03:00")
    const r = calcularDuraciones(
      [ev("generado", "10:00:00"), ev("abandonado", "14:00:00")],
      UMBRAL,
      ahora
    )
    expect(r.esperaSegundos).toBe(4 * 3600)
    expect(r.esperaEnCurso).toBe(false)
  })

  it("tolera eventos desordenados", () => {
    const r = calcularDuraciones(
      [
        ev("finalizado", "10:20:00"),
        ev("generado", "10:00:00"),
        ev("iniciado", "10:06:00"),
        ev("llamado", "10:05:00"),
      ],
      UMBRAL
    )
    expect(r.esperaSegundos).toBe(300)
    expect(r.atencionSegundos).toBe(840)
  })

  // Sin evento generado no hay contra que medir. Devolver 0 mentiria.
  it("sin evento generado no inventa una espera", () => {
    const r = calcularDuraciones([ev("llamado", "10:05:00")], UMBRAL)
    expect(r.esperaSegundos).toBeNull()
    expect(r.esperaEnCurso).toBe(false)
  })

  it("una lista vacía no rompe", () => {
    const r = calcularDuraciones([], UMBRAL)
    expect(r).toEqual({
      esperaSegundos: null,
      esperaEnCurso: false,
      atencionSegundos: null,
      clasificacion: null,
    })
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npx vitest run tests/unit/duraciones.test.ts
```

Esperado: FAIL. No existe `@/lib/estadisticas/duraciones`.

- [ ] **Step 3: Implementar**

Creá `lib/estadisticas/duraciones.ts`:

```ts
import type { TipoEvento } from "@/lib/queue/tipos"
import type { Clasificacion } from "./tipos"

export interface EventoDuracion {
  tipo: TipoEvento
  timestamp: Date
}

export interface Duraciones {
  /** Segundos entre `generado` y el primer `llamado`. null si no hay con que medir. */
  esperaSegundos: number | null
  /** La persona sigue en la cola: la espera todavia esta corriendo. */
  esperaEnCurso: boolean
  /** Segundos entre `iniciado` y el evento terminal. null si nunca se inicio. */
  atencionSegundos: number | null
  clasificacion: Clasificacion | null
}

export const SEGUNDOS_ANOMALIA = 30

/** Eventos que cierran el paso del turno por el sistema. */
const TERMINALES: TipoEvento[] = ["finalizado", "derivado", "abandonado"]

/** Eventos que cierran una atencion ya iniciada. */
const CIERRAN_ATENCION: TipoEvento[] = ["finalizado", "derivado"]

function segundos(desde: Date, hasta: Date): number {
  return Math.round((hasta.getTime() - desde.getTime()) / 1000)
}

/**
 * Las tres categorias de §6.8 del spec base. El umbral es por tramite
 * (`duracionMinimaEsperada`), no global: comparar todo contra un mismo
 * numero castigaria a quien atiende los tramites largos.
 */
export function clasificar(atencionSegundos: number, umbralMinutos: number): Clasificacion {
  if (atencionSegundos < SEGUNDOS_ANOMALIA) return "anomalia"
  if (atencionSegundos < umbralMinutos * 60) return "breve"
  return "valida"
}

export function calcularDuraciones(
  eventos: EventoDuracion[],
  umbralMinutos: number,
  ahora: Date = new Date()
): Duraciones {
  const orden = [...eventos].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const primero = (tipo: TipoEvento) => orden.find((e) => e.tipo === tipo)

  const generado = primero("generado")
  const llamado = primero("llamado")
  const iniciado = primero("iniciado")
  const terminal = orden.find((e) => TERMINALES.includes(e.tipo))

  // La espera sale del evento `generado` del propio turno, nunca de
  // createdAt: los derivados heredan el createdAt del original, asi que
  // medir desde ahi le cargaria al segundo box la espera del primero.
  let esperaSegundos: number | null = null
  let esperaEnCurso = false

  if (generado) {
    if (llamado) {
      esperaSegundos = segundos(generado.timestamp, llamado.timestamp)
    } else if (terminal) {
      // Nunca lo llamaron, pero la espera termino igual (abandonado).
      esperaSegundos = segundos(generado.timestamp, terminal.timestamp)
    } else {
      esperaSegundos = segundos(generado.timestamp, ahora)
      esperaEnCurso = true
    }
  }

  let atencionSegundos: number | null = null
  if (iniciado) {
    const cierre = orden.find(
      (e) =>
        CIERRAN_ATENCION.includes(e.tipo) &&
        e.timestamp.getTime() >= iniciado.timestamp.getTime()
    )
    if (cierre) atencionSegundos = segundos(iniciado.timestamp, cierre.timestamp)
  }

  return {
    esperaSegundos,
    esperaEnCurso,
    atencionSegundos,
    clasificacion: atencionSegundos === null ? null : clasificar(atencionSegundos, umbralMinutos),
  }
}
```

- [ ] **Step 4: Correr los tests**

```bash
npx vitest run tests/unit/duraciones.test.ts
```

Esperado: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/estadisticas/duraciones.ts tests/unit/duraciones.test.ts
git commit -m "feat(sp5): duraciones y clasificacion de atenciones por tramite"
```

---

## Task 5: Agregados de volumen, promedio y mediana

**Files:**
- Create: `lib/estadisticas/fechas.ts`
- Create: `lib/estadisticas/volumen.ts`
- Test: `tests/unit/volumen.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores (módulos puros autónomos).
- Produces:
  - `aClaveFecha(d: Date): string` en `fechas.ts` — `YYYY-MM-DD` **local**. La Task 8 lo reexporta desde `rango.ts`; vive en su propio archivo para que los dos módulos lo compartan en vez de duplicarlo.
  - `interface TurnoVolumen { id: string; tramiteId: string; tramiteNombre: string; derivadoDeId: string | null; estado: string; generadoEn: Date | null; esperaSegundos: number | null }`
  - `interface LineaVolumen { tramiteId: string; tramiteNombre: string; personas: number; atenciones: number }`
  - `interface LineaEstado { tramiteId: string; tramiteNombre: string; cuantos: number }`
  - `porTramite(turnos: TurnoVolumen[]): LineaVolumen[]`
  - `porDia(turnos: TurnoVolumen[]): { fecha: string; personas: number }[]`
  - `porHora(turnos: TurnoVolumen[]): { hora: number; personas: number }[]` — siempre 24 elementos
  - `porTramiteYEstado(turnos: TurnoVolumen[], estados: string[]): LineaEstado[]`
  - `porHoraYEstado(turnos: TurnoVolumen[], estados: string[]): { hora: number; cuantos: number }[]` — siempre 24 elementos
  - `promedio(valores: (number | null)[]): number | null`
  - `mediana(valores: (number | null)[]): number | null`
  - `esPersona(t: { derivadoDeId: string | null }): boolean`

- [ ] **Step 1: Escribir los tests que fallan**

Creá `tests/unit/volumen.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  porTramite,
  porDia,
  porHora,
  porTramiteYEstado,
  porHoraYEstado,
  promedio,
  mediana,
  esPersona,
  type TurnoVolumen,
} from "@/lib/estadisticas/volumen"

function turno(p: Partial<TurnoVolumen> & { id: string }): TurnoVolumen {
  return {
    tramiteId: "t1",
    tramiteNombre: "Aportes",
    derivadoDeId: null,
    estado: "finalizado",
    generadoEn: new Date("2026-08-19T10:00:00-03:00"),
    esperaSegundos: 300,
    ...p,
  }
}

describe("promedio y mediana", () => {
  it("promedian ignorando los nulos", () => {
    expect(promedio([10, 20, null, 30])).toBe(20)
  })

  it("la mediana impar es el del medio", () => {
    expect(mediana([30, 10, 20])).toBe(20)
  })

  it("la mediana par promedia los dos del medio", () => {
    expect(mediana([10, 20, 30, 40])).toBe(25)
  })

  // Sin muestras no hay promedio. Devolver 0 se leeria como "tardaron cero".
  it("sin muestras devuelven null, no cero", () => {
    expect(promedio([])).toBeNull()
    expect(promedio([null, null])).toBeNull()
    expect(mediana([])).toBeNull()
  })
})

describe("personas contra atenciones", () => {
  // Una persona derivada deja dos filas en Turno. Contarlas como dos
  // personas convertiria un dia de muchas derivaciones en un dia de mucha
  // demanda, que es una conclusion distinta y falsa.
  it("el derivado es una atención más, no una persona más", () => {
    expect(esPersona({ derivadoDeId: null })).toBe(true)
    expect(esPersona({ derivadoDeId: "otro" })).toBe(false)
  })

  it("porTramite separa las dos magnitudes", () => {
    const r = porTramite([
      turno({ id: "a" }),
      turno({ id: "b" }),
      turno({ id: "c", derivadoDeId: "a", tramiteId: "t2", tramiteNombre: "Prótesis" }),
    ])

    expect(r).toEqual([
      { tramiteId: "t1", tramiteNombre: "Aportes", personas: 2, atenciones: 2 },
      { tramiteId: "t2", tramiteNombre: "Prótesis", personas: 0, atenciones: 1 },
    ])
  })

  it("ordena por personas descendente y desempata por nombre", () => {
    const r = porTramite([
      turno({ id: "a", tramiteId: "t2", tramiteNombre: "Zeta" }),
      turno({ id: "b", tramiteId: "t1", tramiteNombre: "Alfa" }),
      turno({ id: "c", tramiteId: "t3", tramiteNombre: "Beta" }),
      turno({ id: "d", tramiteId: "t3", tramiteNombre: "Beta" }),
    ])
    expect(r.map((l) => l.tramiteNombre)).toEqual(["Beta", "Alfa", "Zeta"])
  })
})

describe("porDia", () => {
  it("agrupa personas por fecha local en orden ascendente", () => {
    const r = porDia([
      turno({ id: "a", generadoEn: new Date("2026-08-19T10:00:00-03:00") }),
      turno({ id: "b", generadoEn: new Date("2026-08-18T11:00:00-03:00") }),
      turno({ id: "c", generadoEn: new Date("2026-08-19T15:00:00-03:00") }),
      turno({ id: "d", derivadoDeId: "a", generadoEn: new Date("2026-08-19T16:00:00-03:00") }),
    ])
    expect(r).toEqual([
      { fecha: "2026-08-18", personas: 1 },
      { fecha: "2026-08-19", personas: 2 },
    ])
  })

  it("descarta los que no tienen evento generado", () => {
    const r = porDia([turno({ id: "a", generadoEn: null })])
    expect(r).toEqual([])
  })
})

describe("porHora", () => {
  // Siempre 24 buckets para que el grafico tenga un eje estable entre
  // rangos: si el largo dependiera de los datos, dos consultas seguidas
  // dibujarian ejes distintos.
  it("devuelve las 24 horas siempre", () => {
    const r = porHora([])
    expect(r).toHaveLength(24)
    expect(r[0]).toEqual({ hora: 0, personas: 0 })
    expect(r[23]).toEqual({ hora: 23, personas: 0 })
  })

  it("cuenta sólo personas en su hora local", () => {
    const r = porHora([
      turno({ id: "a", generadoEn: new Date("2026-08-19T09:30:00-03:00") }),
      turno({ id: "b", generadoEn: new Date("2026-08-19T09:45:00-03:00") }),
      turno({ id: "c", generadoEn: new Date("2026-08-19T14:10:00-03:00") }),
      turno({ id: "d", derivadoDeId: "a", generadoEn: new Date("2026-08-19T09:50:00-03:00") }),
    ])
    expect(r[9]).toEqual({ hora: 9, personas: 2 })
    expect(r[14]).toEqual({ hora: 14, personas: 1 })
  })
})

describe("ausentes y abandonos", () => {
  it("cuenta por trámite sólo los estados pedidos", () => {
    const r = porTramiteYEstado(
      [
        turno({ id: "a", estado: "ausente" }),
        turno({ id: "b", estado: "abandonado" }),
        turno({ id: "c", estado: "finalizado" }),
        turno({ id: "d", estado: "ausente", tramiteId: "t2", tramiteNombre: "Prótesis" }),
      ],
      ["ausente"]
    )
    expect(r).toEqual([
      { tramiteId: "t1", tramiteNombre: "Aportes", cuantos: 1 },
      { tramiteId: "t2", tramiteNombre: "Prótesis", cuantos: 1 },
    ])
  })

  // Un tramite sin ausentes no aparece en la tabla: una fila en cero se
  // leeria como una medicion, y lo que hubo es ausencia de casos.
  it("omite los trámites sin ninguno de esos estados", () => {
    const r = porTramiteYEstado([turno({ id: "a", estado: "finalizado" })], ["ausente"])
    expect(r).toEqual([])
  })

  it("acepta varios estados a la vez y ordena descendente", () => {
    const r = porTramiteYEstado(
      [
        turno({ id: "a", estado: "ausente" }),
        turno({ id: "b", estado: "abandonado" }),
        turno({ id: "c", estado: "ausente", tramiteId: "t2", tramiteNombre: "Prótesis" }),
      ],
      ["ausente", "abandonado"]
    )
    expect(r.map((l) => [l.tramiteNombre, l.cuantos])).toEqual([
      ["Aportes", 2],
      ["Prótesis", 1],
    ])
  })

  // A diferencia del volumen, aca SI cuentan los derivados: un derivado que
  // no se presenta en el segundo box es una ausencia real de ese box.
  it("los derivados cuentan como ausencia propia", () => {
    const r = porTramiteYEstado(
      [turno({ id: "b", estado: "ausente", derivadoDeId: "a" })],
      ["ausente"]
    )
    expect(r[0].cuantos).toBe(1)
  })

  it("por hora devuelve 24 buckets y cuenta en la hora local", () => {
    const r = porHoraYEstado(
      [
        turno({
          id: "a",
          estado: "ausente",
          generadoEn: new Date("2026-08-19T11:20:00-03:00"),
        }),
        turno({
          id: "b",
          estado: "finalizado",
          generadoEn: new Date("2026-08-19T11:40:00-03:00"),
        }),
      ],
      ["ausente"]
    )
    expect(r).toHaveLength(24)
    expect(r[11]).toEqual({ hora: 11, cuantos: 1 })
    expect(r[12]).toEqual({ hora: 12, cuantos: 0 })
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npx vitest run tests/unit/volumen.test.ts
```

Esperado: FAIL. No existe `@/lib/estadisticas/volumen`.

- [ ] **Step 3: Implementar el formateo de fecha compartido**

Creá `lib/estadisticas/fechas.ts`:

```ts
/**
 * Fecha local en YYYY-MM-DD. No pasa por toISOString a proposito: en -03:00
 * un turno de las 22:00 ya es del dia siguiente en UTC y se contaria en el
 * dia equivocado.
 *
 * Vive en su propio archivo porque lo necesitan volumen.ts y rango.ts, y
 * dos copias se desincronizarian la primera vez que alguien toque una.
 */
export function aClaveFecha(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0")
  const dia = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mes}-${dia}`
}
```

- [ ] **Step 4: Implementar los agregados**

Creá `lib/estadisticas/volumen.ts`:

```ts
import { aClaveFecha } from "./fechas"

export interface TurnoVolumen {
  id: string
  tramiteId: string
  tramiteNombre: string
  derivadoDeId: string | null
  /** Estado final del turno: `finalizado`, `ausente`, `abandonado`, etc. */
  estado: string
  /** Timestamp del evento `generado`. null si el turno no lo tiene. */
  generadoEn: Date | null
  esperaSegundos: number | null
}

export interface LineaVolumen {
  tramiteId: string
  tramiteNombre: string
  personas: number
  atenciones: number
}

export interface LineaEstado {
  tramiteId: string
  tramiteNombre: string
  cuantos: number
}

/**
 * Una persona derivada deja dos filas en Turno: el origen y el destino. La
 * primera es la llegada real; la segunda es trabajo del segundo box, no una
 * persona nueva.
 */
export function esPersona(t: { derivadoDeId: string | null }): boolean {
  return t.derivadoDeId === null
}

function soloNumeros(valores: (number | null)[]): number[] {
  return valores.filter((v): v is number => v !== null)
}

export function promedio(valores: (number | null)[]): number | null {
  const n = soloNumeros(valores)
  if (n.length === 0) return null
  return n.reduce((a, b) => a + b, 0) / n.length
}

export function mediana(valores: (number | null)[]): number | null {
  const n = soloNumeros(valores).sort((a, b) => a - b)
  if (n.length === 0) return null
  const medio = Math.floor(n.length / 2)
  return n.length % 2 === 1 ? n[medio] : (n[medio - 1] + n[medio]) / 2
}

export function porTramite(turnos: TurnoVolumen[]): LineaVolumen[] {
  const acumulado = new Map<string, LineaVolumen>()

  for (const t of turnos) {
    const linea = acumulado.get(t.tramiteId) ?? {
      tramiteId: t.tramiteId,
      tramiteNombre: t.tramiteNombre,
      personas: 0,
      atenciones: 0,
    }
    linea.atenciones += 1
    if (esPersona(t)) linea.personas += 1
    acumulado.set(t.tramiteId, linea)
  }

  return [...acumulado.values()].sort(
    (a, b) => b.personas - a.personas || a.tramiteNombre.localeCompare(b.tramiteNombre)
  )
}

export function porDia(turnos: TurnoVolumen[]): { fecha: string; personas: number }[] {
  const cuenta = new Map<string, number>()

  for (const t of turnos) {
    if (!esPersona(t) || !t.generadoEn) continue
    const clave = aClaveFecha(t.generadoEn)
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
  }

  return [...cuenta.entries()]
    .map(([fecha, personas]) => ({ fecha, personas }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/**
 * Siempre 24 buckets, incluidos los vacios: si el largo dependiera de los
 * datos, dos rangos seguidos dibujarian ejes distintos y la comparacion
 * visual mentiria.
 */
export function porHora(turnos: TurnoVolumen[]): { hora: number; personas: number }[] {
  const horas = Array.from({ length: 24 }, (_, hora) => ({ hora, personas: 0 }))

  for (const t of turnos) {
    if (!esPersona(t) || !t.generadoEn) continue
    horas[t.generadoEn.getHours()].personas += 1
  }

  return horas
}

/**
 * Ausentes y abandonos por tramite. A diferencia del volumen, aca SI
 * cuentan los derivados: un derivado que no se presenta en el segundo box
 * es una ausencia real de ese box, no un eco de la primera cola.
 */
export function porTramiteYEstado(
  turnos: TurnoVolumen[],
  estados: string[]
): LineaEstado[] {
  const acumulado = new Map<string, LineaEstado>()

  for (const t of turnos) {
    if (!estados.includes(t.estado)) continue
    const linea = acumulado.get(t.tramiteId) ?? {
      tramiteId: t.tramiteId,
      tramiteNombre: t.tramiteNombre,
      cuantos: 0,
    }
    linea.cuantos += 1
    acumulado.set(t.tramiteId, linea)
  }

  return [...acumulado.values()].sort(
    (a, b) => b.cuantos - a.cuantos || a.tramiteNombre.localeCompare(b.tramiteNombre)
  )
}

/**
 * La misma cuenta repartida por hora. Una tasa de ausentes que sube a
 * determinada hora suele significar que la espera paso el punto en que la
 * gente se va a hacer otra cosa.
 */
export function porHoraYEstado(
  turnos: TurnoVolumen[],
  estados: string[]
): { hora: number; cuantos: number }[] {
  const horas = Array.from({ length: 24 }, (_, hora) => ({ hora, cuantos: 0 }))

  for (const t of turnos) {
    if (!estados.includes(t.estado) || !t.generadoEn) continue
    horas[t.generadoEn.getHours()].cuantos += 1
  }

  return horas
}
```

- [ ] **Step 5: Correr los tests**

```bash
npx vitest run tests/unit/volumen.test.ts
```

Esperado: PASS (16 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/estadisticas/fechas.ts lib/estadisticas/volumen.ts tests/unit/volumen.test.ts
git commit -m "feat(sp5): agregados de volumen, ausencias, promedio y mediana"
```

---

## Task 6: Derivaciones — pares y cadenas

**Files:**
- Create: `lib/estadisticas/derivaciones.ts`
- Test: `tests/unit/derivaciones.test.ts`

**Interfaces:**
- Consumes: nada (módulo puro autónomo).
- Produces:
  - `interface TurnoDerivacion { id: string; numero: string; tramiteId: string; tramiteNombre: string; derivadoDeId: string | null }`
  - `interface ParDerivacion { origenTramiteId: string; origenNombre: string; destinoTramiteId: string; destinoNombre: string; cuantas: number }`
  - `interface Cadena { turnoIds: string[]; numero: string; tramiteNombres: string[] }`
  - `pares(turnos: TurnoDerivacion[]): ParDerivacion[]`
  - `cadenas(turnos: TurnoDerivacion[], minimo?: number): Cadena[]` — `minimo` por defecto `3`

- [ ] **Step 1: Escribir los tests que fallan**

Creá `tests/unit/derivaciones.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { pares, cadenas, type TurnoDerivacion } from "@/lib/estadisticas/derivaciones"

function t(
  id: string,
  tramiteId: string,
  tramiteNombre: string,
  derivadoDeId: string | null = null
): TurnoDerivacion {
  return { id, numero: "AP01", tramiteId, tramiteNombre, derivadoDeId }
}

describe("pares origen→destino", () => {
  it("arma el par siguiendo derivadoDeId", () => {
    const r = pares([
      t("a", "t1", "Aportes"),
      t("b", "t2", "Prótesis", "a"),
    ])
    expect(r).toEqual([
      {
        origenTramiteId: "t1",
        origenNombre: "Aportes",
        destinoTramiteId: "t2",
        destinoNombre: "Prótesis",
        cuantas: 1,
      },
    ])
  })

  it("acumula el mismo par y ordena por cantidad", () => {
    const r = pares([
      t("a", "t1", "Aportes"),
      t("b", "t2", "Prótesis", "a"),
      t("c", "t1", "Aportes"),
      t("d", "t2", "Prótesis", "c"),
      t("e", "t1", "Aportes"),
      t("f", "t3", "Bioquímica", "e"),
    ])
    expect(r.map((p) => [p.destinoNombre, p.cuantas])).toEqual([
      ["Prótesis", 2],
      ["Bioquímica", 1],
    ])
  })

  // Si el origen quedo fuera del rango consultado no se puede nombrar el
  // par. Inventar un origen seria peor que omitir la fila.
  it("omite el derivado cuyo origen no está en la lista", () => {
    expect(pares([t("b", "t2", "Prótesis", "fuera-del-rango")])).toEqual([])
  })

  it("una lista sin derivaciones da vacío", () => {
    expect(pares([t("a", "t1", "Aportes"), t("b", "t2", "Prótesis")])).toEqual([])
  })
})

describe("cadenas", () => {
  // Tres o mas turnos encadenados suelen significar que nadie sabe de quien
  // es el tramite. Con dos todavia es una derivacion normal.
  it("una derivación simple no llega al mínimo de tres", () => {
    const r = cadenas([t("a", "t1", "Aportes"), t("b", "t2", "Prótesis", "a")])
    expect(r).toEqual([])
  })

  it("encuentra la cadena de tres y la devuelve de raíz a hoja", () => {
    const r = cadenas([
      t("a", "t1", "Aportes"),
      t("b", "t2", "Prótesis", "a"),
      t("c", "t3", "Bioquímica", "b"),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].turnoIds).toEqual(["a", "b", "c"])
    expect(r[0].tramiteNombres).toEqual(["Aportes", "Prótesis", "Bioquímica"])
  })

  // Solo la hoja genera cadena: si contaramos desde cada nodo, una cadena de
  // cuatro se reportaria tambien como su sub-cadena de tres.
  it("no reporta las sub-cadenas de una cadena más larga", () => {
    const r = cadenas([
      t("a", "t1", "Uno"),
      t("b", "t2", "Dos", "a"),
      t("c", "t3", "Tres", "b"),
      t("d", "t4", "Cuatro", "c"),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].turnoIds).toEqual(["a", "b", "c", "d"])
  })

  it("respeta un mínimo distinto", () => {
    const r = cadenas([t("a", "t1", "Aportes"), t("b", "t2", "Prótesis", "a")], 2)
    expect(r).toHaveLength(1)
    expect(r[0].turnoIds).toEqual(["a", "b"])
  })

  it("un turno suelto no es cadena", () => {
    expect(cadenas([t("a", "t1", "Aportes")])).toEqual([])
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npx vitest run tests/unit/derivaciones.test.ts
```

Esperado: FAIL. No existe `@/lib/estadisticas/derivaciones`.

- [ ] **Step 3: Implementar**

Creá `lib/estadisticas/derivaciones.ts`:

```ts
export interface TurnoDerivacion {
  id: string
  numero: string
  tramiteId: string
  tramiteNombre: string
  derivadoDeId: string | null
}

export interface ParDerivacion {
  origenTramiteId: string
  origenNombre: string
  destinoTramiteId: string
  destinoNombre: string
  cuantas: number
}

export interface Cadena {
  turnoIds: string[]
  numero: string
  tramiteNombres: string[]
}

/**
 * El par sale de la relacion, no del campo `detalle` del evento: el turno
 * destino ya conoce su tramiteId y su derivadoDeId. El detalle queda como
 * respaldo de auditoria, no como fuente de la metrica.
 */
export function pares(turnos: TurnoDerivacion[]): ParDerivacion[] {
  const porId = new Map(turnos.map((t) => [t.id, t]))
  const acumulado = new Map<string, ParDerivacion>()

  for (const destino of turnos) {
    if (!destino.derivadoDeId) continue
    const origen = porId.get(destino.derivadoDeId)
    // El origen puede haber quedado fuera del rango consultado: sin el no
    // se puede nombrar el par, y inventarlo seria peor que omitirlo.
    if (!origen) continue

    const clave = `${origen.tramiteId}->${destino.tramiteId}`
    const par = acumulado.get(clave) ?? {
      origenTramiteId: origen.tramiteId,
      origenNombre: origen.tramiteNombre,
      destinoTramiteId: destino.tramiteId,
      destinoNombre: destino.tramiteNombre,
      cuantas: 0,
    }
    par.cuantas += 1
    acumulado.set(clave, par)
  }

  return [...acumulado.values()].sort(
    (a, b) => b.cuantas - a.cuantas || a.origenNombre.localeCompare(b.origenNombre)
  )
}

/**
 * Cadenas de `minimo` turnos o mas. Solo las hojas generan cadena: contando
 * desde cada nodo, una cadena de cuatro se reportaria tambien como su
 * sub-cadena de tres y el conteo se inflaria.
 */
export function cadenas(turnos: TurnoDerivacion[], minimo = 3): Cadena[] {
  const porId = new Map(turnos.map((t) => [t.id, t]))
  const tienenHijo = new Set(
    turnos.map((t) => t.derivadoDeId).filter((id): id is string => id !== null)
  )

  const resultado: Cadena[] = []

  for (const hoja of turnos) {
    if (tienenHijo.has(hoja.id)) continue

    const camino: TurnoDerivacion[] = []
    let actual: TurnoDerivacion | undefined = hoja
    const vistos = new Set<string>()

    // El guard de `vistos` protege contra un ciclo en los datos: sin el,
    // una fila corrupta que se apunte a si misma colgaria el proceso.
    while (actual && !vistos.has(actual.id)) {
      vistos.add(actual.id)
      camino.unshift(actual)
      actual = actual.derivadoDeId ? porId.get(actual.derivadoDeId) : undefined
    }

    if (camino.length >= minimo) {
      resultado.push({
        turnoIds: camino.map((t) => t.id),
        numero: camino[0].numero,
        tramiteNombres: camino.map((t) => t.tramiteNombre),
      })
    }
  }

  return resultado.sort((a, b) => b.turnoIds.length - a.turnoIds.length)
}
```

- [ ] **Step 4: Correr los tests**

```bash
npx vitest run tests/unit/derivaciones.test.ts
```

Esperado: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/estadisticas/derivaciones.ts tests/unit/derivaciones.test.ts
git commit -m "feat(sp5): pares y cadenas de derivacion"
```

---

## Task 7: Productividad por empleado

**Files:**
- Create: `lib/estadisticas/productividad.ts`
- Test: `tests/unit/productividad.test.ts`

**Interfaces:**
- Consumes: `Clasificacion` de `./tipos`; `mediana` de `./volumen`.
- Produces:
  - `interface AtencionEmpleado { empleadoId: string; empleadoNombre: string; tramiteId: string; atencionSegundos: number | null; clasificacion: Clasificacion | null }`
  - `interface LineaProductividad { empleadoId: string; empleadoNombre: string; atendidos: number; validas: number; breves: number; anomalias: number; tiempoTotalSegundos: number; promedioSegundos: number | null; desvioContraMedianaSegundos: number | null }`
  - `medianasPorTramite(atenciones: AtencionEmpleado[]): Map<string, number>`
  - `porEmpleado(atenciones: AtencionEmpleado[]): LineaProductividad[]`

- [ ] **Step 1: Escribir los tests que fallan**

Creá `tests/unit/productividad.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  medianasPorTramite,
  porEmpleado,
  type AtencionEmpleado,
} from "@/lib/estadisticas/productividad"

function a(
  empleadoId: string,
  tramiteId: string,
  atencionSegundos: number | null,
  clasificacion: AtencionEmpleado["clasificacion"]
): AtencionEmpleado {
  return {
    empleadoId,
    empleadoNombre: `Emp ${empleadoId}`,
    tramiteId,
    atencionSegundos,
    clasificacion,
  }
}

describe("medianasPorTramite", () => {
  // Solo las validas entran en la mediana: incluir las anomalias la
  // arrastraria hacia abajo y todo el mundo pareceria lento contra ella.
  it("usa sólo las válidas", () => {
    const m = medianasPorTramite([
      a("e1", "t1", 300, "valida"),
      a("e1", "t1", 500, "valida"),
      a("e2", "t1", 10, "anomalia"),
      a("e2", "t1", 100, "breve"),
    ])
    expect(m.get("t1")).toBe(400)
  })

  it("separa por trámite", () => {
    const m = medianasPorTramite([
      a("e1", "t1", 300, "valida"),
      a("e1", "t2", 900, "valida"),
    ])
    expect(m.get("t1")).toBe(300)
    expect(m.get("t2")).toBe(900)
  })

  it("un trámite sin válidas no tiene mediana", () => {
    const m = medianasPorTramite([a("e1", "t1", 10, "anomalia")])
    expect(m.has("t1")).toBe(false)
  })
})

describe("porEmpleado", () => {
  it("cuenta atendidos y desglosa las tres categorías", () => {
    const r = porEmpleado([
      a("e1", "t1", 600, "valida"),
      a("e1", "t1", 100, "breve"),
      a("e1", "t1", 10, "anomalia"),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].atendidos).toBe(3)
    expect(r[0].validas).toBe(1)
    expect(r[0].breves).toBe(1)
    expect(r[0].anomalias).toBe(1)
    expect(r[0].tiempoTotalSegundos).toBe(710)
    expect(r[0].promedioSegundos).toBeCloseTo(710 / 3)
  })

  // El desvio compara contra la mediana DEL MISMO tramite: un promedio
  // global castigaria a quien atiende los tramites largos por el solo
  // hecho de atenderlos.
  it("el desvío compara contra la mediana del mismo trámite", () => {
    // Mediana de t1 = 300; mediana de t2 = 900.
    const r = porEmpleado([
      a("e1", "t1", 300, "valida"),
      a("e2", "t2", 900, "valida"),
      // e3 tarda 400 en t1 (100 sobre la mediana) y 800 en t2 (100 bajo).
      a("e3", "t1", 400, "valida"),
      a("e3", "t2", 800, "valida"),
    ])

    const e3 = r.find((l) => l.empleadoId === "e3")
    expect(e3).toBeDefined()
    // Promedio de (+100, -100) = 0: rinde en la mediana pese a que su
    // promedio crudo (600) no se parece al de nadie.
    expect(e3!.desvioContraMedianaSegundos).toBe(0)
  })

  it("el desvío ignora las no válidas", () => {
    const r = porEmpleado([
      a("e1", "t1", 300, "valida"),
      a("e1", "t1", 500, "valida"),
      a("e2", "t1", 900, "valida"),
      a("e2", "t1", 5, "anomalia"),
    ])
    // Mediana de t1 sobre validas [300, 500, 900] = 500.
    const e2 = r.find((l) => l.empleadoId === "e2")!
    expect(e2.desvioContraMedianaSegundos).toBe(400)
  })

  it("sin válidas el desvío es null, no cero", () => {
    const r = porEmpleado([a("e1", "t1", 10, "anomalia")])
    expect(r[0].desvioContraMedianaSegundos).toBeNull()
  })

  it("una atención sin tiempo no suma al total", () => {
    const r = porEmpleado([a("e1", "t1", null, null), a("e1", "t1", 300, "valida")])
    expect(r[0].atendidos).toBe(2)
    expect(r[0].tiempoTotalSegundos).toBe(300)
  })

  it("ordena por atendidos descendente", () => {
    const r = porEmpleado([
      a("e1", "t1", 300, "valida"),
      a("e2", "t1", 300, "valida"),
      a("e2", "t1", 300, "valida"),
    ])
    expect(r.map((l) => l.empleadoId)).toEqual(["e2", "e1"])
  })

  it("una lista vacía da vacío", () => {
    expect(porEmpleado([])).toEqual([])
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npx vitest run tests/unit/productividad.test.ts
```

Esperado: FAIL. No existe `@/lib/estadisticas/productividad`.

- [ ] **Step 3: Implementar**

Creá `lib/estadisticas/productividad.ts`:

```ts
import type { Clasificacion } from "./tipos"
import { mediana, promedio } from "./volumen"

export interface AtencionEmpleado {
  empleadoId: string
  empleadoNombre: string
  tramiteId: string
  atencionSegundos: number | null
  clasificacion: Clasificacion | null
}

export interface LineaProductividad {
  empleadoId: string
  empleadoNombre: string
  atendidos: number
  validas: number
  breves: number
  anomalias: number
  tiempoTotalSegundos: number
  promedioSegundos: number | null
  /**
   * Promedio de (atencion - mediana del mismo tramite) sobre las validas.
   * Positivo = mas lento que la mediana; negativo = mas rapido.
   */
  desvioContraMedianaSegundos: number | null
}

/**
 * Mediana de cada tramite sobre sus atenciones validas. Incluir breves y
 * anomalias la arrastraria hacia abajo y todo el mundo pareceria lento
 * contra ella.
 */
export function medianasPorTramite(atenciones: AtencionEmpleado[]): Map<string, number> {
  const porTramite = new Map<string, number[]>()

  for (const at of atenciones) {
    if (at.clasificacion !== "valida" || at.atencionSegundos === null) continue
    const lista = porTramite.get(at.tramiteId) ?? []
    lista.push(at.atencionSegundos)
    porTramite.set(at.tramiteId, lista)
  }

  const medianas = new Map<string, number>()
  for (const [tramiteId, valores] of porTramite) {
    const m = mediana(valores)
    if (m !== null) medianas.set(tramiteId, m)
  }
  return medianas
}

export function porEmpleado(atenciones: AtencionEmpleado[]): LineaProductividad[] {
  const medianas = medianasPorTramite(atenciones)
  const acumulado = new Map<string, LineaProductividad>()
  const desvios = new Map<string, number[]>()

  for (const at of atenciones) {
    const linea = acumulado.get(at.empleadoId) ?? {
      empleadoId: at.empleadoId,
      empleadoNombre: at.empleadoNombre,
      atendidos: 0,
      validas: 0,
      breves: 0,
      anomalias: 0,
      tiempoTotalSegundos: 0,
      promedioSegundos: null,
      desvioContraMedianaSegundos: null,
    }

    linea.atendidos += 1
    if (at.atencionSegundos !== null) linea.tiempoTotalSegundos += at.atencionSegundos
    if (at.clasificacion === "valida") linea.validas += 1
    if (at.clasificacion === "breve") linea.breves += 1
    if (at.clasificacion === "anomalia") linea.anomalias += 1

    acumulado.set(at.empleadoId, linea)

    const medianaTramite = medianas.get(at.tramiteId)
    if (
      at.clasificacion === "valida" &&
      at.atencionSegundos !== null &&
      medianaTramite !== undefined
    ) {
      const lista = desvios.get(at.empleadoId) ?? []
      lista.push(at.atencionSegundos - medianaTramite)
      desvios.set(at.empleadoId, lista)
    }
  }

  // Los tiempos por empleado se promedian sobre las atenciones que tienen
  // tiempo: dividir por `atendidos` incluiria las derivadas sin iniciar y
  // bajaria el promedio sin motivo.
  for (const [empleadoId, linea] of acumulado) {
    const conTiempo = atenciones
      .filter((at) => at.empleadoId === empleadoId)
      .map((at) => at.atencionSegundos)
    linea.promedioSegundos = promedio(conTiempo)
    linea.desvioContraMedianaSegundos = promedio(desvios.get(empleadoId) ?? [])
  }

  return [...acumulado.values()].sort(
    (a, b) => b.atendidos - a.atendidos || a.empleadoNombre.localeCompare(b.empleadoNombre)
  )
}
```

- [ ] **Step 4: Correr los tests**

```bash
npx vitest run tests/unit/productividad.test.ts
```

Esperado: PASS (11 tests). Si el test `"cuenta atendidos y desglosa las tres categorías"` falla en `promedioSegundos`, revisá que el promedio se calcule sobre las atenciones **con tiempo** (710/3 en ese caso porque las tres tienen tiempo).

- [ ] **Step 5: Commit**

```bash
git add lib/estadisticas/productividad.ts tests/unit/productividad.test.ts
git commit -m "feat(sp5): productividad por empleado contra la mediana del tramite"
```

---

## Task 8: Rangos de fecha

**Files:**
- Create: `lib/estadisticas/rango.ts`
- Test: `tests/unit/rango.test.ts`

**Interfaces:**
- Consumes: `RangoFechas` de `./tipos`; `aClaveFecha` de `./fechas` (Task 5).
- Produces:
  - `type Preset = "hoy" | "semana" | "mes"`
  - `const PRESETS: readonly Preset[]`
  - `presetA(preset: Preset, ahora?: Date): RangoFechas`
  - `parsearRango(desde: string | undefined, hasta: string | undefined, ahora?: Date): { rango: RangoFechas; corregido: boolean }`
  - **Reexporta** `aClaveFecha` desde `./fechas`, para que las páginas la importen del mismo módulo del que ya traen `presetA`.

- [ ] **Step 1: Escribir los tests que fallan**

Creá `tests/unit/rango.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { presetA, parsearRango, aClaveFecha } from "@/lib/estadisticas/rango"

const AHORA = new Date("2026-08-19T15:30:00-03:00")

describe("aClaveFecha", () => {
  it("usa la fecha local, no la UTC", () => {
    // 22:00 en -03:00 ya es el dia siguiente en UTC: si la clave saliera de
    // toISOString, un turno de la tarde se contaria en el dia equivocado.
    expect(aClaveFecha(new Date("2026-08-19T22:00:00-03:00"))).toBe("2026-08-19")
  })
})

describe("presetA", () => {
  it("hoy va del arranque al cierre del día", () => {
    const r = presetA("hoy", AHORA)
    expect(aClaveFecha(r.desde)).toBe("2026-08-19")
    expect(aClaveFecha(r.hasta)).toBe("2026-08-19")
    expect(r.desde.getHours()).toBe(0)
    expect(r.desde.getMinutes()).toBe(0)
    expect(r.hasta.getHours()).toBe(23)
    expect(r.hasta.getMinutes()).toBe(59)
  })

  it("semana son siete días contando hoy", () => {
    const r = presetA("semana", AHORA)
    expect(aClaveFecha(r.desde)).toBe("2026-08-13")
    expect(aClaveFecha(r.hasta)).toBe("2026-08-19")
  })

  it("mes son treinta días contando hoy", () => {
    const r = presetA("mes", AHORA)
    expect(aClaveFecha(r.desde)).toBe("2026-07-21")
    expect(aClaveFecha(r.hasta)).toBe("2026-08-19")
  })
})

describe("parsearRango", () => {
  it("acepta un rango válido sin corregirlo", () => {
    const { rango, corregido } = parsearRango("2026-08-01", "2026-08-10", AHORA)
    expect(corregido).toBe(false)
    expect(aClaveFecha(rango.desde)).toBe("2026-08-01")
    expect(aClaveFecha(rango.hasta)).toBe("2026-08-10")
  })

  it("un solo día es un rango válido", () => {
    const { rango, corregido } = parsearRango("2026-08-05", "2026-08-05", AHORA)
    expect(corregido).toBe(false)
    expect(aClaveFecha(rango.desde)).toBe("2026-08-05")
    expect(rango.hasta.getHours()).toBe(23)
  })

  // Cae al preset "mes" y AVISA. Devolver vacio en silencio haria que el
  // usuario leyera "no hubo turnos" cuando lo que hubo fue un error de tipeo.
  it("un rango invertido cae al mes y se marca corregido", () => {
    const { rango, corregido } = parsearRango("2026-08-10", "2026-08-01", AHORA)
    expect(corregido).toBe(true)
    expect(aClaveFecha(rango.desde)).toBe("2026-07-21")
  })

  it("una fecha ilegible cae al mes y se marca corregido", () => {
    const { corregido } = parsearRango("ayer", "2026-08-10", AHORA)
    expect(corregido).toBe(true)
  })

  it("una fecha inexistente cae al mes", () => {
    const { corregido } = parsearRango("2026-02-31", "2026-08-10", AHORA)
    expect(corregido).toBe(true)
  })

  // Entrar sin parametros es el caso normal, no un error: no se avisa nada.
  it("sin parámetros usa el mes sin marcar corrección", () => {
    const { rango, corregido } = parsearRango(undefined, undefined, AHORA)
    expect(corregido).toBe(false)
    expect(aClaveFecha(rango.desde)).toBe("2026-07-21")
    expect(aClaveFecha(rango.hasta)).toBe("2026-08-19")
  })

  it("un solo parámetro también cae al mes y avisa", () => {
    const { corregido } = parsearRango("2026-08-01", undefined, AHORA)
    expect(corregido).toBe(true)
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npx vitest run tests/unit/rango.test.ts
```

Esperado: FAIL. No existe `@/lib/estadisticas/rango`.

- [ ] **Step 3: Implementar**

Creá `lib/estadisticas/rango.ts`:

```ts
import type { RangoFechas } from "./tipos"
import { aClaveFecha } from "./fechas"

// Se reexporta para que las paginas la traigan del mismo modulo del que ya
// importan presetA, en vez de tener que conocer dos rutas.
export { aClaveFecha }

export type Preset = "hoy" | "semana" | "mes"

export const PRESETS = ["hoy", "semana", "mes"] as const

/** Cuantos dias abarca cada preset, contando hoy. */
const DIAS: Record<Preset, number> = { hoy: 1, semana: 7, mes: 30 }

const FORMATO = /^\d{4}-\d{2}-\d{2}$/

function arranqueDelDia(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function cierreDelDia(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

export function presetA(preset: Preset, ahora: Date = new Date()): RangoFechas {
  const desde = arranqueDelDia(ahora)
  desde.setDate(desde.getDate() - (DIAS[preset] - 1))
  return { desde, hasta: cierreDelDia(ahora) }
}

/**
 * Construye una fecha local desde YYYY-MM-DD. Devuelve null si el texto no
 * tiene el formato o si describe un dia que no existe (new Date lo
 * corregiria en silencio: "2026-02-31" se volveria marzo).
 */
function aFechaLocal(texto: string): Date | null {
  if (!FORMATO.test(texto)) return null
  const [anio, mes, dia] = texto.split("-").map(Number)
  const d = new Date(anio, mes - 1, dia)
  if (d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null
  return d
}

/**
 * `corregido` distingue "entraste sin parametros" de "lo que mandaste no
 * servia". Solo el segundo caso merece un aviso en pantalla; devolver vacio
 * en silencio haria leer "no hubo turnos" donde hubo un error de tipeo.
 */
export function parsearRango(
  desde: string | undefined,
  hasta: string | undefined,
  ahora: Date = new Date()
): { rango: RangoFechas; corregido: boolean } {
  if (desde === undefined && hasta === undefined) {
    return { rango: presetA("mes", ahora), corregido: false }
  }

  const d = desde ? aFechaLocal(desde) : null
  const h = hasta ? aFechaLocal(hasta) : null

  if (!d || !h || d.getTime() > h.getTime()) {
    return { rango: presetA("mes", ahora), corregido: true }
  }

  return { rango: { desde: arranqueDelDia(d), hasta: cierreDelDia(h) }, corregido: false }
}
```

- [ ] **Step 4: Correr los tests**

```bash
npx vitest run tests/unit/rango.test.ts
```

Esperado: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/estadisticas/rango.ts tests/unit/rango.test.ts
git commit -m "feat(sp5): presets y parseo de rangos de fecha"
```

---

## Task 9: Serialización a CSV

**Files:**
- Create: `lib/estadisticas/csv.ts`
- Test: `tests/unit/csv.test.ts`

**Interfaces:**
- Consumes: `Clasificacion` de `./tipos`.
- Produces:
  - `interface FilaExportable { numero: string; fecha: string; tramiteNombre: string; estado: string; derivado: boolean; esperaSegundos: number | null; boxNombre: string | null; empleadoNombre: string | null; atencionSegundos: number | null; clasificacion: Clasificacion | null }`
  - `aCsv(filas: FilaExportable[], verProductividad: boolean): string`
  - `const BOM = "﻿"`

- [ ] **Step 1: Escribir los tests que fallan**

Creá `tests/unit/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { aCsv, BOM, type FilaExportable } from "@/lib/estadisticas/csv"

function fila(p: Partial<FilaExportable> = {}): FilaExportable {
  return {
    numero: "AP01",
    fecha: "2026-08-19",
    tramiteNombre: "Aportes",
    estado: "finalizado",
    derivado: false,
    esperaSegundos: 300,
    boxNombre: "Box 1",
    empleadoNombre: "Pérez, Ana",
    atencionSegundos: 840,
    clasificacion: "valida",
    ...p,
  }
}

describe("aCsv", () => {
  // Sin BOM, Excel en Windows abre el archivo en la codificacion del sistema
  // y los acentos salen rotos.
  it("arranca con el BOM de UTF-8", () => {
    expect(aCsv([], true).startsWith(BOM)).toBe(true)
  })

  it("incluye las columnas de productividad para quien puede verlas", () => {
    const csv = aCsv([fila()], true)
    const [encabezado, primera] = csv.replace(BOM, "").split("\r\n")
    expect(encabezado).toContain("operador")
    expect(encabezado).toContain("atencion_segundos")
    expect(encabezado).toContain("clasificacion")
    expect(primera).toContain("Pérez, Ana")
    expect(primera).toContain("840")
  })

  // El CSV es la puerta de atras clasica: si la pantalla filtra y el archivo
  // no, el control de acceso no existe.
  it("omite las columnas de productividad para quien no puede verlas", () => {
    const csv = aCsv([fila()], false)
    const [encabezado, primera] = csv.replace(BOM, "").split("\r\n")
    expect(encabezado).not.toContain("operador")
    expect(encabezado).not.toContain("atencion_segundos")
    expect(encabezado).not.toContain("clasificacion")
    expect(primera).not.toContain("Pérez, Ana")
    expect(primera).not.toContain("840")
    // Lo que no es productividad sigue estando.
    expect(encabezado).toContain("numero")
    expect(primera).toContain("AP01")
  })

  // "Pérez, Ana" lleva coma: sin comillas partiria la fila en dos columnas.
  it("encierra los campos entre comillas", () => {
    const csv = aCsv([fila({ tramiteNombre: "Otros, varios" })], false)
    expect(csv).toContain('"Otros, varios"')
  })

  it("escapa las comillas duplicándolas", () => {
    const csv = aCsv([fila({ tramiteNombre: 'El "especial"' })], false)
    expect(csv).toContain('"El ""especial"""')
  })

  it("los nulos quedan como celda vacía", () => {
    const csv = aCsv([fila({ esperaSegundos: null, atencionSegundos: null })], true)
    const primera = csv.replace(BOM, "").split("\r\n")[1]
    expect(primera).toContain('""')
  })

  it("el booleano derivado sale como sí o no", () => {
    expect(aCsv([fila({ derivado: true })], false)).toContain('"sí"')
    expect(aCsv([fila({ derivado: false })], false)).toContain('"no"')
  })

  it("sin filas devuelve sólo el encabezado", () => {
    const lineas = aCsv([], false).replace(BOM, "").split("\r\n")
    expect(lineas).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
npx vitest run tests/unit/csv.test.ts
```

Esperado: FAIL. No existe `@/lib/estadisticas/csv`.

- [ ] **Step 3: Implementar**

Creá `lib/estadisticas/csv.ts`:

```ts
import type { Clasificacion } from "./tipos"

export interface FilaExportable {
  numero: string
  fecha: string
  tramiteNombre: string
  estado: string
  derivado: boolean
  esperaSegundos: number | null
  boxNombre: string | null
  empleadoNombre: string | null
  atencionSegundos: number | null
  clasificacion: Clasificacion | null
}

/**
 * Sin el BOM, Excel en Windows abre el archivo en la codificacion del
 * sistema y los acentos salen rotos.
 */
export const BOM = "﻿"

const COLUMNAS_BASE = ["numero", "fecha", "tramite", "estado", "derivado", "espera_segundos"]

const COLUMNAS_PRODUCTIVIDAD = ["box", "operador", "atencion_segundos", "clasificacion"]

function celda(v: string | number | null): string {
  if (v === null) return '""'
  return `"${String(v).replace(/"/g, '""')}"`
}

/**
 * `verProductividad` no es cosmetico: el CSV es la puerta de atras clasica
 * del control de acceso. Si la pantalla filtra y el archivo no, el filtro
 * de la pantalla no vale nada.
 */
export function aCsv(filas: FilaExportable[], verProductividad: boolean): string {
  const columnas = verProductividad
    ? [...COLUMNAS_BASE, ...COLUMNAS_PRODUCTIVIDAD]
    : COLUMNAS_BASE

  const lineas = [columnas.map(celda).join(",")]

  for (const f of filas) {
    const base = [
      celda(f.numero),
      celda(f.fecha),
      celda(f.tramiteNombre),
      celda(f.estado),
      celda(f.derivado ? "sí" : "no"),
      celda(f.esperaSegundos),
    ]

    const extra = verProductividad
      ? [
          celda(f.boxNombre),
          celda(f.empleadoNombre),
          celda(f.atencionSegundos),
          celda(f.clasificacion),
        ]
      : []

    lineas.push([...base, ...extra].join(","))
  }

  return BOM + lineas.join("\r\n")
}
```

- [ ] **Step 4: Correr los tests**

```bash
npx vitest run tests/unit/csv.test.ts
```

Esperado: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/estadisticas/csv.ts tests/unit/csv.test.ts
git commit -m "feat(sp5): serializacion a CSV con omision de columnas por rol"
```

---

## Task 10: Capa de consultas con alcance

**Files:**
- Create: `lib/estadisticas/consultas.ts`
- Test: `tests/integration/consultas.test.ts`

**Interfaces:**
- Consumes: `Alcance`, `RangoFechas` de `./tipos`; `filtroTramiteId` de `./alcance`; `EventoDuracion` de `./duraciones`.
- Produces:
  - `interface FilaTurno { id: string; numero: string; fecha: Date; tramiteId: string; tramiteNombre: string; umbralMinutos: number; derivadoDeId: string | null; estado: string; boxId: string | null; boxNombre: string | null; empleadoId: string | null; empleadoNombre: string | null; eventos: EventoDuracion[] }`
  - `interface LineaCola { tramiteId: string; tramiteNombre: string; esperando: number; esperaMasViejaSegundos: number | null }`
  - `interface EstadoBox { boxId: string; boxNombre: string; alaNombre: string; empleadoNombre: string | null; estado: "atendiendo" | "ocioso" | "cerrado"; turnoNumero: string | null }`
  - `turnosDelRango(alcance: Alcance, rango: RangoFechas): Promise<FilaTurno[]>`
  - `colaActual(alcance: Alcance, ahora?: Date): Promise<LineaCola[]>`
  - `estadoBoxes(alcance: Alcance): Promise<EstadoBox[]>`

- [ ] **Step 1: Escribir el test que falla**

Creá `tests/integration/consultas.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { turnosDelRango, colaActual } from "@/lib/estadisticas/consultas"
import type { Alcance } from "@/lib/estadisticas/tipos"

const REQUEST_PREFIJO = "sp5-consultas-"

async function limpiar() {
  const turnos = await prisma.turno.findMany({
    where: { requestId: { startsWith: REQUEST_PREFIJO } },
    select: { id: true },
  })
  const ids = turnos.map((t) => t.id)
  if (ids.length > 0) {
    await prisma.turnoEvento.deleteMany({ where: { turnoId: { in: ids } } })
    await prisma.turno.deleteMany({ where: { id: { in: ids } } })
  }
}

async function crearTurno(tramiteId: string, sufijo: string) {
  const turno = await prisma.turno.create({
    data: {
      numero: `ZZ${sufijo}`,
      fecha: new Date(),
      tramiteId,
      estado: "esperando",
      requestId: `${REQUEST_PREFIJO}${sufijo}`,
    },
  })
  await prisma.turnoEvento.create({ data: { turnoId: turno.id, tipo: "generado" } })
  return turno
}

function hoy() {
  const desde = new Date()
  desde.setHours(0, 0, 0, 0)
  const hasta = new Date()
  hasta.setHours(23, 59, 59, 999)
  return { desde, hasta }
}

describe("consultas con alcance", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("con alcance total trae los turnos de todos los trámites", async () => {
    const [t1, t2] = await prisma.tramite.findMany({ take: 2 })
    await crearTurno(t1.id, "a")
    await crearTurno(t2.id, "b")

    const filas = await turnosDelRango({ tipo: "todos" }, hoy())
    const mios = filas.filter((f) => f.numero.startsWith("ZZ"))
    expect(mios).toHaveLength(2)
  })

  // El caso que importa es el negativo: que lo de afuera del alcance NO
  // aparezca. Que lo de adentro aparezca es la parte facil.
  it("el alcance limitado deja afuera los otros trámites", async () => {
    const [t1, t2] = await prisma.tramite.findMany({ take: 2 })
    await crearTurno(t1.id, "a")
    await crearTurno(t2.id, "b")

    const alcance: Alcance = { tipo: "limitado", tramiteIds: [t1.id] }
    const filas = await turnosDelRango(alcance, hoy())
    const mios = filas.filter((f) => f.numero.startsWith("ZZ"))

    expect(mios).toHaveLength(1)
    expect(mios[0].tramiteId).toBe(t1.id)
  })

  // Denegar por defecto: el supervisor sin configurar no ve NADA, ni
  // siquiera un total agregado del que pueda deducir volumen.
  it("el alcance vacío no devuelve ninguna fila", async () => {
    const t1 = await prisma.tramite.findFirstOrThrow()
    await crearTurno(t1.id, "a")

    const filas = await turnosDelRango({ tipo: "limitado", tramiteIds: [] }, hoy())
    expect(filas).toHaveLength(0)
  })

  it("trae los eventos de cada turno para poder medir tiempos", async () => {
    const t1 = await prisma.tramite.findFirstOrThrow()
    await crearTurno(t1.id, "a")

    const filas = await turnosDelRango({ tipo: "todos" }, hoy())
    const mia = filas.find((f) => f.numero === "ZZa")
    expect(mia).toBeDefined()
    expect(mia!.eventos.some((e) => e.tipo === "generado")).toBe(true)
    expect(mia!.umbralMinutos).toBe(t1.duracionMinimaEsperada)
  })

  it("la cola actual también respeta el alcance", async () => {
    const [t1, t2] = await prisma.tramite.findMany({ take: 2 })
    await crearTurno(t1.id, "a")
    await crearTurno(t2.id, "b")

    const lineas = await colaActual({ tipo: "limitado", tramiteIds: [t1.id] })
    expect(lineas.every((l) => l.tramiteId === t1.id)).toBe(true)
    expect(lineas.find((l) => l.tramiteId === t2.id)).toBeUndefined()
  })

  it("la cola vacía por alcance no devuelve líneas", async () => {
    const t1 = await prisma.tramite.findFirstOrThrow()
    await crearTurno(t1.id, "a")
    expect(await colaActual({ tipo: "limitado", tramiteIds: [] })).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx dotenv -e .env.test.local -- vitest run tests/integration/consultas.test.ts
```

Esperado: FAIL. No existe `@/lib/estadisticas/consultas`.

- [ ] **Step 3: Implementar**

Creá `lib/estadisticas/consultas.ts`:

```ts
import { prisma } from "@/lib/db"
import type { TipoEvento } from "@/lib/queue/tipos"
import type { Alcance, RangoFechas } from "./tipos"
import { filtroTramiteId } from "./alcance"
import type { EventoDuracion } from "./duraciones"

export interface FilaTurno {
  id: string
  numero: string
  fecha: Date
  tramiteId: string
  tramiteNombre: string
  umbralMinutos: number
  derivadoDeId: string | null
  estado: string
  boxId: string | null
  boxNombre: string | null
  empleadoId: string | null
  empleadoNombre: string | null
  eventos: EventoDuracion[]
}

export interface LineaCola {
  tramiteId: string
  tramiteNombre: string
  esperando: number
  esperaMasViejaSegundos: number | null
}

export interface EstadoBox {
  boxId: string
  boxNombre: string
  alaNombre: string
  empleadoNombre: string | null
  estado: "atendiendo" | "ocioso" | "cerrado"
  turnoNumero: string | null
}

/**
 * El alcance va primero en la firma de todas estas funciones a proposito:
 * es un limite de autorizacion, no un filtro opcional, y como parametro
 * obligatorio no se puede olvidar sin que deje de compilar.
 */
export async function turnosDelRango(
  alcance: Alcance,
  rango: RangoFechas
): Promise<FilaTurno[]> {
  const turnos = await prisma.turno.findMany({
    where: {
      fecha: { gte: rango.desde, lte: rango.hasta },
      tramiteId: filtroTramiteId(alcance),
    },
    include: {
      tramite: { select: { nombre: true, duracionMinimaEsperada: true } },
      box: { select: { nombre: true } },
      eventos: {
        select: { tipo: true, timestamp: true, empleadoId: true, empleado: { select: { nombre: true } } },
        orderBy: { timestamp: "asc" },
      },
    },
  })

  return turnos.map((t) => {
    // El empleado de la atencion es el que la inicio; si el turno se
    // finalizo sin iniciar (no deberia pasar), vale el del cierre.
    const conEmpleado =
      t.eventos.find((e) => e.tipo === "iniciado" && e.empleadoId) ??
      t.eventos.find((e) => e.tipo === "finalizado" && e.empleadoId) ??
      null

    return {
      id: t.id,
      numero: t.numero,
      fecha: t.fecha,
      tramiteId: t.tramiteId,
      tramiteNombre: t.tramite.nombre,
      umbralMinutos: t.tramite.duracionMinimaEsperada,
      derivadoDeId: t.derivadoDeId,
      estado: t.estado,
      boxId: t.boxId,
      boxNombre: t.box?.nombre ?? null,
      empleadoId: conEmpleado?.empleadoId ?? null,
      empleadoNombre: conEmpleado?.empleado?.nombre ?? null,
      eventos: t.eventos.map((e) => ({
        tipo: e.tipo as TipoEvento,
        timestamp: e.timestamp,
      })),
    }
  })
}

export async function colaActual(
  alcance: Alcance,
  ahora: Date = new Date()
): Promise<LineaCola[]> {
  const turnos = await prisma.turno.findMany({
    where: { estado: "esperando", tramiteId: filtroTramiteId(alcance) },
    include: {
      tramite: { select: { nombre: true } },
      eventos: {
        where: { tipo: "generado" },
        select: { timestamp: true },
        orderBy: { timestamp: "asc" },
        take: 1,
      },
    },
  })

  const acumulado = new Map<string, LineaCola>()

  for (const t of turnos) {
    const linea = acumulado.get(t.tramiteId) ?? {
      tramiteId: t.tramiteId,
      tramiteNombre: t.tramite.nombre,
      esperando: 0,
      esperaMasViejaSegundos: null,
    }
    linea.esperando += 1

    const generado = t.eventos[0]?.timestamp
    if (generado) {
      const espera = Math.round((ahora.getTime() - generado.getTime()) / 1000)
      if (linea.esperaMasViejaSegundos === null || espera > linea.esperaMasViejaSegundos) {
        linea.esperaMasViejaSegundos = espera
      }
    }

    acumulado.set(t.tramiteId, linea)
  }

  // Lo que mas urge, arriba: el supervisor mira esta lista para decidir
  // donde abrir otro box.
  return [...acumulado.values()].sort(
    (a, b) => (b.esperaMasViejaSegundos ?? 0) - (a.esperaMasViejaSegundos ?? 0)
  )
}

export async function estadoBoxes(alcance: Alcance): Promise<EstadoBox[]> {
  const filtro = filtroTramiteId(alcance)

  const boxes = await prisma.box.findMany({
    where: {
      activo: true,
      // Un box entra si atiende al menos un tramite del alcance: mostrar
      // boxes de areas ajenas no le sirve a quien solo puede actuar sobre
      // la suya.
      ...(filtro ? { tramites: { some: { tramiteId: filtro } } } : {}),
    },
    include: {
      ala: { select: { nombre: true } },
      sesiones: {
        where: { fin: null },
        include: { empleado: { select: { nombre: true } } },
        orderBy: { inicio: "desc" },
        take: 1,
      },
      turnos: {
        where: { estado: { in: ["llamado", "atendiendo"] } },
        select: { numero: true },
        take: 1,
      },
    },
    orderBy: [{ ala: { orden: "asc" } }, { numero: "asc" }],
  })

  return boxes.map((b) => {
    const sesion = b.sesiones[0]
    const turno = b.turnos[0]

    const estado: EstadoBox["estado"] = !sesion
      ? "cerrado"
      : turno
        ? "atendiendo"
        : "ocioso"

    return {
      boxId: b.id,
      boxNombre: b.nombre,
      alaNombre: b.ala.nombre,
      empleadoNombre: sesion?.empleado.nombre ?? null,
      estado,
      turnoNumero: turno?.numero ?? null,
    }
  })
}
```

- [ ] **Step 4: Correr el test**

```bash
npx dotenv -e .env.test.local -- vitest run tests/integration/consultas.test.ts
```

Esperado: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/estadisticas/consultas.ts tests/integration/consultas.test.ts
git commit -m "feat(sp5): capa de consultas con el alcance en la firma"
```

---

## Task 11: Layout del tablero, guard y vista Hoy

**Files:**
- Create: `app/tablero/layout.tsx`
- Create: `app/tablero/page.tsx`
- Create: `app/tablero/AutoRefresco.tsx`
- Create: `app/tablero/_componentes/Tarjeta.tsx`
- Create: `app/tablero/_componentes/SinAlcance.tsx`
- Create: `app/tablero/_componentes/TablaDatos.tsx`
- Create: `app/tablero/historico/page.tsx` *(esqueleto; la Task 12 lo reemplaza)*
- Test: `e2e/tablero.spec.ts`

**Interfaces:**
- Consumes: `actorActual`, `puedeVerTablero` de `@/lib/admin/acceso`; `alcanceDe`, `sinAlcance` de `@/lib/estadisticas/alcance`; `colaActual`, `estadoBoxes`, `turnosDelRango` de `@/lib/estadisticas/consultas`; `presetA` de `@/lib/estadisticas/rango`; `calcularDuraciones` de `@/lib/estadisticas/duraciones`; `porTramite`, `promedio`, `esPersona` de `@/lib/estadisticas/volumen`.
- Produces: `<Tarjeta etiqueta valor detalle?>`, `<TablaDatos columnas filas vacio>`, `<SinAlcance />`, `<AutoRefresco />`.

- [ ] **Step 1: Escribir el test E2E que falla**

Creá `e2e/tablero.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

// Igual que /admin, el tablero no existe para quien no tiene sesion: el
// guard del layout redirige antes de renderizar nada. Es lo unico que se
// puede probar sin credenciales institucionales reales.
test("el tablero rebota a quien no tiene sesión", async ({ page }) => {
  await page.goto("/tablero")
  await expect(page).toHaveURL(/\/operador\/login/)
})

test("el histórico también rebota", async ({ page }) => {
  await page.goto("/tablero/historico")
  await expect(page).toHaveURL(/\/operador\/login/)
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx playwright test e2e/tablero.spec.ts
```

Esperado: FAIL. `/tablero` da 404, no redirige.

- [ ] **Step 3: Crear los componentes de presentación**

`app/tablero/_componentes/Tarjeta.tsx`:

```tsx
export function Tarjeta({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string
  valor: string
  detalle?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-white p-4">
      <span className="text-sm text-gris-80">{etiqueta}</span>
      <span className="font-titulo text-3xl font-semibold">{valor}</span>
      {detalle && <span className="text-sm text-gris-80">{detalle}</span>}
    </div>
  )
}
```

`app/tablero/_componentes/TablaDatos.tsx`:

```tsx
export function TablaDatos({
  columnas,
  filas,
  vacio,
}: {
  columnas: string[]
  filas: React.ReactNode[][]
  vacio: string
}) {
  // El estado vacio dice que no hubo datos, no "cero": un cero en la celda
  // se leeria como una medicion que dio cero.
  if (filas.length === 0) {
    return <p className="rounded-xl bg-white p-4 text-sm text-gris-80">{vacio}</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gainsboro text-left">
            {columnas.map((c) => (
              <th key={c} className="px-4 py-3 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-b border-gris-20 last:border-0">
              {fila.map((celda, j) => (
                <td key={j} className="px-4 py-3">
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

`app/tablero/_componentes/SinAlcance.tsx`:

```tsx
export function SinAlcance() {
  return (
    <div className="rounded-xl bg-white p-8 text-center">
      <p className="font-titulo text-xl font-semibold">
        Todavía no tenés trámites asignados
      </p>
      <p className="mt-2 text-gris-80">
        El tablero muestra las métricas de los trámites que tengas a cargo. Pedile a un
        administrador que te los asigne desde el panel de administración.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Crear el refresco automático**

`app/tablero/AutoRefresco.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const SEGUNDOS = 45

/**
 * La vista Hoy se mira para decidir en el momento, asi que no puede quedar
 * congelada. router.refresh() vuelve a correr el Server Component y React
 * reconcilia: no hace falta emitir nada por el socket para un caso que
 * tolera 45 segundos de retraso.
 */
export function AutoRefresco() {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), SEGUNDOS * 1000)
    return () => clearInterval(id)
  }, [router])

  return null
}
```

- [ ] **Step 5: Crear el layout con el guard**

`app/tablero/layout.tsx`:

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { actorActual, puedeVerTablero } from "@/lib/admin/acceso"

export default async function LayoutTablero({
  children,
}: {
  children: React.ReactNode
}) {
  const actor = await actorActual()

  // El guard vive en el layout, no en cada pagina: asi cubre toda la rama
  // /tablero/* sin que haya que acordarse de repetirlo en una pagina nueva.
  if (!actor || !puedeVerTablero(actor.rol)) redirect("/operador/login")

  return (
    <div className="min-h-dvh bg-gris-20">
      <header className="flex items-center justify-between border-b border-gainsboro bg-white px-6 py-4">
        <nav className="flex items-center gap-6">
          <Link href="/tablero" className="font-titulo text-lg font-semibold">
            Tablero
          </Link>
          <Link href="/tablero" className="text-sm hover:underline">
            Hoy
          </Link>
          <Link href="/tablero/historico" className="text-sm hover:underline">
            Histórico
          </Link>
        </nav>

        <span className="text-sm">{actor.nombre}</span>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6: Crear la vista Hoy**

`app/tablero/page.tsx`:

```tsx
import { actorActual } from "@/lib/admin/acceso"
import { alcanceDe, sinAlcance } from "@/lib/estadisticas/alcance"
import { colaActual, estadoBoxes, turnosDelRango } from "@/lib/estadisticas/consultas"
import { calcularDuraciones } from "@/lib/estadisticas/duraciones"
import { presetA } from "@/lib/estadisticas/rango"
import { esPersona, promedio } from "@/lib/estadisticas/volumen"
import { AutoRefresco } from "./AutoRefresco"
import { Tarjeta } from "./_componentes/Tarjeta"
import { TablaDatos } from "./_componentes/TablaDatos"
import { SinAlcance } from "./_componentes/SinAlcance"

function minutos(segundos: number | null): string {
  if (segundos === null) return "—"
  return `${Math.floor(segundos / 60)} min`
}

const ETIQUETA_BOX = {
  atendiendo: "Atendiendo",
  ocioso: "Ocioso",
  cerrado: "Cerrado",
} as const

export default async function PaginaHoy() {
  // El layout ya garantizo que hay actor con permiso; aca solo hace falta
  // para resolver su alcance.
  const actor = await actorActual()
  if (!actor) return null

  const alcance = await alcanceDe(actor)
  if (sinAlcance(alcance)) return <SinAlcance />

  const ahora = new Date()
  const [cola, boxes, turnos] = await Promise.all([
    colaActual(alcance, ahora),
    estadoBoxes(alcance),
    turnosDelRango(alcance, presetA("hoy", ahora)),
  ])

  const conDuraciones = turnos.map((t) => ({
    turno: t,
    d: calcularDuraciones(t.eventos, t.umbralMinutos, ahora),
  }))

  const personas = turnos.filter(esPersona).length
  const ausentes = turnos.filter((t) => t.estado === "ausente").length
  const abandonados = turnos.filter((t) => t.estado === "abandonado").length

  // El promedio va sobre los ya llamados: incluir las esperas abiertas
  // mezclaria un tiempo final con uno que todavia esta corriendo.
  const esperaPromedio = promedio(
    conDuraciones.filter((c) => !c.d.esperaEnCurso).map((c) => c.d.esperaSegundos)
  )

  return (
    <div className="flex flex-col gap-8">
      <AutoRefresco />

      <section className="flex flex-col gap-3">
        <h1 className="font-titulo text-2xl font-semibold">Hoy</h1>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Tarjeta etiqueta="Personas" valor={String(personas)} />
          <Tarjeta etiqueta="Atenciones" valor={String(turnos.length)} />
          <Tarjeta etiqueta="Ausentes" valor={String(ausentes)} />
          <Tarjeta etiqueta="Abandonados" valor={String(abandonados)} />
          <Tarjeta etiqueta="Espera promedio" valor={minutos(esperaPromedio)} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Cola</h2>
        <TablaDatos
          columnas={["Trámite", "Esperando", "Espera más larga"]}
          vacio="No hay nadie esperando en este momento."
          filas={cola.map((l) => [
            l.tramiteNombre,
            String(l.esperando),
            minutos(l.esperaMasViejaSegundos),
          ])}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Boxes</h2>
        <TablaDatos
          columnas={["Box", "Ala", "Operador", "Estado", "Turno"]}
          vacio="No hay boxes que atiendan tus trámites."
          filas={boxes.map((b) => [
            b.boxNombre,
            b.alaNombre,
            b.empleadoNombre ?? "—",
            ETIQUETA_BOX[b.estado],
            b.turnoNumero ?? "—",
          ])}
        />
      </section>
    </div>
  )
}
```

- [ ] **Step 7: Crear el esqueleto del histórico**

El test E2E de esta task navega a `/tablero/historico` para comprobar el guard. La ruta tiene que existir para que el 404 no enmascare el resultado. Creá `app/tablero/historico/page.tsx` con el mínimo; la Task 12 lo reemplaza entero:

```tsx
export default function PaginaHistorico() {
  return <p>Histórico</p>
}
```

- [ ] **Step 8: Correr el test E2E**

```bash
npx playwright test e2e/tablero.spec.ts
```

Esperado: PASS (2 tests).

- [ ] **Step 9: Correr la suite completa**

```bash
npm test
```

Esperado: PASS.

- [ ] **Step 10: Commit**

```bash
git add app/tablero e2e/tablero.spec.ts
git commit -m "feat(sp5): layout del tablero con guard y vista Hoy"
```

---

## Task 12: Vista Histórico con gráficos

**Files:**
- Create/Modify: `app/tablero/historico/page.tsx`
- Create: `app/tablero/_componentes/SelectorRango.tsx`
- Create: `app/tablero/_componentes/BarraRanking.tsx`
- Create: `app/tablero/_componentes/GraficoLinea.tsx`
- Create: `app/tablero/_componentes/GraficoHoras.tsx`
- Modify: `package.json` *(dependencia `recharts`)*

**Interfaces:**
- Consumes: todo lo de las tasks 4–10; `puedeVerProductividad` de `@/lib/admin/acceso`.
- Produces: `<SelectorRango desde hasta corregido>`, `<BarraRanking filas>`, `<GraficoLinea datos>`, `<GraficoHoras datos>`.

- [ ] **Step 1: Instalar Recharts**

```bash
npm install recharts
```

Esperado: se agrega a `dependencies` en `package.json`.

- [ ] **Step 2: Crear los gráficos (Client Components)**

`app/tablero/_componentes/GraficoLinea.tsx`:

```tsx
"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export function GraficoLinea({
  datos,
}: {
  datos: { fecha: string; personas: number }[]
}) {
  if (datos.length === 0) {
    return <p className="rounded-xl bg-white p-4 text-sm text-gris-80">Sin datos en el rango.</p>
  }

  return (
    <div className="h-64 rounded-xl bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="fecha" fontSize={12} />
          <YAxis allowDecimals={false} fontSize={12} />
          <Tooltip />
          <Line type="monotone" dataKey="personas" stroke="#c8102e" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

`app/tablero/_componentes/GraficoHoras.tsx`:

```tsx
"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export function GraficoHoras({
  datos,
}: {
  datos: { hora: number; personas: number }[]
}) {
  // porHora siempre devuelve 24 buckets; se recortan los extremos vacios
  // para no dibujar la madrugada de una institucion que abre a las 8.
  const conDatos = datos.filter((d) => d.personas > 0)
  if (conDatos.length === 0) {
    return <p className="rounded-xl bg-white p-4 text-sm text-gris-80">Sin datos en el rango.</p>
  }

  const primera = Math.min(...conDatos.map((d) => d.hora))
  const ultima = Math.max(...conDatos.map((d) => d.hora))
  const visibles = datos
    .slice(primera, ultima + 1)
    .map((d) => ({ ...d, etiqueta: `${String(d.hora).padStart(2, "0")}:00` }))

  return (
    <div className="h-64 rounded-xl bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={visibles}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="etiqueta" fontSize={12} />
          <YAxis allowDecimals={false} fontSize={12} />
          <Tooltip />
          <Bar dataKey="personas" fill="#c8102e" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Crear el selector de rango y la barra de ranking**

`app/tablero/_componentes/SelectorRango.tsx`:

```tsx
import { aClaveFecha, presetA, type Preset } from "@/lib/estadisticas/rango"

const NOMBRES: Record<Preset, string> = {
  hoy: "Hoy",
  semana: "Semana",
  mes: "Mes",
}

export function SelectorRango({
  desde,
  hasta,
  corregido,
}: {
  desde: Date
  hasta: Date
  corregido: boolean
}) {
  const ahora = new Date()

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-white p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-2">
          {(Object.keys(NOMBRES) as Preset[]).map((p) => {
            const r = presetA(p, ahora)
            return (
              <a
                key={p}
                href={`?desde=${aClaveFecha(r.desde)}&hasta=${aClaveFecha(r.hasta)}`}
                className="rounded-lg border-2 border-gris-70 px-3 py-2 text-sm hover:bg-gris-20"
              >
                {NOMBRES[p]}
              </a>
            )
          })}
        </div>

        {/* GET, no Server Action: el rango tiene que quedar en la URL para
            que la vista sea compartible y el boton de exportar lo herede. */}
        <form method="get" className="flex items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Desde</span>
            <input
              type="date"
              name="desde"
              defaultValue={aClaveFecha(desde)}
              className="rounded-lg border-2 border-gris-70 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Hasta</span>
            <input
              type="date"
              name="hasta"
              defaultValue={aClaveFecha(hasta)}
              className="rounded-lg border-2 border-gris-70 px-3 py-2"
            />
          </label>
          <button className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white">
            Ver
          </button>
        </form>

        <a
          href={`/tablero/exportar?desde=${aClaveFecha(desde)}&hasta=${aClaveFecha(hasta)}`}
          className="rounded-lg border-2 border-gris-70 px-4 py-2 text-sm hover:bg-gris-20"
        >
          Exportar CSV
        </a>
      </div>

      {corregido && (
        <p role="alert" className="text-sm text-osp">
          El rango que pediste no era válido. Te muestro el último mes.
        </p>
      )}
    </div>
  )
}
```

`app/tablero/_componentes/BarraRanking.tsx`:

```tsx
export function BarraRanking({
  filas,
}: {
  filas: { etiqueta: string; valor: number }[]
}) {
  if (filas.length === 0) {
    return <p className="rounded-xl bg-white p-4 text-sm text-gris-80">Sin datos en el rango.</p>
  }

  const maximo = Math.max(...filas.map((f) => f.valor), 1)

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-4">
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex items-center gap-3">
          <span className="w-48 shrink-0 truncate text-sm">{f.etiqueta}</span>
          <div className="h-6 flex-1 rounded bg-gris-20">
            <div
              className="h-6 rounded bg-osp"
              style={{ width: `${(f.valor / maximo) * 100}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-semibold">{f.valor}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Escribir la vista Histórico**

`app/tablero/historico/page.tsx`:

```tsx
import { actorActual, puedeVerProductividad } from "@/lib/admin/acceso"
import { alcanceDe, sinAlcance } from "@/lib/estadisticas/alcance"
import { turnosDelRango } from "@/lib/estadisticas/consultas"
import { calcularDuraciones } from "@/lib/estadisticas/duraciones"
import { parsearRango } from "@/lib/estadisticas/rango"
import {
  porDia,
  porHora,
  porTramite,
  porTramiteYEstado,
  promedio,
  mediana,
} from "@/lib/estadisticas/volumen"
import { pares, cadenas } from "@/lib/estadisticas/derivaciones"
import { porEmpleado, type AtencionEmpleado } from "@/lib/estadisticas/productividad"
import { Tarjeta } from "../_componentes/Tarjeta"
import { TablaDatos } from "../_componentes/TablaDatos"
import { BarraRanking } from "../_componentes/BarraRanking"
import { GraficoLinea } from "../_componentes/GraficoLinea"
import { GraficoHoras } from "../_componentes/GraficoHoras"
import { SelectorRango } from "../_componentes/SelectorRango"
import { SinAlcance } from "../_componentes/SinAlcance"

function minutos(segundos: number | null): string {
  if (segundos === null) return "—"
  return `${Math.floor(segundos / 60)} min`
}

function desvio(segundos: number | null): string {
  if (segundos === null) return "—"
  const signo = segundos >= 0 ? "+" : "−"
  return `${signo}${Math.abs(Math.round(segundos / 60))} min`
}

export default async function PaginaHistorico({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const actor = await actorActual()
  if (!actor) return null

  const alcance = await alcanceDe(actor)
  if (sinAlcance(alcance)) return <SinAlcance />

  const { desde, hasta } = await searchParams
  const { rango, corregido } = parsearRango(desde, hasta)

  const turnos = await turnosDelRango(alcance, rango)

  const conDuraciones = turnos.map((t) => ({
    t,
    d: calcularDuraciones(t.eventos, t.umbralMinutos),
  }))

  const paraVolumen = conDuraciones.map(({ t, d }) => ({
    id: t.id,
    tramiteId: t.tramiteId,
    tramiteNombre: t.tramiteNombre,
    derivadoDeId: t.derivadoDeId,
    estado: t.estado,
    generadoEn: t.eventos.find((e) => e.tipo === "generado")?.timestamp ?? null,
    esperaSegundos: d.esperaSegundos,
  }))

  const lineas = porTramite(paraVolumen)
  const esperas = conDuraciones.filter((c) => !c.d.esperaEnCurso).map((c) => c.d.esperaSegundos)

  const paraDerivaciones = turnos.map((t) => ({
    id: t.id,
    numero: t.numero,
    tramiteId: t.tramiteId,
    tramiteNombre: t.tramiteNombre,
    derivadoDeId: t.derivadoDeId,
  }))

  const verProductividad = puedeVerProductividad(actor.rol)

  // La productividad no se consulta ni se calcula para quien no puede
  // verla: no alcanza con no renderizarla.
  const productividad = verProductividad
    ? porEmpleado(
        conDuraciones
          .filter((c): c is typeof c & { t: { empleadoId: string } } => c.t.empleadoId !== null)
          .map(
            ({ t, d }): AtencionEmpleado => ({
              empleadoId: t.empleadoId,
              empleadoNombre: t.empleadoNombre ?? "(empleado dado de baja)",
              tramiteId: t.tramiteId,
              atencionSegundos: d.atencionSegundos,
              clasificacion: d.clasificacion,
            })
          )
      )
    : []

  const personas = paraVolumen.filter((t) => t.derivadoDeId === null).length
  const ausentes = turnos.filter((t) => t.estado === "ausente").length
  const abandonados = turnos.filter((t) => t.estado === "abandonado").length

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-titulo text-2xl font-semibold">Histórico</h1>

      <SelectorRango desde={rango.desde} hasta={rango.hasta} corregido={corregido} />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Tarjeta etiqueta="Personas" valor={String(personas)} />
        <Tarjeta etiqueta="Atenciones" valor={String(turnos.length)} />
        <Tarjeta etiqueta="Ausentes" valor={String(ausentes)} />
        <Tarjeta etiqueta="Abandonados" valor={String(abandonados)} />
        <Tarjeta
          etiqueta="Espera"
          valor={minutos(promedio(esperas))}
          detalle={`Mediana ${minutos(mediana(esperas))}`}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Personas por día</h2>
        <GraficoLinea datos={porDia(paraVolumen)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Hora pico</h2>
        <GraficoHoras datos={porHora(paraVolumen)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Volumen por trámite</h2>
        <BarraRanking
          filas={lineas.map((l) => ({ etiqueta: l.tramiteNombre, valor: l.personas }))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Derivaciones</h2>
        <TablaDatos
          columnas={["Origen", "Destino", "Cuántas"]}
          vacio="No hubo derivaciones en el rango."
          filas={pares(paraDerivaciones).map((p) => [
            p.origenNombre,
            p.destinoNombre,
            String(p.cuantas),
          ])}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Cadenas de tres o más</h2>
        <TablaDatos
          columnas={["Turno", "Recorrido"]}
          vacio="No hubo cadenas largas en el rango."
          filas={cadenas(paraDerivaciones).map((c) => [
            c.numero,
            c.tramiteNombres.join(" → "),
          ])}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-titulo text-xl font-semibold">Ausentes y abandonos</h2>
        <TablaDatos
          columnas={["Trámite", "Ausentes", "Abandonados"]}
          vacio="No hubo ausentes ni abandonos en el rango."
          filas={(() => {
            const a = porTramiteYEstado(paraVolumen, ["ausente"])
            const b = porTramiteYEstado(paraVolumen, ["abandonado"])
            const nombres = new Map(
              [...a, ...b].map((l) => [l.tramiteId, l.tramiteNombre])
            )
            return [...nombres.entries()].map(([id, nombre]) => [
              nombre,
              String(a.find((l) => l.tramiteId === id)?.cuantos ?? 0),
              String(b.find((l) => l.tramiteId === id)?.cuantos ?? 0),
            ])
          })()}
        />
      </section>

      {verProductividad && (
        <section className="flex flex-col gap-3">
          <h2 className="font-titulo text-xl font-semibold">Productividad</h2>
          <TablaDatos
            columnas={[
              "Operador",
              "Atendidos",
              "Válidas",
              "Breves",
              "Anomalías",
              "Promedio",
              "Contra la mediana",
            ]}
            vacio="No hubo atenciones con operador registrado en el rango."
            filas={productividad.map((l) => [
              l.empleadoNombre,
              String(l.atendidos),
              String(l.validas),
              String(l.breves),
              String(l.anomalias),
              minutos(l.promedioSegundos),
              desvio(l.desvioContraMedianaSegundos),
            ])}
          />
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verificar que compila y que la suite sigue verde**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

```bash
npm test
```

Esperado: PASS.

- [ ] **Step 6: Verificar el guard E2E**

```bash
npx playwright test e2e/tablero.spec.ts
```

Esperado: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add app/tablero package.json package-lock.json
git commit -m "feat(sp5): vista historico con graficos y rango en la URL"
```

---

## Task 13: Exportación CSV

**Files:**
- Create: `app/tablero/exportar/route.ts`
- Modify: `e2e/tablero.spec.ts`

**Interfaces:**
- Consumes: `aCsv`, `FilaExportable` de `@/lib/estadisticas/csv`; `actorActual`, `puedeVerTablero`, `puedeVerProductividad`; `alcanceDe`, `sinAlcance`; `turnosDelRango`; `parsearRango`, `aClaveFecha`; `calcularDuraciones`.
- Produces: `GET /tablero/exportar?desde=&hasta=`.

- [ ] **Step 1: Agregar el test E2E que falla**

Agregá a `e2e/tablero.spec.ts`:

```ts
// La exportacion es la puerta de atras clasica: si la pantalla filtra y el
// endpoint no, el filtro de la pantalla no vale nada. Sin sesion tampoco
// tiene que devolver el archivo.
test("la exportación rebota a quien no tiene sesión", async ({ page }) => {
  const respuesta = await page.goto("/tablero/exportar")
  expect(respuesta?.status()).toBe(401)
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx playwright test e2e/tablero.spec.ts
```

Esperado: FAIL. La ruta no existe (404, no 401).

- [ ] **Step 3: Implementar la ruta**

Creá `app/tablero/exportar/route.ts`:

```ts
import { actorActual, puedeVerTablero, puedeVerProductividad } from "@/lib/admin/acceso"
import { alcanceDe, sinAlcance } from "@/lib/estadisticas/alcance"
import { turnosDelRango } from "@/lib/estadisticas/consultas"
import { calcularDuraciones } from "@/lib/estadisticas/duraciones"
import { parsearRango, aClaveFecha } from "@/lib/estadisticas/rango"
import { aCsv, type FilaExportable } from "@/lib/estadisticas/csv"

export async function GET(pedido: Request): Promise<Response> {
  const actor = await actorActual()
  // 401 y no redirect: esto lo pide un enlace de descarga, no un navegante.
  if (!actor || !puedeVerTablero(actor.rol)) {
    return new Response("No autorizado", { status: 401 })
  }

  const alcance = await alcanceDe(actor)
  const verProductividad = puedeVerProductividad(actor.rol)

  const url = new URL(pedido.url)
  const { rango } = parsearRango(
    url.searchParams.get("desde") ?? undefined,
    url.searchParams.get("hasta") ?? undefined
  )

  // El alcance vacio devuelve un CSV con solo el encabezado, no un error:
  // el archivo pedido existe, lo que no hay son filas que mostrarle.
  const turnos = sinAlcance(alcance) ? [] : await turnosDelRango(alcance, rango)

  const filas: FilaExportable[] = turnos.map((t) => {
    const d = calcularDuraciones(t.eventos, t.umbralMinutos)
    return {
      numero: t.numero,
      fecha: aClaveFecha(t.fecha),
      tramiteNombre: t.tramiteNombre,
      estado: t.estado,
      derivado: t.derivadoDeId !== null,
      esperaSegundos: d.esperaSegundos,
      boxNombre: t.boxNombre,
      empleadoNombre: t.empleadoNombre,
      atencionSegundos: d.atencionSegundos,
      clasificacion: d.clasificacion,
    }
  })

  const nombre = `turnero-${aClaveFecha(rango.desde)}-a-${aClaveFecha(rango.hasta)}.csv`

  return new Response(aCsv(filas, verProductividad), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  })
}
```

- [ ] **Step 4: Correr el test**

```bash
npx playwright test e2e/tablero.spec.ts
```

Esperado: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/tablero/exportar e2e/tablero.spec.ts
git commit -m "feat(sp5): exportacion CSV con el mismo guard y alcance"
```

---

## Task 14: Panel de asignación de alcance

**Files:**
- Create: `app/admin/alcance/page.tsx`
- Create: `app/admin/alcance/FormularioAlcance.tsx`
- Modify: `lib/admin/mutaciones.ts`
- Modify: `lib/admin/acciones.ts`
- Modify: `app/admin/layout.tsx`
- Test: `tests/integration/alcanceMutacion.test.ts`

**Interfaces:**
- Consumes: `Actor`, `puedeEditarCatalogo`; `Resultado` de `@/lib/admin/mutaciones`; `EstadoFormulario`, `ESTADO_INICIAL`; `CampoCasillas` de `@/app/admin/_componentes/Campos`.
- Produces: `guardarAlcance(actor: Actor, d: { empleadoId: string; tramiteIds: string[] }): Promise<Resultado>`; `accionGuardarAlcance(prev, fd): Promise<EstadoFormulario>`.

- [ ] **Step 1: Escribir el test que falla**

Creá `tests/integration/alcanceMutacion.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import type { Actor } from "@/lib/admin/acceso"
import { guardarAlcance } from "@/lib/admin/mutaciones"

const DNI_PRUEBA = "99999903"

const ADMIN: Actor = { empleadoId: "x", nombre: "Admin", rol: "admin" }
const SUPERVISOR: Actor = { empleadoId: "y", nombre: "Super", rol: "supervisor" }
const DIRECTOR: Actor = { empleadoId: "z", nombre: "Dire", rol: "director" }

async function limpiar() {
  await prisma.alcanceMetrica.deleteMany({
    where: { empleado: { dniInstitucional: DNI_PRUEBA } },
  })
  await prisma.empleado.deleteMany({ where: { dniInstitucional: DNI_PRUEBA } })
}

async function crearSupervisor() {
  return prisma.empleado.create({
    data: { dniInstitucional: DNI_PRUEBA, nombre: "Super Prueba", rol: "supervisor" },
  })
}

describe("guardarAlcance", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("el admin asigna trámites", async () => {
    const emp = await crearSupervisor()
    const tramites = await prisma.tramite.findMany({ take: 2 })

    const r = await guardarAlcance(ADMIN, {
      empleadoId: emp.id,
      tramiteIds: tramites.map((t) => t.id),
    })
    expect(r.ok).toBe(true)

    const filas = await prisma.alcanceMetrica.findMany({ where: { empleadoId: emp.id } })
    expect(filas).toHaveLength(2)
  })

  // Reemplaza en vez de acumular: si solo agregara, desmarcar una casilla
  // no sacaria nada y el alcance solo podria crecer.
  it("reemplaza el alcance anterior", async () => {
    const emp = await crearSupervisor()
    const tramites = await prisma.tramite.findMany({ take: 2 })

    await guardarAlcance(ADMIN, {
      empleadoId: emp.id,
      tramiteIds: tramites.map((t) => t.id),
    })
    await guardarAlcance(ADMIN, { empleadoId: emp.id, tramiteIds: [tramites[0].id] })

    const filas = await prisma.alcanceMetrica.findMany({ where: { empleadoId: emp.id } })
    expect(filas).toHaveLength(1)
    expect(filas[0].tramiteId).toBe(tramites[0].id)
  })

  it("una lista vacía deja al supervisor sin alcance", async () => {
    const emp = await crearSupervisor()
    const tramite = await prisma.tramite.findFirstOrThrow()
    await guardarAlcance(ADMIN, { empleadoId: emp.id, tramiteIds: [tramite.id] })

    const r = await guardarAlcance(ADMIN, { empleadoId: emp.id, tramiteIds: [] })
    expect(r.ok).toBe(true)
    expect(await prisma.alcanceMetrica.findMany({ where: { empleadoId: emp.id } })).toEqual([])
  })

  // Quien no edita el catalogo tampoco reparte alcance: es la misma
  // autoridad, y un supervisor podria ampliarse el suyo.
  it("ni supervisor ni director pueden asignar", async () => {
    const emp = await crearSupervisor()
    const tramite = await prisma.tramite.findFirstOrThrow()

    for (const actor of [SUPERVISOR, DIRECTOR]) {
      const r = await guardarAlcance(actor, {
        empleadoId: emp.id,
        tramiteIds: [tramite.id],
      })
      expect(r.ok).toBe(false)
    }
    expect(await prisma.alcanceMetrica.findMany({ where: { empleadoId: emp.id } })).toEqual([])
  })

  it("rechaza un empleado inexistente", async () => {
    const tramite = await prisma.tramite.findFirstOrThrow()
    const r = await guardarAlcance(ADMIN, {
      empleadoId: "no-existe",
      tramiteIds: [tramite.id],
    })
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
npx dotenv -e .env.test.local -- vitest run tests/integration/alcanceMutacion.test.ts
```

Esperado: FAIL. `guardarAlcance` no existe.

- [ ] **Step 3: Implementar la mutación**

Leé primero `lib/admin/mutaciones.ts` para ver cómo están construidos `Resultado`, `fallo` y el guard de rol, y seguí ese patrón. Agregá al final:

```ts
/**
 * Reemplaza el alcance completo en vez de agregar: si solo agregara,
 * desmarcar una casilla no sacaria nada y el alcance de un supervisor solo
 * podria crecer.
 */
export async function guardarAlcance(
  actor: Actor,
  d: { empleadoId: string; tramiteIds: string[] }
): Promise<Resultado> {
  // Repartir alcance es la misma autoridad que editar el catalogo: si un
  // supervisor pudiera, se ampliaria el suyo.
  if (!puedeEditarCatalogo(actor.rol)) {
    return { ok: false, errores: [{ campo: "rol", mensaje: "No tenés permiso para esto" }] }
  }

  const empleado = await prisma.empleado.findUnique({ where: { id: d.empleadoId } })
  if (!empleado) {
    return { ok: false, errores: [{ campo: "empleadoId", mensaje: "Ese empleado no existe" }] }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.alcanceMetrica.deleteMany({ where: { empleadoId: d.empleadoId } })
      if (d.tramiteIds.length > 0) {
        await tx.alcanceMetrica.createMany({
          data: d.tramiteIds.map((tramiteId) => ({ empleadoId: d.empleadoId, tramiteId })),
        })
      }
    })
  } catch {
    return {
      ok: false,
      errores: [{ campo: "tramiteId", mensaje: "No se pudo guardar el alcance" }],
    }
  }

  return { ok: true }
}
```

> Si `Resultado`, `fallo` o el guard tienen otra forma exacta en el archivo, adaptá **este** código a la forma existente, no al revés.

- [ ] **Step 4: Implementar la Server Action**

En `lib/admin/acciones.ts`, agregá:

```ts
export async function accionGuardarAlcance(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const r = await guardarAlcance(actor, {
    empleadoId: texto(fd, "empleadoId"),
    tramiteIds: varios(fd, "tramiteId"),
  })

  if (r.ok) revalidatePath("/admin/alcance")
  return aEstado(r)
}
```

Sumá `guardarAlcance` al import desde `./mutaciones`.

- [ ] **Step 5: Correr el test**

```bash
npx dotenv -e .env.test.local -- vitest run tests/integration/alcanceMutacion.test.ts
```

Esperado: PASS (5 tests).

- [ ] **Step 6: Crear el formulario**

`app/admin/alcance/FormularioAlcance.tsx`:

```tsx
"use client"

import { useActionState } from "react"
import { accionGuardarAlcance } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import { CampoCasillas } from "../_componentes/Campos"

export function FormularioAlcance({
  empleadoId,
  empleadoNombre,
  tramites,
  asignados,
  soloLectura,
}: {
  empleadoId: string
  empleadoNombre: string
  tramites: { id: string; nombre: string }[]
  asignados: string[]
  soloLectura: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarAlcance, ESTADO_INICIAL)

  return (
    <form action={accion} className="flex flex-col gap-4 rounded-xl bg-white p-4">
      <input type="hidden" name="empleadoId" value={empleadoId} />

      <div className="flex items-center gap-3">
        <h2 className="font-semibold">{empleadoNombre}</h2>
        {asignados.length === 0 && (
          <span className="rounded-lg bg-osp px-2 py-1 text-xs font-semibold text-white">
            Sin trámites asignados
          </span>
        )}
      </div>

      <CampoCasillas
        etiqueta="Trámites cuyas métricas puede ver"
        campo="tramiteId"
        opciones={tramites}
        marcados={asignados}
        soloLectura={soloLectura}
      />

      <div className="flex items-center gap-4">
        <button
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
          disabled={soloLectura || pendiente}
        >
          {pendiente ? "Guardando…" : "Guardar alcance"}
        </button>
        {estado.guardado && <span className="text-sm text-gris-80">Guardado</span>}
      </div>

      {estado.errores.length > 0 && (
        <p role="alert" className="text-sm text-osp">
          {estado.errores[0].mensaje}
        </p>
      )}
    </form>
  )
}
```

- [ ] **Step 7: Crear la página y el enlace de navegación**

`app/admin/alcance/page.tsx`:

```tsx
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { prisma } from "@/lib/db"
import { FormularioAlcance } from "./FormularioAlcance"

export default async function PaginaAlcance() {
  const actor = await actorActual()
  if (!actor) return null

  const soloLectura = !puedeEditarCatalogo(actor.rol)

  const [supervisores, tramites] = await Promise.all([
    prisma.empleado.findMany({
      where: { rol: "supervisor", activo: true },
      include: { alcances: { select: { tramiteId: true } } },
      orderBy: { nombre: "asc" },
    }),
    prisma.tramite.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { orden: "asc" },
    }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-titulo text-2xl font-semibold">Alcance de métricas</h1>
        <p className="mt-1 text-sm text-gris-80">
          Cada supervisor ve en el tablero sólo los trámites que tenga asignados acá. Sin
          ninguno, su tablero aparece vacío.
        </p>
      </div>

      {supervisores.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-sm text-gris-80">
          No hay supervisores activos.
        </p>
      ) : (
        supervisores.map((s) => (
          <FormularioAlcance
            key={s.id}
            empleadoId={s.id}
            empleadoNombre={s.nombre}
            tramites={tramites}
            asignados={s.alcances.map((a) => a.tramiteId)}
            soloLectura={soloLectura}
          />
        ))
      )}
    </div>
  )
}
```

En `app/admin/layout.tsx`, agregá el enlace después del de "Sedes, alas, pisos y categorías":

```tsx
          <Link href="/admin/alcance" className="text-sm hover:underline">
            Alcance de métricas
          </Link>
```

- [ ] **Step 8: Verificar que compila y que todo pasa**

```bash
npx tsc --noEmit
```

Esperado: sin errores.

```bash
npm test
```

Esperado: PASS.

```bash
npx playwright test
```

Esperado: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/admin lib/admin tests/integration/alcanceMutacion.test.ts
git commit -m "feat(sp5): panel de asignacion de alcance de metricas"
```

---

## Verificación final

- [ ] **Correr la suite completa**

```bash
npm test
```

- [ ] **Correr los E2E**

```bash
npx playwright test
```

- [ ] **Verificar tipos**

```bash
npx tsc --noEmit
```

- [ ] **Verificar el build de producción**

```bash
npm run build
```

Esperado: build exitoso. Recharts entra en el bundle sólo de las rutas que lo importan (`/tablero/historico`), porque los gráficos son Client Components aislados.
