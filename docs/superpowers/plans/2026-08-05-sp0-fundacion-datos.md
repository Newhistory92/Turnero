# SP0 — Fundación de datos: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar Supabase por SQL Server 2022 vía Prisma, mover el catálogo de servicios de `lib/types.ts` a la base, y extraer el motor de cola a módulos puros y testeados.

**Architecture:** Se conserva el custom server de Next + Socket.io. Se reemplaza el almacén (Supabase → Prisma/SQL Server), el broadcast global de estado por rooms y eventos delta, y el catálogo hardcodeado por tablas cacheadas en memoria. La lógica de cola sale de los componentes React a `lib/queue/`, tres módulos sin dependencias de I/O.

**Tech Stack:** Next.js 15.2.4, TypeScript, Prisma 6 (provider `sqlserver`), SQL Server 2022, Socket.io 4, Vitest, Docker.

**Spec:** `docs/superpowers/specs/2026-08-05-turnero-kiosco-design.md`

---

## Antes de empezar

Este plan **no toca la UI**. Al terminar, el kiosco viejo puede quedar roto o desconectado: es esperado, lo reemplaza SP1. Lo que tiene que quedar verde son los tests.

**Pendientes externos que bloquean tareas puntuales** (§12 del spec):

- `DATABASE_URL` de la instancia real → Tareas 2, 3.
- Nombre y columnas del objeto de afiliados → Tarea 9. Camino alternativo: implementación stub, ya prevista.

### Tres bases, no dos

Los tests borran datos en cada corrida (`deleteMany()` antes de cada test, y el de concurrencia genera
50 turnos de golpe). Por eso hacen falta tres bases en la misma instancia de SQL Server 2022:

| Base | Para qué | Quién la borra |
|---|---|---|
| `<Institucional>` | Afiliados y empleados | Nadie. Sólo lectura |
| `Turnero` | Los turnos reales | Nadie |
| `Turnero_Test` | Correr los tests | **Los tests, en cada corrida** |

La Tarea 1 incluye una **guarda que aborta la suite** si la cadena de conexión no apunta a una base
cuyo nombre termine en `_Test`. Es barata y evita el accidente de vaciar producción por un typo en
un `.env`.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `prisma/schema.prisma` | Schema completo. Reemplaza el actual |
| `prisma/seed.ts` | Catálogo real del pliego: alas, pisos, boxes, categorías, trámites, asignaciones |
| `lib/db.ts` | Singleton de `PrismaClient`. Reemplaza `app/config/primsma.ts` |
| `lib/queue/tipos.ts` | Tipos del dominio, sin dependencias |
| `lib/queue/estado.ts` | Máquina de estados. Puro |
| `lib/queue/disponibilidad.ts` | Reglas de horario trámite × box. Puro |
| `lib/queue/seleccion.ts` | FIFO de la cola de un box. Puro |
| `lib/catalogo/index.ts` | Carga y cachea el catálogo; `invalidar()` |
| `lib/afiliados/repositorio.ts` | Interfaz + implementación SQL + stub |
| `server/rooms.ts` | Nombres de rooms y a quién le toca cada evento |
| `server/handlers/generarTurno.ts` | El comando crítico: transacción atómica |
| `server/handlers/llamarTurno.ts` | Transición condicionada |
| `server/index.ts` | Arranque. Reemplaza el cuerpo de `server.ts` |
| `vitest.config.ts` | Configuración de tests |
| `tests/setup.ts` | Guarda que impide correr los tests contra una base que no sea de test |

---

## Task 1: Herramientas de test

Sin esto no se puede hacer TDD en ninguna tarea siguiente. Va primero.

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Instalar Vitest**

```bash
npm install -D vitest @vitest/coverage-v8 tsx
```

- [ ] **Step 2: Crear la configuración**

Crear `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    setupFiles: ["./tests/setup.ts"],
    // Los tests de integracion comparten la misma base: si corren en paralelo
    // se pisan los deleteMany() entre si.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
```

`testTimeout` alto porque los tests de integración van contra SQL Server por red.

- [ ] **Step 3: Escribir la guarda de seguridad**

Los tests borran datos. Esta guarda es lo único que separa un typo en el `.env` de vaciar los turnos
reales de la institución.

Crear `tests/setup.ts`:

```typescript
import { config } from "dotenv"

// Los tests leen .env.test.local, nunca .env.local.
config({ path: ".env.test.local", override: true })

const url = process.env.DATABASE_URL ?? ""
const base = /database=([^;]+)/i.exec(url)?.[1] ?? ""

if (!base.endsWith("_Test")) {
  throw new Error(
    `Los tests borran datos y solo pueden correr contra una base terminada en "_Test".\n` +
      `DATABASE_URL apunta a: "${base || "(sin database= en la cadena)"}"\n` +
      `Revisá .env.test.local antes de volver a correr.`
  )
}
```

Instalar `dotenv`:

```bash
npm install -D dotenv
```

- [ ] **Step 4: Verificar que la guarda muerde**

Crear temporalmente un `.env.test.local` apuntando a `database=Turnero` (sin `_Test`) y correr
`npm test`.

Expected: la suite **aborta** con el mensaje de la guarda. Si los tests corren igual, la guarda no
está funcionando y no se puede seguir.

Corregir el archivo a `database=Turnero_Test` antes del paso siguiente.

- [ ] **Step 5: Escribir el test de humo**

Crear `tests/smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest"

describe("entorno de test", () => {
  it("corre", () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Agregar los scripts**

En `package.json`, dentro de `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:unit": "vitest run tests/unit",
"test:integration": "vitest run tests/integration"
```

- [ ] **Step 7: Verificar**

Run: `npm test`
Expected: `1 passed`

- [ ] **Step 8: Commit**

`.env.test.local` queda fuera del commit: `.gitignore` ya excluye todo `.env*`.

```bash
git add vitest.config.ts tests/setup.ts tests/smoke.test.ts package.json package-lock.json
git commit -m "chore: configurar Vitest con guarda de base de test"
```

---

## Task 2: Schema de Prisma

**Files:**
- Modify: `prisma/schema.prisma` (reemplazo completo)
- Create: `lib/db.ts`
- Delete: `app/config/primsma.ts`

- [ ] **Step 1: Crear las dos bases en el servidor**

En el SQL Server 2022 de la institución, con un login que tenga permiso para crear bases:

```sql
CREATE DATABASE [Turnero];
CREATE DATABASE [Turnero_Test];
```

`Turnero_Test` existe porque **los tests borran datos en cada corrida**. No es opcional: sin base
separada, `npm test` vacía los turnos reales.

El login de la aplicación necesita:
- `db_owner` sobre `Turnero` y `Turnero_Test` (Prisma corre migraciones)
- `SELECT` sobre la base institucional de afiliados (pendiente 3 del spec)

- [ ] **Step 2: Configurar las dos cadenas de conexión**

En `.env.local` — desarrollo y producción:

```
DATABASE_URL="sqlserver://TU-SERVIDOR:1433;database=Turnero;user=turnero_app;password=<clave>;encrypt=true;trustServerCertificate=true"
```

En `.env.test.local` — sólo tests:

```
DATABASE_URL="sqlserver://TU-SERVIDOR:1433;database=Turnero_Test;user=turnero_app;password=<clave>;encrypt=true;trustServerCertificate=true"
```

Los dos archivos están cubiertos por `.env*` en `.gitignore`: no se commitean nunca.

Si el servidor usa una instancia con nombre en vez de puerto, la forma es
`sqlserver://TU-SERVIDOR\\INSTANCIA;database=...`.

`trustServerCertificate=true` sirve mientras el servidor use un certificado autofirmado. Si la
institución tiene un certificado válido, sacalo: es lo correcto.

- [ ] **Step 3: Escribir el schema**

Reemplazar el contenido completo de `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

model Sede {
  id     String  @id @default(uuid())
  nombre String
  activa Boolean @default(true)
  alas   Ala[]
  pisos  Piso[]
}

model Ala {
  id              String    @id @default(uuid())
  sedeId          String
  sede            Sede      @relation(fields: [sedeId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  nombre          String
  orden           Int
  boxes           Box[]
  tramitesDestino Tramite[] @relation("TramiteDestinoAla")

  @@unique([sedeId, nombre])
}

model Piso {
  id              String    @id @default(uuid())
  sedeId          String
  sede            Sede      @relation(fields: [sedeId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  nombre          String
  nivel           Int
  boxes           Box[]
  tramitesDestino Tramite[] @relation("TramiteDestinoPiso")

  @@unique([sedeId, nivel])
}

model Box {
  id           String           @id @default(uuid())
  alaId        String
  ala          Ala              @relation(fields: [alaId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  pisoId       String
  piso         Piso             @relation(fields: [pisoId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  numero       Int
  nombre       String
  activo       Boolean          @default(true)
  horaApertura String           @db.VarChar(5)
  horaCierre   String           @db.VarChar(5)
  diasSemana   String           @db.VarChar(7)
  tramites     BoxTramite[]
  turnos       Turno[]
  eventos      TurnoEvento[]
  empleados    EmpleadoBox[]
  sesiones     SesionOperador[]

  @@unique([alaId, numero])
}

model Categoria {
  id       String    @id @default(uuid())
  nombre   String
  icono    String
  orden    Int
  activa   Boolean   @default(true)
  tramites Tramite[]
}

model Tramite {
  id                     String       @id @default(uuid())
  categoriaId            String
  categoria              Categoria    @relation(fields: [categoriaId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  nombre                 String
  subtitulo              String
  icono                  String
  prefijo                String       @db.VarChar(3)
  destinoAlaId           String
  destinoAla             Ala          @relation("TramiteDestinoAla", fields: [destinoAlaId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  destinoPisoId          String
  destinoPiso            Piso         @relation("TramiteDestinoPiso", fields: [destinoPisoId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  horaApertura           String       @db.VarChar(5)
  horaCierre             String       @db.VarChar(5)
  diasSemana             String       @db.VarChar(7)
  duracionMinimaEsperada Int
  orden                  Int
  activo                 Boolean      @default(true)
  boxes                  BoxTramite[]
  turnos                 Turno[]
  contadores             Contador[]
}

model BoxTramite {
  boxId     String
  tramiteId String
  box       Box     @relation(fields: [boxId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  tramite   Tramite @relation(fields: [tramiteId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@id([boxId, tramiteId])
}

model Turno {
  id             String        @id @default(uuid())
  numero         String        @db.VarChar(10)
  fecha          DateTime      @db.Date
  tramiteId      String
  tramite        Tramite       @relation(fields: [tramiteId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  dni            String?       @db.VarChar(15)
  nombreAfiliado String?
  estado         String        @db.VarChar(15)
  boxId          String?
  box            Box?          @relation(fields: [boxId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  requestId      String        @unique
  createdAt      DateTime      @default(now())
  eventos        TurnoEvento[]

  @@index([fecha, estado])
  @@index([tramiteId, estado])
}

model TurnoEvento {
  id         String    @id @default(uuid())
  turnoId    String
  turno      Turno     @relation(fields: [turnoId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  tipo       String    @db.VarChar(20)
  boxId      String?
  box        Box?      @relation(fields: [boxId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  empleadoId String?
  empleado   Empleado? @relation(fields: [empleadoId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  timestamp  DateTime  @default(now())
  detalle    String?

  @@index([turnoId])
  @@index([timestamp])
}

model Contador {
  id        String   @id @default(uuid())
  tramiteId String
  tramite   Tramite  @relation(fields: [tramiteId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  fecha     DateTime @db.Date
  valor     Int      @default(0)

  @@unique([tramiteId, fecha])
}

model Empleado {
  id               String           @id @default(uuid())
  dniInstitucional String           @unique @db.VarChar(15)
  nombre           String
  rol              String           @db.VarChar(15)
  activo           Boolean          @default(true)
  boxes            EmpleadoBox[]
  sesiones         SesionOperador[]
  eventos          TurnoEvento[]
}

model EmpleadoBox {
  empleadoId String
  boxId      String
  empleado   Empleado @relation(fields: [empleadoId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  box        Box      @relation(fields: [boxId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@id([empleadoId, boxId])
}

model SesionOperador {
  id           String    @id @default(uuid())
  empleadoId   String
  empleado     Empleado  @relation(fields: [empleadoId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  boxId        String
  box          Box       @relation(fields: [boxId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  inicio       DateTime  @default(now())
  fin          DateTime?
  ultimoLatido DateTime  @default(now())

  @@index([boxId, fin])
}

model Kiosco {
  id                   String    @id
  nombre               String
  alaId                String?
  version              String?
  ultimoLatido         DateTime?
  ultimoErrorImpresion String?
}
```

**Por qué tanto `onDelete: NoAction, onUpdate: NoAction`:** SQL Server rechaza claves foráneas que generen múltiples caminos de cascada. `Sede → Ala → Box` y `Sede → Piso → Box` son dos caminos al mismo `Box`; con los defaults de Prisma la migración falla con *"may cause cycles or multiple cascade paths"*. Explicitarlo evita horas de depuración.

- [ ] **Step 4: Generar la migración**

```bash
npx prisma migrate dev --name inicial
```

Expected: crea `prisma/migrations/<timestamp>_inicial/` y termina con `Your database is now in sync with your schema.`

Si aparece *"Introduced foreign key constraint ... may cause cycles"*, falta un `onDelete: NoAction` — revisar el Step 3.

- [ ] **Step 4b: Aplicar la migración también a la base de test**

`migrate dev` sólo tocó `Turnero`. La base de test necesita el mismo schema, con `migrate deploy`
(que aplica sin generar migraciones nuevas):

```powershell
$env:DATABASE_URL="sqlserver://TU-SERVIDOR:1433;database=Turnero_Test;user=turnero_app;password=<clave>;encrypt=true;trustServerCertificate=true"
npx prisma migrate deploy
Remove-Item Env:DATABASE_URL
```

Expected: `All migrations have been successfully applied.`

**Este paso se repite cada vez que se agregue una migración.** Conviene dejarlo como script en
`package.json`:

```json
"db:test:migrate": "dotenv -e .env.test.local -- prisma migrate deploy"
```

que requiere `npm install -D dotenv-cli`.

- [ ] **Step 5: Crear el singleton de Prisma**

Crear `lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

- [ ] **Step 6: Borrar el cliente viejo**

```bash
git rm app/config/primsma.ts
```

- [ ] **Step 7: Verificar que el cliente compila**

Crear `tests/integration/db.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/db"

describe("conexión a la base", () => {
  it("responde", async () => {
    const r = await prisma.$queryRaw<{ uno: number }[]>`SELECT 1 AS uno`
    expect(r[0].uno).toBe(1)
  })
})
```

Run: `npm run test:integration`
Expected: `1 passed`

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/db.ts tests/integration/db.test.ts package.json
git rm --cached app/config/primsma.ts
git commit -m "feat: schema de SQL Server y cliente Prisma"
```

---

## Task 3: Seed del catálogo real

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Escribir el seed**

Crear `prisma/seed.ts`. Esta es la estructura del pliego, tal cual:

```typescript
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const LUNES_A_VIERNES = "12345"
const APERTURA = "07:00"
const CIERRE = "13:00"

async function main() {
  const sede = await prisma.sede.create({
    data: { nombre: "Sede Central" },
  })

  const norte = await prisma.ala.create({
    data: { sedeId: sede.id, nombre: "Norte", orden: 1 },
  })
  const sur = await prisma.ala.create({
    data: { sedeId: sede.id, nombre: "Sur", orden: 2 },
  })

  const baja = await prisma.piso.create({
    data: { sedeId: sede.id, nombre: "Planta Baja", nivel: 0 },
  })
  const alta = await prisma.piso.create({
    data: { sedeId: sede.id, nombre: "Planta Alta", nivel: 1 },
  })

  const horarioBox = {
    activo: true,
    horaApertura: APERTURA,
    horaCierre: CIERRE,
    diasSemana: LUNES_A_VIERNES,
  }

  // Boxes del Ala Sur: 1-4 Auditoria Medica, 5-7 Afiliaciones
  const boxesSur = await Promise.all(
    [1, 2, 3, 4, 5, 6, 7].map((numero) =>
      prisma.box.create({
        data: {
          alaId: sur.id,
          pisoId: baja.id,
          numero,
          nombre: `Box ${numero}`,
          ...horarioBox,
        },
      })
    )
  )

  // Boxes del Ala Norte: 1-3 Auditoria Medica General
  const boxesNorte = await Promise.all(
    [1, 2, 3].map((numero) =>
      prisma.box.create({
        data: {
          alaId: norte.id,
          pisoId: baja.id,
          numero,
          nombre: `Box ${numero}`,
          ...horarioBox,
        },
      })
    )
  )

  // Mesa unica de Servicio Social, Planta Alta Ala Norte
  const mesaSocial = await prisma.box.create({
    data: {
      alaId: norte.id,
      pisoId: alta.id,
      numero: 10,
      nombre: "Mesa de Servicio Social",
      ...horarioBox,
    },
  })

  const catAfiliaciones = await prisma.categoria.create({
    data: { nombre: "Afiliaciones", icono: "IdCard", orden: 1 },
  })
  const catAuditoria = await prisma.categoria.create({
    data: { nombre: "Auditoría Médica", icono: "Stethoscope", orden: 2 },
  })
  const catPracticas = await prisma.categoria.create({
    data: { nombre: "Prácticas y Estudios", icono: "Activity", orden: 3 },
  })
  const catSocial = await prisma.categoria.create({
    data: { nombre: "Servicio Social", icono: "HeartHandshake", orden: 4 },
  })

  const horarioTramite = {
    horaApertura: APERTURA,
    horaCierre: CIERRE,
    diasSemana: LUNES_A_VIERNES,
    activo: true,
  }

  const box = (lista: typeof boxesSur, numero: number) =>
    lista.find((b) => b.numero === numero)!

  const tramites: Array<{
    categoriaId: string
    nombre: string
    subtitulo: string
    icono: string
    prefijo: string
    destinoAlaId: string
    destinoPisoId: string
    duracionMinimaEsperada: number
    orden: number
    boxIds: string[]
  }> = [
    // Afiliaciones - Ala Sur
    {
      categoriaId: catAfiliaciones.id,
      nombre: "Aportes",
      subtitulo: "Verificación y consulta de aportes",
      icono: "Coins",
      prefijo: "AP",
      destinoAlaId: sur.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 4,
      orden: 1,
      boxIds: [box(boxesSur, 5).id],
    },
    {
      categoriaId: catAfiliaciones.id,
      nombre: "Carnet",
      subtitulo: "Emisión y renovación",
      icono: "CreditCard",
      prefijo: "C",
      destinoAlaId: sur.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 3,
      orden: 2,
      boxIds: [box(boxesSur, 6).id],
    },
    {
      categoriaId: catAfiliaciones.id,
      nombre: "Recepción de Expedientes",
      subtitulo: "Presentación de documentación",
      icono: "FolderOpen",
      prefijo: "E",
      destinoAlaId: sur.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 4,
      orden: 3,
      boxIds: [box(boxesSur, 7).id],
    },
    // Auditoria Medica - Ala Sur
    {
      categoriaId: catAuditoria.id,
      nombre: "Prótesis",
      subtitulo: "Autorización de prótesis",
      icono: "Bone",
      prefijo: "PR",
      destinoAlaId: sur.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 7,
      orden: 1,
      boxIds: [box(boxesSur, 1).id],
    },
    {
      categoriaId: catAuditoria.id,
      nombre: "Planes Especiales",
      subtitulo: "Tratamientos de alto costo",
      icono: "Pill",
      prefijo: "P",
      destinoAlaId: sur.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 7,
      orden: 2,
      boxIds: [box(boxesSur, 2).id, box(boxesSur, 3).id],
    },
    {
      categoriaId: catAuditoria.id,
      nombre: "Bioquímica",
      subtitulo: "Análisis y estudios bioquímicos",
      icono: "FlaskConical",
      prefijo: "B",
      destinoAlaId: sur.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 5,
      orden: 3,
      boxIds: [box(boxesSur, 4).id],
    },
    // Practicas y Estudios - Ala Norte, boxes 1-3 compartidos
    {
      categoriaId: catPracticas.id,
      nombre: "Prácticas Médicas",
      subtitulo: "Autorización de prácticas",
      icono: "ClipboardList",
      prefijo: "PM",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 5,
      orden: 1,
      boxIds: boxesNorte.map((b) => b.id),
    },
    {
      categoriaId: catPracticas.id,
      nombre: "Resonancia (RMN)",
      subtitulo: "Autorización de resonancia magnética",
      icono: "Scan",
      prefijo: "RM",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 5,
      orden: 2,
      boxIds: boxesNorte.map((b) => b.id),
    },
    {
      categoriaId: catPracticas.id,
      nombre: "Tomografía (TAC)",
      subtitulo: "Autorización de tomografía",
      icono: "ScanLine",
      prefijo: "TC",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 5,
      orden: 3,
      boxIds: boxesNorte.map((b) => b.id),
    },
    {
      categoriaId: catPracticas.id,
      nombre: "Radiografía",
      subtitulo: "Autorización de radiografía",
      icono: "Radiation",
      prefijo: "RX",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 4,
      orden: 4,
      boxIds: boxesNorte.map((b) => b.id),
    },
    {
      categoriaId: catPracticas.id,
      nombre: "Cirugías",
      subtitulo: "Autorización de intervenciones",
      icono: "Scissors",
      prefijo: "CX",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 8,
      orden: 5,
      boxIds: boxesNorte.map((b) => b.id),
    },
    {
      categoriaId: catPracticas.id,
      nombre: "Programa Materno",
      subtitulo: "Cobertura de embarazo y parto",
      icono: "Baby",
      prefijo: "MA",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 6,
      orden: 6,
      boxIds: boxesNorte.map((b) => b.id),
    },
    {
      categoriaId: catPracticas.id,
      nombre: "Otros Procesos Médicos",
      subtitulo: "Trámites médicos no listados",
      icono: "FileQuestion",
      prefijo: "OM",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 5,
      orden: 7,
      boxIds: boxesNorte.map((b) => b.id),
    },
    // Servicio Social - Planta Alta, Ala Norte, mesa unica
    {
      categoriaId: catSocial.id,
      nombre: "DAI",
      subtitulo: "Discapacidad y ayudas integrales",
      icono: "Accessibility",
      prefijo: "D",
      destinoAlaId: norte.id,
      destinoPisoId: alta.id,
      duracionMinimaEsperada: 8,
      orden: 1,
      boxIds: [mesaSocial.id],
    },
    {
      categoriaId: catSocial.id,
      nombre: "Otros Trámites",
      subtitulo: "Consultas de servicio social",
      icono: "MessageSquare",
      prefijo: "OS",
      destinoAlaId: norte.id,
      destinoPisoId: alta.id,
      duracionMinimaEsperada: 6,
      orden: 2,
      boxIds: [mesaSocial.id],
    },
  ]

  for (const t of tramites) {
    const { boxIds, ...datos } = t
    const creado = await prisma.tramite.create({
      data: { ...datos, ...horarioTramite },
    })
    await prisma.boxTramite.createMany({
      data: boxIds.map((boxId) => ({ boxId, tramiteId: creado.id })),
    })
  }

  console.log(`Seed listo: ${tramites.length} trámites, 11 boxes, 4 categorías`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
```

**DAI y Otros Trámites comparten `mesaSocial`** a propósito: el pliego pide una sola mesa pero dos opciones visibles en el kiosco, para comprensión del usuario y estadísticas separadas. La tabla `BoxTramite` lo permite sin trucos.

- [ ] **Step 2: Registrar el seed en package.json**

Agregar al nivel raíz de `package.json`:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Correr el seed**

```bash
npx prisma db seed
```

Expected: `Seed listo: 15 trámites, 11 boxes, 4 categorías`

- [ ] **Step 3b: Sembrar también la base de test**

Los tests de las tareas siguientes buscan trámites por nombre (`"Planes Especiales"`,
`"Prácticas Médicas"`), así que la base de test necesita el mismo catálogo:

```powershell
$env:DATABASE_URL="sqlserver://TU-SERVIDOR:1433;database=Turnero_Test;user=turnero_app;password=<clave>;encrypt=true;trustServerCertificate=true"
npx prisma db seed
Remove-Item Env:DATABASE_URL
```

Expected: el mismo mensaje.

Agregar el script equivalente en `package.json`:

```json
"db:test:seed": "dotenv -e .env.test.local -- prisma db seed"
```

El seed **no borra antes de insertar**: si se corre dos veces sobre la misma base, duplica el
catálogo y los tests de conteo fallan. Para rehacerlo, `npx prisma migrate reset` primero.

- [ ] **Step 4: Verificar con un test**

Crear `tests/integration/seed.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/db"

describe("catálogo sembrado", () => {
  it("tiene 15 trámites en 4 categorías", async () => {
    expect(await prisma.tramite.count()).toBe(15)
    expect(await prisma.categoria.count()).toBe(4)
  })

  it("no repite número de box dentro de un ala", async () => {
    const boxes = await prisma.box.findMany({ include: { ala: true } })
    const claves = boxes.map((b) => `${b.alaId}-${b.numero}`)
    expect(new Set(claves).size).toBe(boxes.length)
  })

  it("permite Box 1 en ambas alas", async () => {
    const unos = await prisma.box.findMany({ where: { numero: 1 } })
    expect(unos).toHaveLength(2)
    expect(new Set(unos.map((b) => b.alaId)).size).toBe(2)
  })

  it("asigna Planes Especiales a dos boxes", async () => {
    const t = await prisma.tramite.findFirstOrThrow({
      where: { nombre: "Planes Especiales" },
      include: { boxes: true },
    })
    expect(t.boxes).toHaveLength(2)
  })

  it("manda DAI y Otros Trámites a la misma mesa", async () => {
    const dai = await prisma.tramite.findFirstOrThrow({
      where: { nombre: "DAI" },
      include: { boxes: true },
    })
    const otros = await prisma.tramite.findFirstOrThrow({
      where: { nombre: "Otros Trámites" },
      include: { boxes: true },
    })
    expect(dai.boxes[0].boxId).toBe(otros.boxes[0].boxId)
  })
})
```

Run: `npx vitest run tests/integration/seed.test.ts`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts package.json tests/integration/seed.test.ts
git commit -m "feat: seed del catálogo real del pliego"
```

---

## Task 4: Tipos del dominio

**Files:**
- Create: `lib/queue/tipos.ts`

- [ ] **Step 1: Escribir los tipos**

Crear `lib/queue/tipos.ts`:

```typescript
export type EstadoTurno =
  | "esperando"
  | "llamado"
  | "atendiendo"
  | "finalizado"
  | "ausente"
  | "abandonado"

export type TipoEvento =
  | "generado"
  | "llamado"
  | "rellamado"
  | "ausente"
  | "iniciado"
  | "finalizado"
  | "abandonado"

export interface TurnoDominio {
  id: string
  numero: string
  tramiteId: string
  estado: EstadoTurno
  boxId: string | null
  createdAt: Date
}

export interface HorarioDominio {
  horaApertura: string
  horaCierre: string
  diasSemana: string
}

export interface BoxDominio extends HorarioDominio {
  id: string
  activo: boolean
  tramiteIds: string[]
}

export interface TramiteDominio extends HorarioDominio {
  id: string
  activo: boolean
}

export interface Ventana {
  desde: string
  hasta: string
}

export type MotivoNoDisponible =
  | "tramite_inactivo"
  | "fuera_de_horario"
  | "sin_boxes"

export interface Disponibilidad {
  disponible: boolean
  ventanaEfectiva: Ventana | null
  motivo: MotivoNoDisponible | null
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/queue/tipos.ts
git commit -m "feat: tipos del dominio de cola"
```

---

## Task 5: Máquina de estados

Esta es la regla que hoy no existe en ningún archivo, y por eso el estado `atendido` nunca se setea.

**Files:**
- Create: `lib/queue/estado.ts`
- Test: `tests/unit/estado.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/estado.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { transicion, TRANSICIONES } from "@/lib/queue/estado"
import type { TurnoDominio } from "@/lib/queue/tipos"

const base: TurnoDominio = {
  id: "t1",
  numero: "PM01",
  tramiteId: "tr1",
  estado: "esperando",
  boxId: null,
  createdAt: new Date("2026-08-05T10:00:00Z"),
}

describe("transicion", () => {
  it("lleva de esperando a llamado con box", () => {
    const r = transicion({ ...base }, "llamado", { boxId: "b1" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.turno.estado).toBe("llamado")
      expect(r.turno.boxId).toBe("b1")
    }
  })

  it("rechaza llamar sin box", () => {
    const r = transicion({ ...base }, "llamado", {})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("BOX_REQUERIDO")
  })

  it("rechaza cualquier transición desde finalizado", () => {
    for (const tipo of TRANSICIONES.map((t) => t.evento)) {
      const r = transicion({ ...base, estado: "finalizado" }, tipo, { boxId: "b1" })
      expect(r.ok).toBe(false)
    }
  })

  it("permite rellamar un turno llamado sin cambiar de estado", () => {
    const r = transicion({ ...base, estado: "llamado", boxId: "b1" }, "rellamado", { boxId: "b1" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("llamado")
  })

  it("permite recuperar un ausente volviéndolo a llamar", () => {
    const r = transicion({ ...base, estado: "ausente" }, "llamado", { boxId: "b2" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("llamado")
  })

  it("rechaza iniciar atención de un turno que no fue llamado", () => {
    const r = transicion({ ...base }, "iniciado", { boxId: "b1" })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("TRANSICION_INVALIDA")
  })

  it("solo abandona turnos en espera", () => {
    expect(transicion({ ...base }, "abandonado", {}).ok).toBe(true)
    expect(
      transicion({ ...base, estado: "atendiendo" }, "abandonado", {}).ok
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/estado.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/queue/estado"`

- [ ] **Step 3: Implementar**

Crear `lib/queue/estado.ts`:

```typescript
import type { EstadoTurno, TipoEvento, TurnoDominio } from "./tipos"

interface Regla {
  evento: TipoEvento
  desde: EstadoTurno[]
  hacia: EstadoTurno
  requiereBox: boolean
}

export const TRANSICIONES: Regla[] = [
  { evento: "generado", desde: [], hacia: "esperando", requiereBox: false },
  { evento: "llamado", desde: ["esperando", "ausente"], hacia: "llamado", requiereBox: true },
  { evento: "rellamado", desde: ["llamado"], hacia: "llamado", requiereBox: true },
  { evento: "ausente", desde: ["llamado"], hacia: "ausente", requiereBox: false },
  { evento: "iniciado", desde: ["llamado"], hacia: "atendiendo", requiereBox: true },
  { evento: "finalizado", desde: ["atendiendo"], hacia: "finalizado", requiereBox: false },
  { evento: "abandonado", desde: ["esperando"], hacia: "abandonado", requiereBox: false },
]

export type CodigoError = "TRANSICION_INVALIDA" | "BOX_REQUERIDO" | "EVENTO_DESCONOCIDO"

export type ResultadoTransicion =
  | { ok: true; turno: TurnoDominio }
  | { ok: false; codigo: CodigoError; mensaje: string }

export function transicion(
  turno: TurnoDominio,
  evento: TipoEvento,
  datos: { boxId?: string }
): ResultadoTransicion {
  const regla = TRANSICIONES.find((r) => r.evento === evento)
  if (!regla) {
    return { ok: false, codigo: "EVENTO_DESCONOCIDO", mensaje: `Evento ${evento} desconocido` }
  }

  if (!regla.desde.includes(turno.estado)) {
    return {
      ok: false,
      codigo: "TRANSICION_INVALIDA",
      mensaje: `No se puede pasar de ${turno.estado} a ${regla.hacia}`,
    }
  }

  if (regla.requiereBox && !datos.boxId) {
    return { ok: false, codigo: "BOX_REQUERIDO", mensaje: "Falta el box" }
  }

  return {
    ok: true,
    turno: {
      ...turno,
      estado: regla.hacia,
      boxId: datos.boxId ?? turno.boxId,
    },
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/estado.test.ts`
Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/queue/estado.ts tests/unit/estado.test.ts
git commit -m "feat: máquina de estados del turno"
```

---

## Task 6: Reglas de disponibilidad

**Files:**
- Create: `lib/queue/disponibilidad.ts`
- Test: `tests/unit/disponibilidad.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/disponibilidad.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { estaDisponible } from "@/lib/queue/disponibilidad"
import type { BoxDominio, TramiteDominio } from "@/lib/queue/tipos"

const tramite: TramiteDominio = {
  id: "tr1",
  activo: true,
  horaApertura: "08:00",
  horaCierre: "13:00",
  diasSemana: "12345",
}

const box: BoxDominio = {
  id: "b1",
  activo: true,
  horaApertura: "08:00",
  horaCierre: "12:00",
  diasSemana: "12345",
  tramiteIds: ["tr1"],
}

// 2026-08-05 es miercoles (dia ISO 3)
const miercoles = (hhmm: string) => new Date(`2026-08-05T${hhmm}:00`)
const domingo = (hhmm: string) => new Date(`2026-08-09T${hhmm}:00`)

describe("estaDisponible", () => {
  it("la ventana efectiva es la intersección de trámite y box", () => {
    const r = estaDisponible(tramite, [box], miercoles("10:00"))
    expect(r.disponible).toBe(true)
    expect(r.ventanaEfectiva).toEqual({ desde: "08:00", hasta: "12:00" })
  })

  it("no emite a las 12:30 aunque el trámite cierre a las 13:00", () => {
    const r = estaDisponible(tramite, [box], miercoles("12:30"))
    expect(r.disponible).toBe(false)
    expect(r.motivo).toBe("fuera_de_horario")
    expect(r.ventanaEfectiva).toEqual({ desde: "08:00", hasta: "12:00" })
  })

  it("emite en el minuto exacto de apertura", () => {
    expect(estaDisponible(tramite, [box], miercoles("08:00")).disponible).toBe(true)
  })

  it("no emite en el minuto exacto de cierre", () => {
    expect(estaDisponible(tramite, [box], miercoles("12:00")).disponible).toBe(false)
  })

  it("no emite un día no habilitado", () => {
    const r = estaDisponible(tramite, [box], domingo("10:00"))
    expect(r.disponible).toBe(false)
    expect(r.motivo).toBe("fuera_de_horario")
  })

  it("no emite si el trámite está inactivo", () => {
    const r = estaDisponible({ ...tramite, activo: false }, [box], miercoles("10:00"))
    expect(r.disponible).toBe(false)
    expect(r.motivo).toBe("tramite_inactivo")
  })

  it("no emite si no hay boxes asignados", () => {
    const r = estaDisponible(tramite, [], miercoles("10:00"))
    expect(r.disponible).toBe(false)
    expect(r.motivo).toBe("sin_boxes")
  })

  it("no emite si todos los boxes están desactivados", () => {
    const r = estaDisponible(tramite, [{ ...box, activo: false }], miercoles("10:00"))
    expect(r.disponible).toBe(false)
    expect(r.motivo).toBe("sin_boxes")
  })

  it("con dos boxes toma la ventana más amplia", () => {
    const tarde: BoxDominio = { ...box, id: "b2", horaApertura: "09:00", horaCierre: "13:00" }
    const r = estaDisponible(tramite, [box, tarde], miercoles("12:30"))
    expect(r.disponible).toBe(true)
    expect(r.ventanaEfectiva).toEqual({ desde: "08:00", hasta: "13:00" })
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/disponibilidad.test.ts`
Expected: FAIL — no se resuelve el import.

- [ ] **Step 3: Implementar**

Crear `lib/queue/disponibilidad.ts`:

```typescript
import type {
  BoxDominio,
  Disponibilidad,
  TramiteDominio,
  Ventana,
} from "./tipos"

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

function aTexto(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Dia ISO: lunes = 1, domingo = 7. */
function diaIso(fecha: Date): number {
  const d = fecha.getDay()
  return d === 0 ? 7 : d
}

function ahoraEnMinutos(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes()
}

/** Interseccion de dos ventanas; null si no se solapan. */
function intersectar(a: Ventana, b: Ventana): Ventana | null {
  const desde = Math.max(aMinutos(a.desde), aMinutos(b.desde))
  const hasta = Math.min(aMinutos(a.hasta), aMinutos(b.hasta))
  if (desde >= hasta) return null
  return { desde: aTexto(desde), hasta: aTexto(hasta) }
}

function unir(a: Ventana, b: Ventana): Ventana {
  return {
    desde: aTexto(Math.min(aMinutos(a.desde), aMinutos(b.desde))),
    hasta: aTexto(Math.max(aMinutos(a.hasta), aMinutos(b.hasta))),
  }
}

export function estaDisponible(
  tramite: TramiteDominio,
  boxes: BoxDominio[],
  ahora: Date
): Disponibilidad {
  if (!tramite.activo) {
    return { disponible: false, ventanaEfectiva: null, motivo: "tramite_inactivo" }
  }

  const dia = String(diaIso(ahora))
  const boxesUtiles = boxes.filter((b) => b.activo)

  if (boxesUtiles.length === 0) {
    return { disponible: false, ventanaEfectiva: null, motivo: "sin_boxes" }
  }

  const ventanaTramite: Ventana = {
    desde: tramite.horaApertura,
    hasta: tramite.horaCierre,
  }

  // Ventana efectiva = union de las intersecciones tramite x cada box.
  let efectiva: Ventana | null = null
  for (const b of boxesUtiles) {
    const cruce = intersectar(ventanaTramite, {
      desde: b.horaApertura,
      hasta: b.horaCierre,
    })
    if (!cruce) continue
    efectiva = efectiva ? unir(efectiva, cruce) : cruce
  }

  if (!efectiva) {
    return { disponible: false, ventanaEfectiva: null, motivo: "sin_boxes" }
  }

  const habilitaHoy =
    tramite.diasSemana.includes(dia) &&
    boxesUtiles.some((b) => b.diasSemana.includes(dia))

  const minutos = ahoraEnMinutos(ahora)
  const dentro =
    minutos >= aMinutos(efectiva.desde) && minutos < aMinutos(efectiva.hasta)

  if (!habilitaHoy || !dentro) {
    return { disponible: false, ventanaEfectiva: efectiva, motivo: "fuera_de_horario" }
  }

  return { disponible: true, ventanaEfectiva: efectiva, motivo: null }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/disponibilidad.test.ts`
Expected: `9 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/queue/disponibilidad.ts tests/unit/disponibilidad.test.ts
git commit -m "feat: reglas de disponibilidad trámite x box"
```

---

## Task 7: Selección FIFO

**Files:**
- Create: `lib/queue/seleccion.ts`
- Test: `tests/unit/seleccion.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/seleccion.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { siguienteTurno, colaDelBox } from "@/lib/queue/seleccion"
import type { BoxDominio, TurnoDominio } from "@/lib/queue/tipos"

const box: BoxDominio = {
  id: "b1",
  activo: true,
  horaApertura: "08:00",
  horaCierre: "13:00",
  diasSemana: "12345",
  tramiteIds: ["planes", "protesis"],
}

const turno = (
  id: string,
  tramiteId: string,
  minuto: number,
  estado: TurnoDominio["estado"] = "esperando"
): TurnoDominio => ({
  id,
  numero: id.toUpperCase(),
  tramiteId,
  estado,
  boxId: null,
  createdAt: new Date(2026, 7, 5, 10, minuto),
})

describe("colaDelBox", () => {
  it("solo incluye trámites del box y turnos en espera", () => {
    const cola = colaDelBox(
      [
        turno("a", "planes", 1),
        turno("b", "bioquimica", 2),
        turno("c", "protesis", 3),
        turno("d", "planes", 4, "llamado"),
      ],
      box
    )
    expect(cola.map((t) => t.id)).toEqual(["a", "c"])
  })
})

describe("siguienteTurno", () => {
  it("devuelve el más antiguo sin importar el trámite", () => {
    const r = siguienteTurno(
      [turno("nuevo", "planes", 30), turno("viejo", "protesis", 5)],
      box
    )
    expect(r?.id).toBe("viejo")
  })

  it("devuelve null si la cola está vacía", () => {
    expect(siguienteTurno([], box)).toBeNull()
  })

  it("devuelve null si no hay turnos de sus trámites", () => {
    expect(siguienteTurno([turno("x", "bioquimica", 1)], box)).toBeNull()
  })

  it("ignora los turnos ya llamados", () => {
    expect(siguienteTurno([turno("x", "planes", 1, "llamado")], box)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/seleccion.test.ts`
Expected: FAIL — no se resuelve el import.

- [ ] **Step 3: Implementar**

Crear `lib/queue/seleccion.ts`:

```typescript
import type { BoxDominio, TurnoDominio } from "./tipos"

/** Turnos en espera que este box puede atender, del mas antiguo al mas nuevo. */
export function colaDelBox(turnos: TurnoDominio[], box: BoxDominio): TurnoDominio[] {
  return turnos
    .filter((t) => t.estado === "esperando" && box.tramiteIds.includes(t.tramiteId))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

/** FIFO estricta por antiguedad entre todos los tramites del box. */
export function siguienteTurno(
  turnos: TurnoDominio[],
  box: BoxDominio
): TurnoDominio | null {
  return colaDelBox(turnos, box)[0] ?? null
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/seleccion.test.ts`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/queue/seleccion.ts tests/unit/seleccion.test.ts
git commit -m "feat: selección FIFO de la cola de un box"
```

---

## Task 8: Catálogo cacheado

**Files:**
- Create: `lib/catalogo/index.ts`
- Test: `tests/integration/catalogo.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/catalogo.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { obtenerCatalogo, invalidarCatalogo } from "@/lib/catalogo"

describe("catálogo", () => {
  beforeEach(() => invalidarCatalogo())

  it("trae categorías ordenadas con sus trámites", async () => {
    const c = await obtenerCatalogo()
    expect(c.categorias).toHaveLength(4)
    expect(c.categorias.map((x) => x.orden)).toEqual([1, 2, 3, 4])
    const practicas = c.categorias.find((x) => x.nombre === "Prácticas y Estudios")!
    expect(practicas.tramites).toHaveLength(7)
  })

  it("trae el destino resuelto de cada trámite", async () => {
    const c = await obtenerCatalogo()
    const dai = c.tramites.find((t) => t.nombre === "DAI")!
    expect(dai.destino.ala).toBe("Norte")
    expect(dai.destino.piso).toBe("Planta Alta")
  })

  it("trae los boxes de cada trámite", async () => {
    const c = await obtenerCatalogo()
    const planes = c.tramites.find((t) => t.nombre === "Planes Especiales")!
    expect(planes.boxes).toHaveLength(2)
  })

  it("devuelve la misma instancia mientras no se invalide", async () => {
    const a = await obtenerCatalogo()
    const b = await obtenerCatalogo()
    expect(a).toBe(b)
  })

  it("recarga después de invalidar", async () => {
    const a = await obtenerCatalogo()
    invalidarCatalogo()
    const b = await obtenerCatalogo()
    expect(a).not.toBe(b)
    expect(b.tramites).toHaveLength(a.tramites.length)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/integration/catalogo.test.ts`
Expected: FAIL — no se resuelve el import.

- [ ] **Step 3: Implementar**

Crear `lib/catalogo/index.ts`:

```typescript
import { prisma } from "@/lib/db"
import type { BoxDominio, TramiteDominio } from "@/lib/queue/tipos"

export interface TramiteCatalogo extends TramiteDominio {
  nombre: string
  subtitulo: string
  icono: string
  prefijo: string
  orden: number
  categoriaId: string
  duracionMinimaEsperada: number
  destino: { ala: string; piso: string }
  boxes: BoxDominio[]
}

export interface CategoriaCatalogo {
  id: string
  nombre: string
  icono: string
  orden: number
  tramites: TramiteCatalogo[]
}

export interface Catalogo {
  categorias: CategoriaCatalogo[]
  tramites: TramiteCatalogo[]
  boxes: BoxDominio[]
}

let cache: Catalogo | null = null
let cargando: Promise<Catalogo> | null = null

export function invalidarCatalogo(): void {
  cache = null
  cargando = null
}

async function cargar(): Promise<Catalogo> {
  const categoriasDb = await prisma.categoria.findMany({
    where: { activa: true },
    orderBy: { orden: "asc" },
    include: {
      tramites: {
        where: { activo: true },
        orderBy: { orden: "asc" },
        include: {
          destinoAla: true,
          destinoPiso: true,
          boxes: { include: { box: true } },
        },
      },
    },
  })

  const categorias: CategoriaCatalogo[] = categoriasDb.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    icono: c.icono,
    orden: c.orden,
    tramites: c.tramites.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      subtitulo: t.subtitulo,
      icono: t.icono,
      prefijo: t.prefijo,
      orden: t.orden,
      activo: t.activo,
      categoriaId: t.categoriaId,
      duracionMinimaEsperada: t.duracionMinimaEsperada,
      horaApertura: t.horaApertura,
      horaCierre: t.horaCierre,
      diasSemana: t.diasSemana,
      destino: { ala: t.destinoAla.nombre, piso: t.destinoPiso.nombre },
      boxes: t.boxes.map((bt) => ({
        id: bt.box.id,
        activo: bt.box.activo,
        horaApertura: bt.box.horaApertura,
        horaCierre: bt.box.horaCierre,
        diasSemana: bt.box.diasSemana,
        tramiteIds: [t.id],
      })),
    })),
  }))

  const tramites = categorias.flatMap((c) => c.tramites)

  const boxesDb = await prisma.box.findMany({ include: { tramites: true } })
  const boxes: BoxDominio[] = boxesDb.map((b) => ({
    id: b.id,
    activo: b.activo,
    horaApertura: b.horaApertura,
    horaCierre: b.horaCierre,
    diasSemana: b.diasSemana,
    tramiteIds: b.tramites.map((bt) => bt.tramiteId),
  }))

  return { categorias, tramites, boxes }
}

export async function obtenerCatalogo(): Promise<Catalogo> {
  if (cache) return cache
  if (!cargando) {
    cargando = cargar().then((c) => {
      cache = c
      cargando = null
      return c
    })
  }
  return cargando
}
```

El `cargando` evita que dos peticiones simultáneas al arrancar disparen dos cargas completas.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/integration/catalogo.test.ts`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/catalogo/index.ts tests/integration/catalogo.test.ts
git commit -m "feat: catálogo cacheado desde la base"
```

---

## Task 9: Repositorio de afiliados

**Bloqueada parcialmente:** falta el nombre y las columnas del objeto institucional (§12 del spec). Se implementan las dos variantes; el stub se usa hasta que llegue el dato.

**Files:**
- Create: `lib/afiliados/repositorio.ts`
- Test: `tests/unit/afiliados.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/afiliados.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { RepositorioStub, conTimeout } from "@/lib/afiliados/repositorio"

describe("RepositorioStub", () => {
  it("encuentra un DNI conocido", async () => {
    const r = await new RepositorioStub().buscarPorDni("20123456")
    expect(r?.nombre).toBe("Juan Pérez")
  })

  it("devuelve null para un DNI desconocido", async () => {
    expect(await new RepositorioStub().buscarPorDni("99999999")).toBeNull()
  })
})

describe("conTimeout", () => {
  it("devuelve el valor si llega a tiempo", async () => {
    const r = await conTimeout(Promise.resolve({ nombre: "Ana" }), 1000)
    expect(r?.nombre).toBe("Ana")
  })

  it("devuelve null si se pasa del límite", async () => {
    vi.useFakeTimers()
    const lenta = new Promise<{ nombre: string }>((res) =>
      setTimeout(() => res({ nombre: "Tarde" }), 5000)
    )
    const promesa = conTimeout(lenta, 1500)
    await vi.advanceTimersByTimeAsync(1600)
    expect(await promesa).toBeNull()
    vi.useRealTimers()
  })

  it("devuelve null si la promesa rechaza", async () => {
    expect(await conTimeout(Promise.reject(new Error("SQL caído")), 1000)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/afiliados.test.ts`
Expected: FAIL — no se resuelve el import.

- [ ] **Step 3: Implementar**

Crear `lib/afiliados/repositorio.ts`:

```typescript
import { prisma } from "@/lib/db"

export interface Afiliado {
  nombre: string
}

export interface RepositorioAfiliados {
  buscarPorDni(dni: string): Promise<Afiliado | null>
}

/** Corta a los ms indicados y traga cualquier error. Nunca lanza. */
export async function conTimeout<T>(
  promesa: Promise<T>,
  ms: number
): Promise<T | null> {
  let temporizador: ReturnType<typeof setTimeout>
  const limite = new Promise<null>((resolve) => {
    temporizador = setTimeout(() => resolve(null), ms)
  })
  try {
    return await Promise.race([promesa.catch(() => null), limite])
  } finally {
    clearTimeout(temporizador!)
  }
}

export class RepositorioStub implements RepositorioAfiliados {
  private datos: Record<string, string> = {
    "20123456": "Juan Pérez",
    "27888999": "María Gómez",
    "33444555": "Carlos Díaz",
  }

  async buscarPorDni(dni: string): Promise<Afiliado | null> {
    const nombre = this.datos[dni]
    return nombre ? { nombre } : null
  }
}

export class RepositorioSql implements RepositorioAfiliados {
  constructor(
    private base = process.env.AFILIADOS_BASE!,
    private esquema = process.env.AFILIADOS_ESQUEMA ?? "dbo",
    private tabla = process.env.AFILIADOS_TABLA!,
    private colDni = process.env.AFILIADOS_COL_DNI ?? "dni",
    private colApellido = process.env.AFILIADOS_COL_APELLIDO ?? "apellido",
    private colNombre = process.env.AFILIADOS_COL_NOMBRE ?? "nombre"
  ) {}

  async buscarPorDni(dni: string): Promise<Afiliado | null> {
    // Los identificadores vienen de variables de entorno, no de entrada de usuario.
    // El DNI, que si viene del usuario, va como parametro.
    const sql = `
      SELECT TOP 1
        LTRIM(RTRIM([${this.colNombre}])) AS nombre,
        LTRIM(RTRIM([${this.colApellido}])) AS apellido
      FROM [${this.base}].[${this.esquema}].[${this.tabla}]
      WHERE [${this.colDni}] = @P1
    `
    const filas = await prisma.$queryRawUnsafe<
      { nombre: string; apellido: string }[]
    >(sql, dni)

    if (filas.length === 0) return null
    return { nombre: `${filas[0].nombre} ${filas[0].apellido}`.trim() }
  }
}

export function crearRepositorioAfiliados(): RepositorioAfiliados {
  return process.env.AFILIADOS_TABLA ? new RepositorioSql() : new RepositorioStub()
}

export const TIMEOUT_AFILIADO_MS = 1500
```

**Sobre `$queryRawUnsafe`:** los nombres de base, esquema, tabla y columnas se interpolan porque SQL no permite parametrizar identificadores, pero **vienen de variables de entorno del servidor, nunca del usuario**. El DNI, que sí es entrada de usuario, va como parámetro `@P1`. Si alguna vez estos valores pasan a ser editables desde el panel de admin, hay que validarlos contra `sys.tables` antes de usarlos.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/afiliados.test.ts`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/afiliados/repositorio.ts tests/unit/afiliados.test.ts
git commit -m "feat: repositorio de afiliados con stub y timeout"
```

---

## Task 10: Generación de turno atómica

**El test más importante del sistema.** Es el bug que hoy existe y la razón por la que dos kioscos son un problema.

**Files:**
- Create: `server/handlers/generarTurno.ts`
- Test: `tests/integration/generarTurno.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/generarTurno.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { generarTurno } from "@/server/handlers/generarTurno"

async function tramiteDePrueba() {
  return prisma.tramite.findFirstOrThrow({ where: { nombre: "Planes Especiales" } })
}

async function limpiar() {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()
}

describe("generarTurno", () => {
  beforeEach(limpiar)

  it("numera desde 01 con el prefijo del trámite", async () => {
    const t = await tramiteDePrueba()
    const r = await generarTurno({ tramiteId: t.id, dni: "20123456", requestId: "r1" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.numero).toBe("P01")
  })

  it("escribe el evento generado dentro de la misma transacción", async () => {
    const t = await tramiteDePrueba()
    const r = await generarTurno({ tramiteId: t.id, dni: null, requestId: "r2" })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const eventos = await prisma.turnoEvento.findMany({ where: { turnoId: r.turno.id } })
      expect(eventos).toHaveLength(1)
      expect(eventos[0].tipo).toBe("generado")
    }
  })

  it("50 generaciones simultáneas producen 50 números distintos", async () => {
    const t = await tramiteDePrueba()
    const resultados = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        generarTurno({ tramiteId: t.id, dni: null, requestId: `concurrente-${i}` })
      )
    )
    const numeros = resultados.filter((r) => r.ok).map((r) => (r as any).turno.numero)
    expect(numeros).toHaveLength(50)
    expect(new Set(numeros).size).toBe(50)
  })

  it("el mismo requestId devuelve el mismo turno, no uno nuevo", async () => {
    const t = await tramiteDePrueba()
    const a = await generarTurno({ tramiteId: t.id, dni: null, requestId: "doble" })
    const b = await generarTurno({ tramiteId: t.id, dni: null, requestId: "doble" })
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) {
      expect(b.turno.id).toBe(a.turno.id)
      expect(b.turno.numero).toBe(a.turno.numero)
    }
    expect(await prisma.turno.count()).toBe(1)
  })

  it("rechaza un trámite inexistente sin dejar basura", async () => {
    const r = await generarTurno({
      tramiteId: "00000000-0000-0000-0000-000000000000",
      dni: null,
      requestId: "fantasma",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("TRAMITE_INEXISTENTE")
    expect(await prisma.turno.count()).toBe(0)
    expect(await prisma.contador.count()).toBe(0)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/integration/generarTurno.test.ts`
Expected: FAIL — no se resuelve el import.

- [ ] **Step 3: Implementar**

Crear `server/handlers/generarTurno.ts`:

```typescript
import { prisma } from "@/lib/db"
import type { Turno } from "@prisma/client"

export interface ComandoGenerarTurno {
  tramiteId: string
  dni: string | null
  nombreAfiliado?: string | null
  requestId: string
}

export type CodigoErrorGeneracion = "TRAMITE_INEXISTENTE" | "ERROR_BASE"

export type ResultadoGeneracion =
  | { ok: true; turno: Turno }
  | { ok: false; codigo: CodigoErrorGeneracion; mensaje: string; detalle?: string }

/** Dia habil: la fecha local a medianoche, sin hora. */
export function diaHabil(ahora = new Date()): Date {
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
}

export async function generarTurno(
  cmd: ComandoGenerarTurno
): Promise<ResultadoGeneracion> {
  // Idempotencia: si ya existe un turno con este requestId, se devuelve ese.
  const previo = await prisma.turno.findUnique({ where: { requestId: cmd.requestId } })
  if (previo) return { ok: true, turno: previo }

  const tramite = await prisma.tramite.findUnique({ where: { id: cmd.tramiteId } })
  if (!tramite) {
    return {
      ok: false,
      codigo: "TRAMITE_INEXISTENTE",
      mensaje: "El trámite solicitado no existe",
    }
  }

  const fecha = diaHabil()

  try {
    const turno = await prisma.$transaction(async (tx) => {
      // MERGE con HOLDLOCK es el upsert atomico de SQL Server: incrementa si la
      // fila del dia existe, la crea en 1 si no, y devuelve el valor resultante.
      // Sin HOLDLOCK, dos MERGE simultaneos pueden insertar la misma clave.
      const filas = await tx.$queryRaw<{ valor: number }[]>`
        MERGE [Contador] WITH (HOLDLOCK) AS destino
        USING (SELECT ${cmd.tramiteId} AS tramiteId, ${fecha} AS fecha) AS origen
          ON destino.tramiteId = origen.tramiteId AND destino.fecha = origen.fecha
        WHEN MATCHED THEN
          UPDATE SET valor = destino.valor + 1
        WHEN NOT MATCHED THEN
          INSERT (id, tramiteId, fecha, valor)
          VALUES (NEWID(), origen.tramiteId, origen.fecha, 1)
        OUTPUT INSERTED.valor AS valor;
      `

      const valor = filas[0].valor
      const numero = `${tramite.prefijo}${String(valor).padStart(2, "0")}`

      const creado = await tx.turno.create({
        data: {
          numero,
          fecha,
          tramiteId: cmd.tramiteId,
          dni: cmd.dni,
          nombreAfiliado: cmd.nombreAfiliado ?? null,
          estado: "esperando",
          requestId: cmd.requestId,
        },
      })

      await tx.turnoEvento.create({
        data: { turnoId: creado.id, tipo: "generado" },
      })

      return creado
    })

    return { ok: true, turno }
  } catch (e) {
    // Carrera con el mismo requestId: gano la otra transaccion, devolvemos la suya.
    const existente = await prisma.turno.findUnique({
      where: { requestId: cmd.requestId },
    })
    if (existente) return { ok: true, turno: existente }

    return {
      ok: false,
      codigo: "ERROR_BASE",
      mensaje: "No se pudo generar el turno",
      detalle: e instanceof Error ? e.message : String(e),
    }
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/integration/generarTurno.test.ts`
Expected: `5 passed`

Si el test de las 50 concurrentes falla con números repetidos, falta `WITH (HOLDLOCK)` en el `MERGE`.

- [ ] **Step 5: Commit**

```bash
git add server/handlers/generarTurno.ts tests/integration/generarTurno.test.ts
git commit -m "feat: generación de turno atómica e idempotente"
```

---

## Task 11: Llamado con transición condicionada

**Files:**
- Create: `server/handlers/llamarTurno.ts`
- Test: `tests/integration/llamarTurno.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/llamarTurno.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { generarTurno } from "@/server/handlers/generarTurno"
import { llamarTurno } from "@/server/handlers/llamarTurno"

async function escenario() {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()

  const tramite = await prisma.tramite.findFirstOrThrow({
    where: { nombre: "Planes Especiales" },
    include: { boxes: true },
  })
  const r = await generarTurno({ tramiteId: tramite.id, dni: null, requestId: "x1" })
  if (!r.ok) throw new Error("no se pudo generar")
  return { turno: r.turno, boxA: tramite.boxes[0].boxId, boxB: tramite.boxes[1].boxId }
}

describe("llamarTurno", () => {
  let ctx: Awaited<ReturnType<typeof escenario>>
  beforeEach(async () => { ctx = await escenario() })

  it("pasa el turno a llamado y le asigna el box", async () => {
    const r = await llamarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.turno.estado).toBe("llamado")
      expect(r.turno.boxId).toBe(ctx.boxA)
    }
  })

  it("escribe el evento llamado con el box", async () => {
    await llamarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA })
    const ev = await prisma.turnoEvento.findFirstOrThrow({
      where: { turnoId: ctx.turno.id, tipo: "llamado" },
    })
    expect(ev.boxId).toBe(ctx.boxA)
  })

  it("si dos boxes llaman a la vez, solo uno gana", async () => {
    const [a, b] = await Promise.all([
      llamarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA }),
      llamarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxB }),
    ])
    const ganadores = [a, b].filter((r) => r.ok)
    const perdedores = [a, b].filter((r) => !r.ok)
    expect(ganadores).toHaveLength(1)
    expect(perdedores).toHaveLength(1)
    expect((perdedores[0] as any).codigo).toBe("YA_LLAMADO")
  })

  it("el segundo llamado informa qué box se lo quedó", async () => {
    await llamarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA })
    const r = await llamarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxB })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.boxQueLoTiene).toBe(ctx.boxA)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/integration/llamarTurno.test.ts`
Expected: FAIL — no se resuelve el import.

- [ ] **Step 3: Implementar**

Crear `server/handlers/llamarTurno.ts`:

```typescript
import { prisma } from "@/lib/db"
import type { Turno } from "@prisma/client"

export interface ComandoLlamarTurno {
  turnoId: string
  boxId: string
  empleadoId?: string | null
}

export type ResultadoLlamado =
  | { ok: true; turno: Turno }
  | {
      ok: false
      codigo: "YA_LLAMADO" | "TURNO_INEXISTENTE" | "ERROR_BASE"
      mensaje: string
      boxQueLoTiene?: string | null
      detalle?: string
    }

export async function llamarTurno(cmd: ComandoLlamarTurno): Promise<ResultadoLlamado> {
  try {
    return await prisma.$transaction(async (tx) => {
      // La condicion en el WHERE es la garantia: si otro box ya lo llamo,
      // esto afecta cero filas y no hay carrera posible.
      const afectadas = await tx.$executeRaw`
        UPDATE [Turno]
        SET estado = 'llamado', boxId = ${cmd.boxId}
        WHERE id = ${cmd.turnoId} AND estado IN ('esperando', 'ausente')
      `

      if (afectadas === 0) {
        const actual = await tx.turno.findUnique({ where: { id: cmd.turnoId } })
        if (!actual) {
          return {
            ok: false as const,
            codigo: "TURNO_INEXISTENTE" as const,
            mensaje: "Ese turno no existe",
          }
        }
        return {
          ok: false as const,
          codigo: "YA_LLAMADO" as const,
          mensaje: "Ese turno ya fue llamado",
          boxQueLoTiene: actual.boxId,
        }
      }

      await tx.turnoEvento.create({
        data: {
          turnoId: cmd.turnoId,
          tipo: "llamado",
          boxId: cmd.boxId,
          empleadoId: cmd.empleadoId ?? null,
        },
      })

      const turno = await tx.turno.findUniqueOrThrow({ where: { id: cmd.turnoId } })
      return { ok: true as const, turno }
    })
  } catch (e) {
    return {
      ok: false,
      codigo: "ERROR_BASE",
      mensaje: "No se pudo llamar el turno",
      detalle: e instanceof Error ? e.message : String(e),
    }
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/integration/llamarTurno.test.ts`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add server/handlers/llamarTurno.ts tests/integration/llamarTurno.test.ts
git commit -m "feat: llamado de turno con transición condicionada"
```

---

## Task 12: Rooms y ruteo de eventos

El requisito del pliego que hay que **demostrar**: la TV del Ala Sur no ve llamados del Norte.

**Files:**
- Create: `server/rooms.ts`
- Test: `tests/unit/rooms.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/rooms.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { roomAla, roomPisoAla, roomBox, destinatarios } from "@/server/rooms"

describe("nombres de room", () => {
  it("normaliza el nombre del ala a minúsculas", () => {
    expect(roomAla("Norte")).toBe("ala:norte")
    expect(roomAla("Sur")).toBe("ala:sur")
  })

  it("arma la room de piso + ala", () => {
    expect(roomPisoAla("Planta Alta", "Norte")).toBe("piso:planta-alta:ala:norte")
  })

  it("arma la room del box", () => {
    expect(roomBox("abc")).toBe("box:abc")
  })
})

describe("destinatarios", () => {
  const contexto = { ala: "Norte", piso: "Planta Baja", boxId: "b1", tramiteBoxIds: ["b1", "b2"] }

  it("TURNO_LLAMADO va al ala, al piso+ala y al box", () => {
    const r = destinatarios("TURNO_LLAMADO", contexto)
    expect(r).toContain("ala:norte")
    expect(r).toContain("piso:planta-baja:ala:norte")
    expect(r).toContain("box:b1")
  })

  it("TURNO_LLAMADO del Norte nunca incluye al Sur", () => {
    const r = destinatarios("TURNO_LLAMADO", contexto)
    expect(r).not.toContain("ala:sur")
    expect(r.some((x) => x.includes("sur"))).toBe(false)
  })

  it("TURNO_GENERADO va al kiosco y a todos los boxes que atienden el trámite", () => {
    const r = destinatarios("TURNO_GENERADO", contexto)
    expect(r).toContain("kiosco")
    expect(r).toContain("box:b1")
    expect(r).toContain("box:b2")
  })

  it("CATALOGO_ACTUALIZADO va a todos", () => {
    expect(destinatarios("CATALOGO_ACTUALIZADO", contexto)).toEqual(["*"])
  })

  it("admin recibe todos los eventos de turno", () => {
    for (const ev of ["TURNO_GENERADO", "TURNO_LLAMADO", "TURNO_FINALIZADO"] as const) {
      expect(destinatarios(ev, contexto)).toContain("admin")
    }
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/rooms.test.ts`
Expected: FAIL — no se resuelve el import.

- [ ] **Step 3: Implementar**

Crear `server/rooms.ts`:

```typescript
export type EventoTurnero =
  | "TURNO_GENERADO"
  | "TURNO_LLAMADO"
  | "TURNO_RELLAMADO"
  | "TURNO_AUSENTE"
  | "TURNO_INICIADO"
  | "TURNO_FINALIZADO"
  | "CATALOGO_ACTUALIZADO"

export interface ContextoEvento {
  ala: string
  piso: string
  boxId: string | null
  tramiteBoxIds: string[]
}

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")

export const ROOM_KIOSCO = "kiosco"
export const ROOM_ADMIN = "admin"
export const TODOS = "*"

export const roomAla = (ala: string) => `ala:${slug(ala)}`
export const roomPisoAla = (piso: string, ala: string) =>
  `piso:${slug(piso)}:ala:${slug(ala)}`
export const roomBox = (boxId: string) => `box:${boxId}`

/** A que rooms se emite cada evento. Unico lugar donde vive esa decision. */
export function destinatarios(
  evento: EventoTurnero,
  ctx: ContextoEvento
): string[] {
  if (evento === "CATALOGO_ACTUALIZADO") return [TODOS]

  const rooms = new Set<string>([ROOM_ADMIN])

  switch (evento) {
    case "TURNO_GENERADO":
      rooms.add(ROOM_KIOSCO)
      ctx.tramiteBoxIds.forEach((id) => rooms.add(roomBox(id)))
      break

    case "TURNO_LLAMADO":
    case "TURNO_RELLAMADO":
      rooms.add(roomAla(ctx.ala))
      rooms.add(roomPisoAla(ctx.piso, ctx.ala))
      if (ctx.boxId) rooms.add(roomBox(ctx.boxId))
      break

    case "TURNO_AUSENTE":
    case "TURNO_INICIADO":
    case "TURNO_FINALIZADO":
      if (ctx.boxId) rooms.add(roomBox(ctx.boxId))
      ctx.tramiteBoxIds.forEach((id) => rooms.add(roomBox(id)))
      break
  }

  return [...rooms]
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/rooms.test.ts`
Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add server/rooms.ts tests/unit/rooms.test.ts
git commit -m "feat: rooms de Socket.io y ruteo de eventos por ala"
```

---

## Task 13: Aislamiento por ala, extremo a extremo

El test unitario de la Tarea 12 prueba la **decisión**. Este prueba que el servidor la **cumple**.

**Files:**
- Create: `server/index.ts`
- Modify: `server.ts` (queda como arranque delgado)
- Test: `tests/integration/aislamientoAla.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/aislamientoAla.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createServer, type Server as HttpServer } from "http"
import { Server as IoServer } from "socket.io"
import { io as cliente, type Socket } from "socket.io-client"
import { montarTurnero } from "@/server/index"
import { prisma } from "@/lib/db"

let http: HttpServer
let puerto: number
let sur: Socket
let norte: Socket

function conectar(): Promise<Socket> {
  return new Promise((resolve) => {
    const s = cliente(`http://localhost:${puerto}`, { transports: ["websocket"] })
    s.on("connect", () => resolve(s))
  })
}

function unirse(s: Socket, room: string): Promise<void> {
  return new Promise((resolve) => s.emit("SUSCRIBIR", { room }, () => resolve()))
}

beforeAll(async () => {
  http = createServer()
  const io = new IoServer(http)
  montarTurnero(io)
  await new Promise<void>((r) => http.listen(0, r))
  puerto = (http.address() as any).port
  sur = await conectar()
  norte = await conectar()
  await unirse(sur, "ala:sur")
  await unirse(norte, "ala:norte")
})

afterAll(async () => {
  sur.close()
  norte.close()
  http.close()
})

describe("aislamiento por ala", () => {
  it("un llamado del Norte no llega al cliente del Sur", async () => {
    const tramite = await prisma.tramite.findFirstOrThrow({
      where: { nombre: "Prácticas Médicas" },
      include: { boxes: true, destinoAla: true },
    })
    expect(tramite.destinoAla.nombre).toBe("Norte")

    let recibioSur = false
    sur.on("TURNO_LLAMADO", () => { recibioSur = true })

    const recibioNorte = new Promise<boolean>((resolve) => {
      norte.on("TURNO_LLAMADO", () => resolve(true))
      setTimeout(() => resolve(false), 3000)
    })

    const gen = await new Promise<any>((resolve) =>
      norte.emit("GENERAR_TURNO", { tramiteId: tramite.id, dni: null, requestId: `aisl-${Date.now()}` }, resolve)
    )
    expect(gen.ok).toBe(true)

    await new Promise<any>((resolve) =>
      norte.emit("LLAMAR_TURNO", { turnoId: gen.turno.id, boxId: tramite.boxes[0].boxId }, resolve)
    )

    expect(await recibioNorte).toBe(true)
    // La asercion que importa es la negativa.
    expect(recibioSur).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/integration/aislamientoAla.test.ts`
Expected: FAIL — no se resuelve `@/server/index`.

- [ ] **Step 3: Implementar el montaje**

Crear `server/index.ts`:

```typescript
import type { Server as IoServer, Socket } from "socket.io"
import { generarTurno } from "./handlers/generarTurno"
import { llamarTurno } from "./handlers/llamarTurno"
import { destinatarios, TODOS, type EventoTurnero } from "./rooms"
import { obtenerCatalogo } from "@/lib/catalogo"

async function contextoDe(tramiteId: string, boxId: string | null) {
  const catalogo = await obtenerCatalogo()
  const tramite = catalogo.tramites.find((t) => t.id === tramiteId)
  return {
    ala: tramite?.destino.ala ?? "",
    piso: tramite?.destino.piso ?? "",
    boxId,
    tramiteBoxIds: tramite?.boxes.map((b) => b.id) ?? [],
  }
}

async function emitir(
  io: IoServer,
  evento: EventoTurnero,
  datos: unknown,
  tramiteId: string,
  boxId: string | null
) {
  const rooms = destinatarios(evento, await contextoDe(tramiteId, boxId))
  if (rooms.includes(TODOS)) {
    io.emit(evento, datos)
    return
  }
  for (const room of rooms) io.to(room).emit(evento, datos)
}

export function montarTurnero(io: IoServer): void {
  io.on("connection", (socket: Socket) => {
    socket.on("SUSCRIBIR", ({ room }: { room: string }, ack?: () => void) => {
      socket.join(room)
      ack?.()
    })

    socket.on("GENERAR_TURNO", async (cmd, ack?: (r: unknown) => void) => {
      const r = await generarTurno(cmd)
      ack?.(r)
      if (r.ok) await emitir(io, "TURNO_GENERADO", { turno: r.turno }, r.turno.tramiteId, null)
    })

    socket.on("LLAMAR_TURNO", async (cmd, ack?: (r: unknown) => void) => {
      const r = await llamarTurno(cmd)
      ack?.(r)
      if (r.ok) {
        await emitir(io, "TURNO_LLAMADO", { turno: r.turno }, r.turno.tramiteId, r.turno.boxId)
      }
    })
  })
}
```

- [ ] **Step 4: Adelgazar server.ts**

Reemplazar el contenido completo de `server.ts`:

```typescript
import { createServer } from "http"
import { Server } from "socket.io"
import next from "next"
import { montarTurnero } from "./server/index"

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME ?? "localhost"
const port = Number(process.env.PORT ?? 3000)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res))
  const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } })

  montarTurnero(io)

  httpServer.listen(port, () => {
    console.log(`Servidor listo en http://${hostname}:${port}`)
  })
})
```

Toda la lógica de Supabase se va con este reemplazo.

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run tests/integration/aislamientoAla.test.ts`
Expected: `1 passed`

- [ ] **Step 6: Commit**

```bash
git add server/index.ts server.ts tests/integration/aislamientoAla.test.ts
git commit -m "feat: montaje del servidor con rooms por ala"
```

---

## Task 14: Retirar Supabase

**Files:**
- Delete: `lib/supabase.ts`, `components/supabase-status.tsx`
- Modify: `lib/turno-context.tsx`, `package.json`

- [ ] **Step 1: Sacar el evento SUPABASE_STATUS del contexto**

En `lib/turno-context.tsx`, borrar el bloque de `socket.on("SUPABASE_STATUS", ...)` (líneas 77-80), el estado `supabaseConnected` y su lugar en el valor del provider y en `SocketContextType`.

Renombrarlo no: el indicador genérico de estado de base lo introduce SP1 junto con la UI nueva.

- [ ] **Step 2: Borrar los archivos**

```bash
rm lib/supabase.ts components/supabase-status.tsx
```

- [ ] **Step 3: Desinstalar la dependencia**

```bash
npm uninstall @supabase/supabase-js
```

- [ ] **Step 4: Verificar que no queda ninguna referencia**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `git grep -in supabase -- ':!package-lock.json' ':!docs/'`
Expected: sin resultados. Si aparece alguno, borrarlo antes de seguir.

- [ ] **Step 5: Correr toda la suite**

Run: `npm test`
Expected: todos los tests en verde. Anotar el número exacto de tests que pasan.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: retirar Supabase, la persistencia queda en SQL Server"
```

---

## Task 15: Cierre de SP0

- [ ] **Step 1: Verificación completa**

```bash
npm test
```

Expected: **todos verdes**. Pegar la salida completa. Sin la salida pegada, SP0 no está terminado.

- [ ] **Step 2: Verificar tipos y build**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Actualizar el grafo del repositorio**

```bash
npx graphify .
```

Expected: `graphify-out/GRAPH_REPORT.md` regenerado con los módulos nuevos (`lib/queue/`, `server/handlers/`, `lib/catalogo/`) y sin los de Supabase.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: cerrar SP0 y actualizar el grafo del repositorio"
```

---

## Cobertura del spec

| Requisito del spec | Tarea |
|---|---|
| §5.1 estructura física, `unique(alaId, numero)` | 2, 3 |
| §5.2 catálogo configurable, `BoxTramite` | 2, 3, 8 |
| §5.2 horario en box y trámite, ventana efectiva | 6 |
| §5.3 estados, diario de eventos, contador diario | 2, 5, 10 |
| §5.4 repositorio de afiliados con timeout | 9 |
| §5.5 transacción atómica de generación | 10 |
| §6.1 motor de cola puro | 5, 6, 7 |
| §6.2 catálogo cacheado con `invalidar()` | 8 |
| §6.3 rooms | 12, 13 |
| §6.4 eventos delta | 12, 13 |
| §6.5 un archivo por comando | 10, 11 |
| §9.2 idempotencia por `requestId` | 10 |
| §9.3 llamado concurrente | 11 |
| §10.1 unitarios de los tres módulos puros | 5, 6, 7 |
| §10.2 concurrencia, idempotencia, llamado (contra SQL Server real) | 10, 11 |
| §10.3 aislamiento por ala | 13 |

**Fuera de este plan, va en SP2:** `rellamarTurno`, `marcarAusente`, `iniciarAtencion`, `finalizarAtencion`, `SesionOperador` con latido, job diario de abandonados, job de retención de DNI. La máquina de estados de la Tarea 5 ya los contempla; falta el handler y la UI.
