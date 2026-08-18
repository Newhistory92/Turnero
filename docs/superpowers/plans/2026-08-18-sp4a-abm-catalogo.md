# SP4a — ABM de catálogo y control de acceso por rol

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un panel en `/admin` que permite editar las siete entidades del catálogo desde la interfaz, protegido por rol, que propaga cada cambio al kiosco sin interrumpir a quien lo esté usando.

**Architecture:** Los formularios escriben con Server Actions, no con socket: son formularios, no eventos de turno. Cada mutación valida, escribe, invalida el caché en memoria del catálogo, emite `CATALOGO_ACTUALIZADO` por un singleton nuevo de `io` y revalida la ruta. La lógica de negocio vive en funciones planas testeables; los Server Actions son envoltorios delgados.

**Tech Stack:** Next.js 15.2.4 App Router (Server Components + Server Actions), React 19, Prisma 6 sobre SQL Server, Socket.io 4, Vitest, Playwright.

## Global Constraints

- **Nunca se copian contraseñas ni hashes a la base del Turnero.** Las credenciales se validan en vivo contra la base de la obra social en cada login, vía `verificarCredencial`. Ningún código de este plan lee, guarda ni registra `claveUsuario`.
- **El control de acceso se verifica siempre en el servidor.** Deshabilitar un control en la interfaz es cosmético; la regla la garantiza el rechazo de la mutación.
- Los tres roles son exactamente `"operador"`, `"supervisor"` y `"admin"`, en minúsculas, tal como se guardan en `Empleado.rol` (`VarChar(15)`).
- `invalidarCatalogo()` va **antes** de emitir `CATALOGO_ACTUALIZADO`. Al revés, un cliente rápido recibiría el caché viejo.
- `Turno.fecha` es `DATE` y se filtra con `Date.UTC()`; `TurnoEvento.timestamp` es `DATETIME2` y se filtra en hora local. No mezclar.
- El código de este proyecto está en español, sin tildes en identificadores. Los comentarios explican **por qué**, no qué.
- Tests: `npm test` corre todo; `npm run test:unit` y `npm run test:integration` corren por capa. La integración pega contra `Turnero_Test` vía `.env.test.local`.

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `lib/admin/acceso.ts` | Resolver el actor de la cookie y decidir qué puede hacer según el rol |
| `lib/admin/validaciones.ts` | Funciones puras de validación de campos del catálogo |
| `lib/admin/referencias.ts` | Contar referencias de una entidad y decidir si se puede borrar |
| `lib/admin/mutaciones.ts` | Las escrituras como funciones planas, testeables sin HTTP |
| `lib/admin/estadoFormulario.ts` | El tipo y el estado inicial que comparten acciones y formularios |
| `lib/admin/acciones.ts` | Server Actions: envoltorios delgados sobre `mutaciones.ts` |
| `lib/admin/avisos.ts` | Aviso de destino inconsistente con los boxes |
| `lib/kiosco/catalogoVencido.ts` | Cuándo el kiosco puede refrescar sin interrumpir a nadie |
| `server/io.ts` | Singleton de `io` para emitir desde código HTTP |
| `app/admin/layout.tsx` | Guard de rol y navegación del panel |
| `app/admin/page.tsx` | Índice del panel |
| `app/admin/_componentes/TablaAbm.tsx` | Tabla de listado reutilizable |
| `app/admin/_componentes/Campos.tsx` | Campos de formulario reutilizables |
| `app/admin/catalogo/simples/page.tsx` | ABM de Sede, Ala, Piso y Categoría |
| `app/admin/catalogo/boxes/page.tsx` | ABM de Box, incluida la asignación de trámites |
| `app/admin/catalogo/tramites/page.tsx` | ABM de Trámite |

**Se modifican:** `prisma/schema.prisma`, `lib/auth/sesion.ts`, `lib/auth/operador.ts`, `lib/kiosco/socket.ts`, `app/api/auth/boxes/route.ts`, `app/api/auth/login/route.ts`, `app/operador/login/page.tsx`, `app/kiosco/Wizard.tsx`, `server.ts`, `CLAUDE.md`.

**Por qué `mutaciones.ts` y `acciones.ts` están separados:** el spec §11 nombra solo `acciones.ts`. Un Server Action se invoca por el runtime de Next con `FormData` y no se puede llamar limpiamente desde Vitest. Poner la lógica en funciones planas que reciben objetos y devuelven resultados permite probar en integración la regla que más importa —que un `supervisor` no pueda escribir— sin levantar un servidor. El Server Action queda como traducción de `FormData` a objeto.

**Por qué `estadoFormulario.ts` existe:** un módulo con la directiva `"use server"` sólo puede exportar funciones asíncronas. Next falla el build si exporta una constante. `ESTADO_INICIAL` lo necesitan tanto `acciones.ts` como cada formulario, así que vive en su propio módulo sin la directiva.

---

## Task 1: Migración del esquema y sesión sin box

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/auth/sesion.ts:18-21,52-57,75-82`
- Modify: `server/index.ts:70-79`
- Test: `tests/integration/sesionAdmin.test.ts`

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces: `abrirSesion(empleadoId: string, boxId: string | null): Promise<ResultadoApertura>` y `sesionActiva(sesionId: string): Promise<{ id: string; empleadoId: string; boxId: string | null } | null>`. Las columnas `Ala.activa` y `Piso.activa`, ambas `Boolean @default(true)`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/sesionAdmin.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { abrirSesion, sesionActiva } from "@/lib/auth/sesion"

async function limpiar() {
  await prisma.sesionOperador.deleteMany()
}

async function empleadoDePrueba(rol: string) {
  return prisma.empleado.upsert({
    where: { dniInstitucional: `admin-${rol}` },
    update: { rol },
    create: { dniInstitucional: `admin-${rol}`, nombre: `Prueba ${rol}`, rol },
  })
}

describe("sesión sin box", () => {
  beforeEach(limpiar)
  afterAll(async () => {
    await limpiar()
    await prisma.$disconnect()
  })

  it("abre sesión sin box sin exigir asignación en EmpleadoBox", async () => {
    const e = await empleadoDePrueba("admin")
    const r = await abrirSesion(e.id, null)
    expect(r.ok).toBe(true)
  })

  it("la sesión sin box se resuelve con boxId nulo", async () => {
    const e = await empleadoDePrueba("admin")
    const r = await abrirSesion(e.id, null)
    if (!r.ok) throw new Error("no abrió")

    const activa = await sesionActiva(r.sesionId)
    expect(activa?.boxId).toBeNull()
  })

  // Dos admins trabajando a la vez no compiten por ningún recurso fisico,
  // asi que la exclusividad de box no puede aplicarles.
  it("dos sesiones sin box conviven", async () => {
    const a = await empleadoDePrueba("admin")
    const b = await empleadoDePrueba("supervisor")
    expect((await abrirSesion(a.id, null)).ok).toBe(true)
    expect((await abrirSesion(b.id, null)).ok).toBe(true)
  })

  it("sigue exigiendo asignación cuando sí hay box", async () => {
    const e = await empleadoDePrueba("operador")
    const box = await prisma.box.findFirstOrThrow()
    const r = await abrirSesion(e.id, box.id)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("no debía abrir")
    expect(r.codigo).toBe("BOX_NO_ASIGNADO")
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm run test:integration -- tests/integration/sesionAdmin.test.ts`
Expected: FAIL — TypeScript rechaza `null` como segundo argumento de `abrirSesion`.

- [ ] **Step 3: Cambiar el esquema**

En `prisma/schema.prisma`, en el modelo `Ala`, agregar la columna después de `orden`:

```prisma
model Ala {
  id              String    @id @default(uuid())
  sedeId          String
  sede            Sede      @relation(fields: [sedeId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  nombre          String
  orden           Int
  activa          Boolean   @default(true)
  boxes           Box[]
  tramitesDestino Tramite[] @relation("TramiteDestinoAla")

  @@unique([sedeId, nombre])
}
```

En el modelo `Piso`, después de `nivel`:

```prisma
model Piso {
  id              String    @id @default(uuid())
  sedeId          String
  sede            Sede      @relation(fields: [sedeId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  nombre          String
  nivel           Int
  activa          Boolean   @default(true)
  boxes           Box[]
  tramitesDestino Tramite[] @relation("TramiteDestinoPiso")

  @@unique([sedeId, nivel])
}
```

En `SesionOperador`, hacer `boxId` y `box` opcionales:

```prisma
model SesionOperador {
  id           String    @id @default(uuid())
  empleadoId   String
  empleado     Empleado  @relation(fields: [empleadoId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  boxId        String?
  box          Box?      @relation(fields: [boxId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  inicio       DateTime  @default(now())
  fin          DateTime?
  ultimoLatido DateTime  @default(now())

  @@index([boxId, fin])
}
```

- [ ] **Step 4: Generar y aplicar la migración**

```bash
npx prisma migrate dev --name sp4a_sesion_sin_box_y_bajas
```

Expected: crea `prisma/migrations/<timestamp>_sp4a_sesion_sin_box_y_bajas/migration.sql` y regenera el cliente. El `@default(true)` hace que las filas existentes de `Ala` y `Piso` queden activas, y las sesiones existentes conservan su box.

- [ ] **Step 5: Aplicar la migración a la base de test**

```bash
npm run db:test:migrate
```

Expected: `Turnero_Test` queda con el mismo esquema.

- [ ] **Step 6: Adaptar `lib/auth/sesion.ts`**

Reemplazar la firma y el cuerpo de `abrirSesion`, y el tipo de retorno de `sesionActiva`:

```ts
export async function abrirSesion(
  empleadoId: string,
  boxId: string | null
): Promise<ResultadoApertura> {
  try {
    // Sin box no hay recurso fisico que ocupar: ni asignacion que verificar
    // ni exclusividad que imponer. Es la sesion del panel de administracion.
    if (boxId === null) {
      const sesion = await prisma.sesionOperador.create({
        data: { empleadoId, boxId: null },
      })
      return { ok: true, sesionId: sesion.id }
    }

    const asignado = await prisma.empleadoBox.findUnique({
      where: { empleadoId_boxId: { empleadoId, boxId } },
    })
    if (!asignado) {
      return {
        ok: false,
        codigo: "BOX_NO_ASIGNADO",
        mensaje: "No tenés ese box asignado",
      }
    }

    const abierta = await prisma.sesionOperador.findFirst({
      where: { boxId, fin: null },
      include: { empleado: true },
      orderBy: { inicio: "desc" },
    })

    if (abierta) {
      if (abierta.ultimoLatido > vencimiento()) {
        return {
          ok: false,
          codigo: "BOX_OCUPADO",
          mensaje: `Ese box tiene sesión abierta por ${abierta.empleado.nombre}`,
        }
      }
      // Latido vencido: alguien cerró el navegador sin desloguearse.
      // Se cierra sola, sin necesidad de que un supervisor intervenga.
      await prisma.sesionOperador.update({
        where: { id: abierta.id },
        data: { fin: new Date() },
      })
    }

    const sesion = await prisma.sesionOperador.create({ data: { empleadoId, boxId } })
    return { ok: true, sesionId: sesion.id }
  } catch (e) {
    return {
      ok: false,
      codigo: "ERROR_BASE",
      mensaje: "No se pudo abrir la sesión",
      detalle: e instanceof Error ? e.message : String(e),
    }
  }
}
```

Y `sesionActiva`:

```ts
export async function sesionActiva(
  sesionId: string
): Promise<{ id: string; empleadoId: string; boxId: string | null } | null> {
  const s = await prisma.sesionOperador.findFirst({
    where: { id: sesionId, fin: null },
  })
  return s ? { id: s.id, empleadoId: s.empleadoId, boxId: s.boxId } : null
}
```

- [ ] **Step 7: Correr el test**

Run: `npm run test:integration -- tests/integration/sesionAdmin.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 8: Ajustar `ENTRAR_BOX` en el socket**

`sesionActiva` ahora devuelve `boxId: string | null`, y `server/index.ts:76-78` se lo pasa a `roomBox()` y a `armarSnapshot()`, que exigen `string`. Sin este cambio, `tsc` falla.

Reemplazar el handler de `ENTRAR_BOX` (líneas 70-79) por:

```ts
    socket.on("ENTRAR_BOX", async (_datos, ack?: (r: unknown) => void) => {
      const sesion = await sesionDelSocket(socket)
      // Una sesion sin box es la del panel de administracion: tiene cookie
      // valida pero no le corresponde el canal del operador.
      if (!sesion || sesion.boxId === null) {
        ack?.({ ok: false, codigo: "SIN_SESION", mensaje: "Iniciá sesión de nuevo" })
        return
      }
      socket.join(roomBox(sesion.boxId))
      socket.data.sesion = sesion
      ack?.({ ok: true, snapshot: await armarSnapshot(sesion.boxId) })
    })
```

- [ ] **Step 9: Verificar que nada se rompió**

Run: `npx tsc --noEmit`
Expected: sin errores. Si aparece alguno más por `boxId` nullable, resolverlo del mismo modo: donde el contexto exige box, rechazar la sesión sin box.

Run: `npm test`
Expected: los 201 tests previos siguen pasando, más los 4 nuevos.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/auth/sesion.ts server/index.ts tests/integration/sesionAdmin.test.ts
git commit -m "feat(sp4a): sesion sin box y columna activa en Ala y Piso"
```

---

## Task 2: Roles y decisiones de acceso

**Files:**
- Create: `lib/admin/acceso.ts`
- Test: `tests/unit/acceso.test.ts`, `tests/integration/actorActual.test.ts`

**Interfaces:**
- Consumes: `sesionActiva` de Task 1, `leerCookie`/`NOMBRE_COOKIE` de `lib/auth/sesion.ts`.
- Produces: `type Rol = "operador" | "supervisor" | "admin"`; `ROLES: readonly Rol[]`; `esRol(v: string): v is Rol`; `puedeVerCatalogo(rol: Rol): boolean`; `puedeEditarCatalogo(rol: Rol): boolean`; `interface Actor { empleadoId: string; nombre: string; rol: Rol }`; `actorActual(): Promise<Actor | null>`.

- [ ] **Step 1: Escribir el test unitario que falla**

Crear `tests/unit/acceso.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { esRol, puedeVerCatalogo, puedeEditarCatalogo, ROLES } from "@/lib/admin/acceso"

describe("vocabulario de roles", () => {
  it("son exactamente tres", () => {
    expect([...ROLES]).toEqual(["operador", "supervisor", "admin"])
  })

  it("reconoce los válidos", () => {
    expect(esRol("admin")).toBe(true)
    expect(esRol("supervisor")).toBe(true)
    expect(esRol("operador")).toBe(true)
  })

  // El script de importacion escribe "operador" en minuscula. Cualquier otra
  // cosa en la columna es dato corrupto y no debe habilitar nada.
  it("rechaza cualquier otra cosa", () => {
    expect(esRol("Admin")).toBe(false)
    expect(esRol("root")).toBe(false)
    expect(esRol("")).toBe(false)
  })
})

describe("qué habilita cada rol", () => {
  it("admin ve y edita", () => {
    expect(puedeVerCatalogo("admin")).toBe(true)
    expect(puedeEditarCatalogo("admin")).toBe(true)
  })

  // El rol existe con significado real desde SP4a en vez de ser una etiqueta
  // que no habilita nada hasta SP4c.
  it("supervisor ve pero no edita", () => {
    expect(puedeVerCatalogo("supervisor")).toBe(true)
    expect(puedeEditarCatalogo("supervisor")).toBe(false)
  })

  it("operador no entra", () => {
    expect(puedeVerCatalogo("operador")).toBe(false)
    expect(puedeEditarCatalogo("operador")).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm run test:unit -- tests/unit/acceso.test.ts`
Expected: FAIL — no existe `@/lib/admin/acceso`.

- [ ] **Step 3: Escribir `lib/admin/acceso.ts`**

```ts
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { leerCookie, NOMBRE_COOKIE, sesionActiva } from "@/lib/auth/sesion"

export type Rol = "operador" | "supervisor" | "admin"

export const ROLES = ["operador", "supervisor", "admin"] as const

export function esRol(v: string): v is Rol {
  return (ROLES as readonly string[]).includes(v)
}

export function puedeVerCatalogo(rol: Rol): boolean {
  return rol === "admin" || rol === "supervisor"
}

export function puedeEditarCatalogo(rol: Rol): boolean {
  return rol === "admin"
}

export interface Actor {
  empleadoId: string
  nombre: string
  rol: Rol
}

/**
 * Quien esta pidiendo, resuelto desde la cookie firmada. Devuelve null ante
 * cualquier duda —sin cookie, sesion cerrada, empleado inactivo, rol que no
 * esta en el vocabulario— porque en control de acceso la ausencia de prueba
 * es prueba de ausencia.
 */
export async function actorActual(): Promise<Actor | null> {
  const tarro = await cookies()
  const sesionId = leerCookie(tarro.get(NOMBRE_COOKIE)?.value)
  if (!sesionId) return null

  const sesion = await sesionActiva(sesionId)
  if (!sesion) return null

  const empleado = await prisma.empleado.findUnique({
    where: { id: sesion.empleadoId },
  })
  if (!empleado || !empleado.activo || !esRol(empleado.rol)) return null

  return { empleadoId: empleado.id, nombre: empleado.nombre, rol: empleado.rol }
}
```

- [ ] **Step 4: Correr el test unitario**

Run: `npm run test:unit -- tests/unit/acceso.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Escribir el test de integración de `actorActual`**

Crear `tests/integration/actorActual.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { abrirSesion, firmarCookie, NOMBRE_COOKIE } from "@/lib/auth/sesion"

const tarro = { get: vi.fn() }
vi.mock("next/headers", () => ({ cookies: async () => tarro }))

const { actorActual } = await import("@/lib/admin/acceso")

async function empleado(rol: string, activo = true) {
  return prisma.empleado.upsert({
    where: { dniInstitucional: `actor-${rol}-${activo}` },
    update: { rol, activo },
    create: { dniInstitucional: `actor-${rol}-${activo}`, nombre: "Prueba", rol, activo },
  })
}

async function sesionDe(rol: string, activo = true) {
  const e = await empleado(rol, activo)
  const r = await abrirSesion(e.id, null)
  if (!r.ok) throw new Error("no abrió")
  return r.sesionId
}

describe("actorActual", () => {
  beforeEach(async () => {
    tarro.get.mockReset()
    await prisma.sesionOperador.deleteMany()
  })
  afterAll(async () => {
    await prisma.sesionOperador.deleteMany()
    await prisma.$disconnect()
  })

  it("resuelve el rol desde la cookie firmada", async () => {
    const id = await sesionDe("admin")
    tarro.get.mockReturnValue({ value: firmarCookie(id) })
    expect((await actorActual())?.rol).toBe("admin")
  })

  it("sin cookie no hay actor", async () => {
    tarro.get.mockReturnValue(undefined)
    expect(await actorActual()).toBeNull()
  })

  // Una cookie con la firma cambiada es exactamente el ataque que el HMAC
  // existe para frenar.
  it("una cookie con firma inválida no vale", async () => {
    const id = await sesionDe("admin")
    tarro.get.mockReturnValue({ value: `${id}.firmafalsa` })
    expect(await actorActual()).toBeNull()
  })

  it("un empleado dado de baja no es actor aunque tenga sesión", async () => {
    const id = await sesionDe("admin", false)
    tarro.get.mockReturnValue({ value: firmarCookie(id) })
    expect(await actorActual()).toBeNull()
  })

  it("un rol fuera del vocabulario no es actor", async () => {
    const id = await sesionDe("root")
    tarro.get.mockReturnValue({ value: firmarCookie(id) })
    expect(await actorActual()).toBeNull()
  })
})
```

- [ ] **Step 6: Correr el test de integración**

Run: `npm run test:integration -- tests/integration/actorActual.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/admin/acceso.ts tests/unit/acceso.test.ts tests/integration/actorActual.test.ts
git commit -m "feat(sp4a): vocabulario de roles y resolucion del actor"
```

---

## Task 3: Login con rol y sesión de panel

**Files:**
- Modify: `lib/auth/operador.ts:5-17,21-63,66-76`
- Modify: `app/api/auth/boxes/route.ts:19-27`
- Modify: `app/api/auth/login/route.ts:6-21`
- Modify: `app/operador/login/page.tsx`
- Test: `tests/integration/loginAdmin.test.ts`

**Interfaces:**
- Consumes: `abrirSesion(empleadoId, boxId: string | null)` de Task 1; `esRol`, `type Rol` de Task 2.
- Produces: `login(nombreUsuario, clave, boxId: string | null, consulta?)` con `ResultadoLogin` que incluye `rol: Rol` y `boxId: string | null`; `accesoDe(documento): Promise<{ boxes: {id,nombre}[]; rol: Rol | null }>`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/loginAdmin.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { login, accesoDe } from "@/lib/auth/operador"
import type { FilaUsuario } from "@/lib/auth/institucional"

const DOC = "90000001"

// La consulta institucional se inyecta: el test nunca toca la base de la
// obra social ni manipula claves reales.
const consultaOk = async (): Promise<FilaUsuario[]> => [
  {
    documento: DOC,
    nombreUsuario: "admin.prueba",
    claveUsuario: "$2a$10$abcdefghijklmnopqrstuv",
    apellido: "Prueba",
    nombre: "Admin",
    esAfiliado: 0,
  } as FilaUsuario,
]

async function sembrarEmpleado(rol: string) {
  return prisma.empleado.upsert({
    where: { dniInstitucional: DOC },
    update: { rol, activo: true },
    create: { dniInstitucional: DOC, nombre: "Admin Prueba", rol, activo: true },
  })
}

describe("login del panel", () => {
  beforeEach(async () => {
    await prisma.sesionOperador.deleteMany()
  })
  afterAll(async () => {
    await prisma.sesionOperador.deleteMany()
    await prisma.empleado.deleteMany({ where: { dniInstitucional: DOC } })
    await prisma.$disconnect()
  })

  it("accesoDe devuelve el rol junto con los boxes", async () => {
    await sembrarEmpleado("admin")
    const a = await accesoDe(DOC)
    expect(a.rol).toBe("admin")
    expect(Array.isArray(a.boxes)).toBe(true)
  })

  it("accesoDe devuelve rol nulo para quien no está en el turnero", async () => {
    const a = await accesoDe("00000000")
    expect(a.rol).toBeNull()
    expect(a.boxes).toEqual([])
  })
})
```

Nota para quien implemente: `login()` con clave real no se puede probar en integración sin la base de la obra social. La prueba de `login` con `boxId` nulo se cubre por el camino de `abrirSesion` ya probado en Task 1; acá se prueba `accesoDe`, que es lo nuevo y no depende de credenciales.

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm run test:integration -- tests/integration/loginAdmin.test.ts`
Expected: FAIL — `accesoDe` no está exportada.

- [ ] **Step 3: Reescribir `lib/auth/operador.ts`**

Reemplazar el tipo `ResultadoLogin`, la función `login` y `boxesDe`:

```ts
import { prisma } from "@/lib/db"
import { verificarCredencial, type FilaUsuario } from "./institucional"
import { abrirSesion } from "./sesion"
import { esRol, type Rol } from "@/lib/admin/acceso"

export type ResultadoLogin =
  | {
      ok: true
      sesionId: string
      empleado: { id: string; nombre: string }
      boxId: string | null
      rol: Rol
    }
  | {
      ok: false
      codigo:
        | "CREDENCIAL_INVALIDA"
        | "NO_HABILITADO"
        | "BOX_OCUPADO"
        | "BOX_NO_ASIGNADO"
        | "SIN_PERMISO"
        | "ERROR_BASE"
      mensaje: string
      detalle?: string
    }

type Consulta = (nombreUsuario: string) => Promise<FilaUsuario[]>

export async function login(
  nombreUsuario: string,
  clave: string,
  boxId: string | null,
  consulta?: Consulta
): Promise<ResultadoLogin> {
  const credencial = await verificarCredencial(nombreUsuario, clave, consulta)
  if (!credencial.ok) {
    return {
      ok: false,
      codigo: credencial.codigo === "ERROR_BASE" ? "ERROR_BASE" : "CREDENCIAL_INVALIDA",
      mensaje: credencial.mensaje,
      detalle: credencial.detalle,
    }
  }

  const empleado = await prisma.empleado.findUnique({
    where: { dniInstitucional: credencial.usuario.documento },
  })

  // Aca el mensaje es especifico: la credencial ya se valido, asi que no se
  // le esta confirmando nada a un desconocido, y le sirve a una persona
  // legitima para saber que tiene que pedir el alta.
  if (!empleado || !empleado.activo) {
    return {
      ok: false,
      codigo: "NO_HABILITADO",
      mensaje: "Tu usuario es válido pero no estás habilitado en el turnero",
    }
  }

  const rol: Rol = esRol(empleado.rol) ? empleado.rol : "operador"

  // Pedir sesion sin box es pedir entrar al panel. Que la credencial sea
  // valida no alcanza: el rol tiene que habilitarlo.
  if (boxId === null && rol === "operador") {
    return {
      ok: false,
      codigo: "SIN_PERMISO",
      mensaje: "Tu usuario no tiene acceso al panel de administración",
    }
  }

  const sesion = await abrirSesion(empleado.id, boxId)
  if (!sesion.ok) {
    return { ok: false, codigo: sesion.codigo, mensaje: sesion.mensaje, detalle: sesion.detalle }
  }

  return {
    ok: true,
    sesionId: sesion.sesionId,
    empleado: { id: empleado.id, nombre: empleado.nombre },
    boxId,
    rol,
  }
}

/** Los boxes asignados y el rol, para que el login sepa qué opciones ofrecer. */
export async function accesoDe(
  documento: string
): Promise<{ boxes: { id: string; nombre: string }[]; rol: Rol | null }> {
  const empleado = await prisma.empleado.findUnique({
    where: { dniInstitucional: documento },
    include: { boxes: { include: { box: { include: { ala: true } } } } },
  })
  if (!empleado || !empleado.activo) return { boxes: [], rol: null }

  return {
    boxes: empleado.boxes.map((eb) => ({
      id: eb.box.id,
      nombre: `${eb.box.nombre} — Ala ${eb.box.ala.nombre}`,
    })),
    rol: esRol(empleado.rol) ? empleado.rol : null,
  }
}
```

- [ ] **Step 4: Correr el test**

Run: `npm run test:integration -- tests/integration/loginAdmin.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Actualizar `app/api/auth/boxes/route.ts`**

Reemplazar de la línea 19 al final:

```ts
import { NextResponse } from "next/server"
import { verificarCredencial } from "@/lib/auth/institucional"
import { accesoDe } from "@/lib/auth/operador"
import { puedeVerCatalogo } from "@/lib/admin/acceso"

export async function POST(req: Request) {
  const { usuario, clave } = await req.json()
  if (!usuario || !clave) {
    return NextResponse.json({ ok: false, mensaje: "Faltan datos" }, { status: 400 })
  }

  const credencial = await verificarCredencial(usuario, clave)
  if (!credencial.ok) {
    return NextResponse.json(
      { ok: false, mensaje: credencial.mensaje },
      { status: 401 }
    )
  }

  const { boxes, rol } = await accesoDe(credencial.usuario.documento)
  const panel = rol !== null && puedeVerCatalogo(rol)

  // Sin boxes y sin panel no hay nada que ofrecerle.
  if (boxes.length === 0 && !panel) {
    return NextResponse.json(
      { ok: false, mensaje: "Tu usuario es válido pero no estás habilitado en el turnero" },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true, boxes, panel })
}
```

- [ ] **Step 6: Actualizar `app/api/auth/login/route.ts`**

```ts
import { NextResponse } from "next/server"
import { login } from "@/lib/auth/operador"
import { firmarCookie, NOMBRE_COOKIE } from "@/lib/auth/sesion"

export async function POST(req: Request) {
  const { usuario, clave, boxId } = await req.json()

  // boxId null es explicito: es la sesion del panel. Undefined es un dato
  // que falta, y eso si es un error del cliente.
  if (!usuario || !clave || boxId === undefined) {
    return NextResponse.json({ ok: false, mensaje: "Faltan datos" }, { status: 400 })
  }

  const r = await login(usuario, clave, boxId)
  if (!r.ok) {
    return NextResponse.json({ ok: false, codigo: r.codigo, mensaje: r.mensaje }, { status: 401 })
  }

  const res = NextResponse.json({
    ok: true,
    empleado: r.empleado,
    boxId: r.boxId,
    rol: r.rol,
  })
  res.cookies.set(NOMBRE_COOKIE, firmarCookie(r.sesionId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // secure queda en false a proposito: el totem y los mostradores acceden
    // por HTTP en la red interna, y con secure la cookie no viajaria.
    secure: false,
  })
  return res
}
```

- [ ] **Step 7: Actualizar la pantalla de login**

Reemplazar `app/operador/login/page.tsx` completo:

```tsx
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
      router.push(destino === PANEL ? "/admin" : "/operador")
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
      <h1 className="mb-8 font-titulo text-3xl font-semibold">Turnero</h1>

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
```

- [ ] **Step 8: Verificar tipos y suite completa**

Run: `npx tsc --noEmit`
Expected: sin errores. Si algún test o E2E usaba `boxesDe`, cambiarlo por `accesoDe(...).boxes`.

Run: `npm test`
Expected: todo pasa.

- [ ] **Step 9: Commit**

```bash
git add lib/auth/operador.ts app/api/auth app/operador/login/page.tsx tests/integration/loginAdmin.test.ts
git commit -m "feat(sp4a): login devuelve rol y permite sesion de panel sin box"
```

---

## Task 4: Validaciones puras del catálogo

**Files:**
- Create: `lib/admin/validaciones.ts`
- Test: `tests/unit/validaciones.test.ts`

**Interfaces:**
- Consumes: `NOMBRES_DE_ICONO` de `lib/kiosco/iconos.ts`.
- Produces: `interface ErrorCampo { campo: string; mensaje: string }`; `validarNombre(campo: string, v: string): ErrorCampo | null`; `validarFranja(apertura: string, cierre: string): ErrorCampo | null`; `validarDiasSemana(v: string): ErrorCampo | null`; `validarIcono(v: string): ErrorCampo | null`; `validarPrefijo(v: string, tomados: string[]): ErrorCampo | null`; `validarEntero(campo: string, v: number, minimo: number): ErrorCampo | null`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/validaciones.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  validarNombre,
  validarFranja,
  validarDiasSemana,
  validarIcono,
  validarPrefijo,
  validarEntero,
} from "@/lib/admin/validaciones"

describe("validarNombre", () => {
  it("acepta un nombre normal", () => {
    expect(validarNombre("nombre", "Prótesis")).toBeNull()
  })

  it("rechaza vacío y sólo espacios", () => {
    expect(validarNombre("nombre", "")?.campo).toBe("nombre")
    expect(validarNombre("nombre", "   ")?.campo).toBe("nombre")
  })
})

describe("validarFranja", () => {
  it("acepta una franja normal", () => {
    expect(validarFranja("08:00", "14:00")).toBeNull()
  })

  it("acepta los bordes del día", () => {
    expect(validarFranja("00:00", "23:59")).toBeNull()
  })

  it("rechaza formatos que no son HH:MM", () => {
    expect(validarFranja("8:00", "14:00")).not.toBeNull()
    expect(validarFranja("08:00", "24:00")).not.toBeNull()
    expect(validarFranja("08:60", "14:00")).not.toBeNull()
    expect(validarFranja("0800", "1400")).not.toBeNull()
  })

  // Una franja invertida deja el tramite disponible nunca, sin decirlo.
  it("rechaza cierre anterior o igual a apertura", () => {
    expect(validarFranja("14:00", "08:00")).not.toBeNull()
    expect(validarFranja("08:00", "08:00")).not.toBeNull()
  })
})

describe("validarDiasSemana", () => {
  it("acepta lunes a viernes", () => {
    expect(validarDiasSemana("12345")).toBeNull()
  })

  it("acepta la semana completa", () => {
    expect(validarDiasSemana("0123456")).toBeNull()
  })

  it("rechaza vacío", () => {
    expect(validarDiasSemana("")).not.toBeNull()
  })

  it("rechaza dígitos fuera de 0-6", () => {
    expect(validarDiasSemana("1237")).not.toBeNull()
    expect(validarDiasSemana("12a")).not.toBeNull()
  })

  // disponibilidad.ts usa includes(dia): un dia repetido no rompe, pero
  // delata un error de carga que conviene frenar acá.
  it("rechaza repetidos", () => {
    expect(validarDiasSemana("1223")).not.toBeNull()
  })
})

describe("validarIcono", () => {
  it("acepta uno del mapa", () => {
    expect(validarIcono("Stethoscope")).toBeNull()
  })

  // iconoPorNombre cae a FileQuestion sin avisar: sin esta validacion, un
  // icono mal tipeado se ve como un signo de pregunta en el totem.
  it("rechaza uno que no existe", () => {
    expect(validarIcono("Corazon")).not.toBeNull()
    expect(validarIcono("")).not.toBeNull()
  })
})

describe("validarPrefijo", () => {
  it("acepta uno libre", () => {
    expect(validarPrefijo("PRO", ["TOM", "MAT"])).toBeNull()
  })

  it("acepta de una a tres letras", () => {
    expect(validarPrefijo("P", [])).toBeNull()
    expect(validarPrefijo("PRO", [])).toBeNull()
  })

  it("rechaza más de tres, vacío y no alfabético", () => {
    expect(validarPrefijo("PROT", [])).not.toBeNull()
    expect(validarPrefijo("", [])).not.toBeNull()
    expect(validarPrefijo("P1", [])).not.toBeNull()
  })

  it("exige mayúsculas", () => {
    expect(validarPrefijo("pro", [])).not.toBeNull()
  })

  // Dos tramites con prefijo P generan dos P01 el mismo dia: dos personas
  // con el mismo numero esperando el mismo llamado.
  it("rechaza uno ya tomado", () => {
    const e = validarPrefijo("TOM", ["TOM", "MAT"])
    expect(e).not.toBeNull()
    expect(e?.campo).toBe("prefijo")
  })
})

describe("validarEntero", () => {
  it("acepta un valor válido", () => {
    expect(validarEntero("orden", 3, 0)).toBeNull()
  })

  it("rechaza por debajo del mínimo", () => {
    expect(validarEntero("orden", -1, 0)).not.toBeNull()
  })

  it("rechaza NaN y no enteros", () => {
    expect(validarEntero("orden", Number.NaN, 0)).not.toBeNull()
    expect(validarEntero("orden", 1.5, 0)).not.toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm run test:unit -- tests/unit/validaciones.test.ts`
Expected: FAIL — no existe `@/lib/admin/validaciones`.

- [ ] **Step 3: Escribir `lib/admin/validaciones.ts`**

```ts
import { NOMBRES_DE_ICONO } from "@/lib/kiosco/iconos"

export interface ErrorCampo {
  campo: string
  mensaje: string
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const PREFIJO = /^[A-Z]{1,3}$/

export function validarNombre(campo: string, v: string): ErrorCampo | null {
  if (v.trim() === "") return { campo, mensaje: "No puede estar vacío" }
  return null
}

export function validarEntero(
  campo: string,
  v: number,
  minimo: number
): ErrorCampo | null {
  if (!Number.isInteger(v)) return { campo, mensaje: "Tiene que ser un número entero" }
  if (v < minimo) return { campo, mensaje: `Tiene que ser ${minimo} o más` }
  return null
}

/**
 * Una franja invertida no rompe nada visible: deja el tramite disponible
 * nunca, en silencio. Por eso se frena en la carga.
 */
export function validarFranja(apertura: string, cierre: string): ErrorCampo | null {
  if (!HORA.test(apertura)) {
    return { campo: "horaApertura", mensaje: "Tiene que ser HH:MM, por ejemplo 08:00" }
  }
  if (!HORA.test(cierre)) {
    return { campo: "horaCierre", mensaje: "Tiene que ser HH:MM, por ejemplo 14:00" }
  }
  if (apertura >= cierre) {
    return { campo: "horaCierre", mensaje: "El cierre tiene que ser posterior a la apertura" }
  }
  return null
}

/**
 * Un conjunto de digitos 0-6, no una mascara de bits: disponibilidad.ts lo
 * consume con diasSemana.includes(dia).
 */
export function validarDiasSemana(v: string): ErrorCampo | null {
  if (v === "") return { campo: "diasSemana", mensaje: "Elegí al menos un día" }
  if (!/^[0-6]+$/.test(v)) {
    return { campo: "diasSemana", mensaje: "Sólo dígitos del 0 al 6" }
  }
  if (new Set(v).size !== v.length) {
    return { campo: "diasSemana", mensaje: "Hay días repetidos" }
  }
  return null
}

/**
 * iconoPorNombre cae a FileQuestion ante un nombre desconocido, sin avisar.
 * Sin esta validacion, un icono mal tipeado llega al totem como un signo de
 * pregunta y nadie se entera hasta que alguien lo ve.
 */
export function validarIcono(v: string): ErrorCampo | null {
  if (!NOMBRES_DE_ICONO.includes(v)) {
    return { campo: "icono", mensaje: "Elegí un icono de la lista" }
  }
  return null
}

/**
 * El numero del turno es prefijo + contador, y Contador es por tramite. Dos
 * tramites con el mismo prefijo generan dos P01 distintos el mismo dia: dos
 * personas con el mismo numero esperando el mismo llamado.
 */
export function validarPrefijo(v: string, tomados: string[]): ErrorCampo | null {
  if (!PREFIJO.test(v)) {
    return { campo: "prefijo", mensaje: "Una a tres letras mayúsculas" }
  }
  if (tomados.includes(v)) {
    return { campo: "prefijo", mensaje: "Ya lo usa otro trámite activo" }
  }
  return null
}
```

- [ ] **Step 4: Correr el test**

Run: `npm run test:unit -- tests/unit/validaciones.test.ts`
Expected: PASS, 20 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/validaciones.ts tests/unit/validaciones.test.ts
git commit -m "feat(sp4a): validaciones puras del catalogo"
```

---

## Task 5: Referencias y borrado seguro

**Files:**
- Create: `lib/admin/referencias.ts`
- Test: `tests/unit/referencias.test.ts`, `tests/integration/referencias.test.ts`

**Interfaces:**
- Consumes: `prisma` de `lib/db`.
- Produces: `type Entidad = "sede" | "ala" | "piso" | "box" | "categoria" | "tramite"`; `type Referencias = Record<string, number>`; `sePuedeBorrar(refs: Referencias): boolean`; `contarReferencias(entidad: Entidad, id: string): Promise<Referencias>`.

- [ ] **Step 1: Escribir el test unitario que falla**

Crear `tests/unit/referencias.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { sePuedeBorrar } from "@/lib/admin/referencias"

describe("sePuedeBorrar", () => {
  it("sin referencias, se puede", () => {
    expect(sePuedeBorrar({ turnos: 0, contadores: 0 })).toBe(true)
  })

  it("sin ninguna clave, se puede", () => {
    expect(sePuedeBorrar({})).toBe(true)
  })

  it("una sola referencia alcanza para bloquear", () => {
    expect(sePuedeBorrar({ turnos: 1, contadores: 0 })).toBe(false)
  })

  it("bloquea aunque la referencia esté en la última clave", () => {
    expect(sePuedeBorrar({ turnos: 0, eventos: 0, sesiones: 3 })).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm run test:unit -- tests/unit/referencias.test.ts`
Expected: FAIL — no existe `@/lib/admin/referencias`.

- [ ] **Step 3: Escribir `lib/admin/referencias.ts`**

```ts
import { prisma } from "@/lib/db"

export type Entidad = "sede" | "ala" | "piso" | "box" | "categoria" | "tramite"

export type Referencias = Record<string, number>

export function sePuedeBorrar(refs: Referencias): boolean {
  return Object.values(refs).every((n) => n === 0)
}

/**
 * Cuenta lo que quedaria huerfano. Se llama en el momento de borrar, no solo
 * al decidir si se pinta el boton: entre que la pagina se renderizo y que
 * alguien apreto pueden haber entrado turnos.
 */
export async function contarReferencias(
  entidad: Entidad,
  id: string
): Promise<Referencias> {
  switch (entidad) {
    case "tramite":
      return {
        turnos: await prisma.turno.count({ where: { tramiteId: id } }),
        contadores: await prisma.contador.count({ where: { tramiteId: id } }),
        boxes: await prisma.boxTramite.count({ where: { tramiteId: id } }),
      }
    case "box":
      return {
        turnos: await prisma.turno.count({ where: { boxId: id } }),
        eventos: await prisma.turnoEvento.count({ where: { boxId: id } }),
        sesiones: await prisma.sesionOperador.count({ where: { boxId: id } }),
        empleados: await prisma.empleadoBox.count({ where: { boxId: id } }),
        tramites: await prisma.boxTramite.count({ where: { boxId: id } }),
      }
    case "categoria":
      return {
        tramites: await prisma.tramite.count({ where: { categoriaId: id } }),
      }
    case "ala":
      return {
        boxes: await prisma.box.count({ where: { alaId: id } }),
        tramites: await prisma.tramite.count({ where: { destinoAlaId: id } }),
      }
    case "piso":
      return {
        boxes: await prisma.box.count({ where: { pisoId: id } }),
        tramites: await prisma.tramite.count({ where: { destinoPisoId: id } }),
      }
    case "sede":
      return {
        alas: await prisma.ala.count({ where: { sedeId: id } }),
        pisos: await prisma.piso.count({ where: { sedeId: id } }),
      }
  }
}
```

- [ ] **Step 4: Correr el test unitario**

Run: `npm run test:unit -- tests/unit/referencias.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Escribir el test de integración**

Crear `tests/integration/referencias.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { contarReferencias, sePuedeBorrar } from "@/lib/admin/referencias"

function hoyFecha(): Date {
  const a = new Date()
  return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()))
}

describe("contarReferencias", () => {
  afterAll(async () => {
    await prisma.turno.deleteMany({ where: { requestId: { startsWith: "ref-" } } })
    await prisma.$disconnect()
  })

  it("una categoría recién creada se puede borrar", async () => {
    const c = await prisma.categoria.create({
      data: { nombre: "Temporal", icono: "Activity", orden: 99 },
    })
    expect(sePuedeBorrar(await contarReferencias("categoria", c.id))).toBe(true)
    await prisma.categoria.delete({ where: { id: c.id } })
  })

  it("una categoría con trámites no se puede borrar", async () => {
    const t = await prisma.tramite.findFirstOrThrow()
    const refs = await contarReferencias("categoria", t.categoriaId)
    expect(refs.tramites).toBeGreaterThan(0)
    expect(sePuedeBorrar(refs)).toBe(false)
  })

  // El caso que motiva toda la regla: un tramite con un solo turno de hace
  // dos años sigue siendo la unica forma de resolver el nombre de ese turno.
  it("un trámite con un turno queda bloqueado", async () => {
    const t = await prisma.tramite.findFirstOrThrow()
    await prisma.turno.create({
      data: {
        numero: "REF01",
        fecha: hoyFecha(),
        tramiteId: t.id,
        estado: "finalizado",
        requestId: `ref-${Date.now()}`,
      },
    })
    const refs = await contarReferencias("tramite", t.id)
    expect(refs.turnos).toBeGreaterThan(0)
    expect(sePuedeBorrar(refs)).toBe(false)
  })

  it("un ala con boxes no se puede borrar", async () => {
    const b = await prisma.box.findFirstOrThrow()
    const refs = await contarReferencias("ala", b.alaId)
    expect(refs.boxes).toBeGreaterThan(0)
    expect(sePuedeBorrar(refs)).toBe(false)
  })
})
```

- [ ] **Step 6: Correr el test de integración**

Run: `npm run test:integration -- tests/integration/referencias.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/admin/referencias.ts tests/unit/referencias.test.ts tests/integration/referencias.test.ts
git commit -m "feat(sp4a): conteo de referencias y regla de borrado seguro"
```

---

## Task 6: Singleton de io y emisión desde HTTP

**Files:**
- Create: `server/io.ts`
- Modify: `server.ts:14-20`
- Test: `tests/unit/io.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `registrarIo(io: IoServer): void`; `emitirATodos(evento: string, datos: unknown): void`; `reiniciarIo(): void` (sólo para tests).

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/io.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Server as IoServer } from "socket.io"
import { registrarIo, emitirATodos, reiniciarIo } from "@/server/io"

describe("singleton de io", () => {
  beforeEach(reiniciarIo)

  it("emite a todos una vez registrado", () => {
    const emit = vi.fn()
    registrarIo({ emit } as unknown as IoServer)

    emitirATodos("CATALOGO_ACTUALIZADO", {})
    expect(emit).toHaveBeenCalledWith("CATALOGO_ACTUALIZADO", {})
  })

  // next build y los tests corren sin servidor de sockets. Si emitir
  // explotara ahi, una mutacion correcta fallaria por no poder avisar.
  it("sin io registrado no explota", () => {
    expect(() => emitirATodos("CATALOGO_ACTUALIZADO", {})).not.toThrow()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm run test:unit -- tests/unit/io.test.ts`
Expected: FAIL — no existe `@/server/io`.

- [ ] **Step 3: Escribir `server/io.ts`**

```ts
import type { Server as IoServer } from "socket.io"

/**
 * io se crea en server.ts y se le pasa por argumento a montarTurnero, asi que
 * una ruta HTTP o un Server Action no tienen forma de alcanzarlo. Este
 * singleton es ese puente, y es lo que permite que una mutacion del panel
 * avise a los kioscos.
 */
let instancia: IoServer | null = null

export function registrarIo(io: IoServer): void {
  instancia = io
}

export function reiniciarIo(): void {
  instancia = null
}

/**
 * No lanza si todavia no hay io: durante next build y en los tests no hay
 * servidor de sockets, y una mutacion correcta no puede fallar por no poder
 * avisar. El aviso acelera la propagacion; la correctitud la sostiene la
 * invalidacion del cache.
 */
export function emitirATodos(evento: string, datos: unknown): void {
  instancia?.emit(evento, datos)
}
```

- [ ] **Step 4: Correr el test**

Run: `npm run test:unit -- tests/unit/io.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Registrar io al arrancar**

En `server.ts`, importar y llamar antes de `montarTurnero`:

```ts
import { createServer } from "http"
import { Server } from "socket.io"
import next from "next"
import { montarTurnero } from "./server/index"
import { registrarIo } from "./server/io"
import { programarJobs } from "./server/jobs/programador"

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOSTNAME ?? "localhost"
const port = Number(process.env.PORT ?? 3000)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res))
  const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } })

  registrarIo(io)
  montarTurnero(io)
  programarJobs()

  httpServer.listen(port, () => {
    console.log(`Servidor listo en http://${hostname}:${port}`)
  })
})
```

- [ ] **Step 6: Verificar que el servidor arranca**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add server/io.ts server.ts tests/unit/io.test.ts
git commit -m "feat(sp4a): singleton de io para emitir desde codigo HTTP"
```

---

## Task 7: Mutaciones del catálogo

**Files:**
- Create: `lib/admin/mutaciones.ts`
- Test: `tests/integration/mutaciones.test.ts`

**Interfaces:**
- Consumes: `Actor`, `puedeEditarCatalogo` de Task 2; validaciones de Task 4; `contarReferencias`, `sePuedeBorrar`, `type Entidad` de Task 5; `emitirATodos` de Task 6; `invalidarCatalogo`, `obtenerCatalogo` de `lib/catalogo`.
- Produces: `type Resultado = { ok: true } | { ok: false; errores: ErrorCampo[] }`; `guardarTramite(actor, datos)`; `guardarBox(actor, datos)`; `guardarSimple(actor, entidad, datos)`; `cambiarActivo(actor, entidad, id, activo)`; `borrar(actor, entidad, id)`. Los tipos de `datos` se definen abajo.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/mutaciones.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { obtenerCatalogo, invalidarCatalogo } from "@/lib/catalogo"
import { guardarTramite, cambiarActivo, borrar } from "@/lib/admin/mutaciones"
import type { Actor } from "@/lib/admin/acceso"

const ADMIN: Actor = { empleadoId: "x", nombre: "Admin", rol: "admin" }
const SUPERVISOR: Actor = { empleadoId: "y", nombre: "Super", rol: "supervisor" }
const OPERADOR: Actor = { empleadoId: "z", nombre: "Opé", rol: "operador" }

async function datosBase() {
  const cat = await prisma.categoria.findFirstOrThrow()
  const ala = await prisma.ala.findFirstOrThrow()
  const piso = await prisma.piso.findFirstOrThrow()
  return {
    id: null as string | null,
    categoriaId: cat.id,
    nombre: "Trámite de prueba",
    subtitulo: "Sub",
    icono: "Activity",
    prefijo: "ZZZ",
    destinoAlaId: ala.id,
    destinoPisoId: piso.id,
    horaApertura: "08:00",
    horaCierre: "14:00",
    diasSemana: "12345",
    duracionMinimaEsperada: 5,
    orden: 90,
    boxIds: [] as string[],
  }
}

async function limpiar() {
  await prisma.boxTramite.deleteMany({ where: { tramite: { prefijo: "ZZZ" } } })
  await prisma.tramite.deleteMany({ where: { prefijo: "ZZZ" } })
}

describe("mutaciones del catálogo", () => {
  beforeEach(async () => {
    await limpiar()
    invalidarCatalogo()
  })
  afterAll(async () => {
    await limpiar()
    await prisma.$disconnect()
  })

  // ESTA ES LA PRUEBA QUE MAS IMPORTA. Un test que solo verifique que el
  // boton se ve deshabilitado pasaria igual con la autorizacion rota.
  it("un supervisor no puede escribir", async () => {
    const r = await guardarTramite(SUPERVISOR, await datosBase())
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("no debía dejarlo")
    expect(r.errores[0].campo).toBe("rol")
    expect(await prisma.tramite.count({ where: { prefijo: "ZZZ" } })).toBe(0)
  })

  it("un operador tampoco", async () => {
    const r = await guardarTramite(OPERADOR, await datosBase())
    expect(r.ok).toBe(false)
    expect(await prisma.tramite.count({ where: { prefijo: "ZZZ" } })).toBe(0)
  })

  it("un admin crea el trámite", async () => {
    const r = await guardarTramite(ADMIN, await datosBase())
    expect(r.ok).toBe(true)
    expect(await prisma.tramite.count({ where: { prefijo: "ZZZ" } })).toBe(1)
  })

  it("rechaza un prefijo ya tomado por otro trámite activo", async () => {
    const otro = await prisma.tramite.findFirstOrThrow({ where: { activo: true } })
    const datos = { ...(await datosBase()), prefijo: otro.prefijo }
    const r = await guardarTramite(ADMIN, datos)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("no debía dejarlo")
    expect(r.errores.some((e) => e.campo === "prefijo")).toBe(true)
  })

  it("rechaza una franja invertida", async () => {
    const datos = { ...(await datosBase()), horaApertura: "14:00", horaCierre: "08:00" }
    const r = await guardarTramite(ADMIN, datos)
    expect(r.ok).toBe(false)
  })

  it("guardar invalida el caché", async () => {
    const antes = await obtenerCatalogo()
    const cuantosAntes = antes.tramites.length

    const r = await guardarTramite(ADMIN, await datosBase())
    expect(r.ok).toBe(true)

    const despues = await obtenerCatalogo()
    expect(despues.tramites.length).toBe(cuantosAntes + 1)
  })

  it("la baja lógica saca el trámite del catálogo", async () => {
    await guardarTramite(ADMIN, await datosBase())
    const t = await prisma.tramite.findFirstOrThrow({ where: { prefijo: "ZZZ" } })

    const r = await cambiarActivo(ADMIN, "tramite", t.id, false)
    expect(r.ok).toBe(true)

    const cat = await obtenerCatalogo()
    expect(cat.tramites.some((x) => x.id === t.id)).toBe(false)
    // Pero la fila sigue: los turnos historicos resuelven su nombre.
    expect(await prisma.tramite.findUnique({ where: { id: t.id } })).not.toBeNull()
  })

  it("reactivar con el prefijo ya tomado se rechaza", async () => {
    await guardarTramite(ADMIN, await datosBase())
    const t = await prisma.tramite.findFirstOrThrow({ where: { prefijo: "ZZZ" } })
    await cambiarActivo(ADMIN, "tramite", t.id, false)

    // Otro tramite se queda con ZZZ mientras el primero esta de baja.
    const datos = { ...(await datosBase()), nombre: "Otro" }
    expect((await guardarTramite(ADMIN, datos)).ok).toBe(true)

    const r = await cambiarActivo(ADMIN, "tramite", t.id, true)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("no debía dejarlo")
    expect(r.errores.some((e) => e.campo === "prefijo")).toBe(true)
  })

  it("borra de verdad un trámite sin historia", async () => {
    await guardarTramite(ADMIN, await datosBase())
    const t = await prisma.tramite.findFirstOrThrow({ where: { prefijo: "ZZZ" } })

    const r = await borrar(ADMIN, "tramite", t.id)
    expect(r.ok).toBe(true)
    expect(await prisma.tramite.findUnique({ where: { id: t.id } })).toBeNull()
  })

  it("rechaza borrar un trámite con turnos", async () => {
    const conTurnos = await prisma.turno.findFirstOrThrow()
    const r = await borrar(ADMIN, "tramite", conTurnos.tramiteId)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("no debía dejarlo")
    expect(r.errores[0].campo).toBe("referencias")
  })

  it("un supervisor no puede borrar", async () => {
    await guardarTramite(ADMIN, await datosBase())
    const t = await prisma.tramite.findFirstOrThrow({ where: { prefijo: "ZZZ" } })

    const r = await borrar(SUPERVISOR, "tramite", t.id)
    expect(r.ok).toBe(false)
    expect(await prisma.tramite.findUnique({ where: { id: t.id } })).not.toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm run test:integration -- tests/integration/mutaciones.test.ts`
Expected: FAIL — no existe `@/lib/admin/mutaciones`.

- [ ] **Step 3: Escribir `lib/admin/mutaciones.ts`**

```ts
import { prisma } from "@/lib/db"
import { invalidarCatalogo } from "@/lib/catalogo"
import { emitirATodos } from "@/server/io"
import { puedeEditarCatalogo, type Actor } from "./acceso"
import {
  validarNombre,
  validarEntero,
  validarFranja,
  validarDiasSemana,
  validarIcono,
  validarPrefijo,
  type ErrorCampo,
} from "./validaciones"
import { contarReferencias, sePuedeBorrar, type Entidad } from "./referencias"

export type Resultado = { ok: true } | { ok: false; errores: ErrorCampo[] }

const SIN_PERMISO: ErrorCampo = {
  campo: "rol",
  mensaje: "Tu usuario no puede modificar el catálogo",
}

function fallo(...errores: (ErrorCampo | null)[]): Resultado | null {
  const reales = errores.filter((e): e is ErrorCampo => e !== null)
  return reales.length > 0 ? { ok: false, errores: reales } : null
}

/**
 * Invalidar va ANTES de emitir. Al reves, un cliente rapido podria pedir el
 * catalogo y recibir el cache viejo, quedandose vencido hasta el proximo
 * cambio.
 */
function propagar(): void {
  invalidarCatalogo()
  emitirATodos("CATALOGO_ACTUALIZADO", {})
}

export interface DatosTramite {
  id: string | null
  categoriaId: string
  nombre: string
  subtitulo: string
  icono: string
  prefijo: string
  destinoAlaId: string
  destinoPisoId: string
  horaApertura: string
  horaCierre: string
  diasSemana: string
  duracionMinimaEsperada: number
  orden: number
  boxIds: string[]
}

/** Los prefijos activos que no son el del tramite que se esta editando. */
async function prefijosTomados(excluirId: string | null): Promise<string[]> {
  const otros = await prisma.tramite.findMany({
    where: { activo: true, ...(excluirId ? { id: { not: excluirId } } : {}) },
    select: { prefijo: true },
  })
  return otros.map((t) => t.prefijo)
}

export async function guardarTramite(
  actor: Actor,
  d: DatosTramite
): Promise<Resultado> {
  if (!puedeEditarCatalogo(actor.rol)) return { ok: false, errores: [SIN_PERMISO] }

  const malo = fallo(
    validarNombre("nombre", d.nombre),
    validarNombre("subtitulo", d.subtitulo),
    validarIcono(d.icono),
    validarPrefijo(d.prefijo, await prefijosTomados(d.id)),
    validarFranja(d.horaApertura, d.horaCierre),
    validarDiasSemana(d.diasSemana),
    validarEntero("duracionMinimaEsperada", d.duracionMinimaEsperada, 0),
    validarEntero("orden", d.orden, 0)
  )
  if (malo) return malo

  const campos = {
    categoriaId: d.categoriaId,
    nombre: d.nombre.trim(),
    subtitulo: d.subtitulo.trim(),
    icono: d.icono,
    prefijo: d.prefijo,
    destinoAlaId: d.destinoAlaId,
    destinoPisoId: d.destinoPisoId,
    horaApertura: d.horaApertura,
    horaCierre: d.horaCierre,
    diasSemana: d.diasSemana,
    duracionMinimaEsperada: d.duracionMinimaEsperada,
    orden: d.orden,
  }

  const id = d.id
    ? (await prisma.tramite.update({ where: { id: d.id }, data: campos })).id
    : (await prisma.tramite.create({ data: { ...campos, activo: true } })).id

  // La asignacion se reemplaza entera: es mas simple que diferenciar y el
  // volumen es de decenas de filas.
  await prisma.boxTramite.deleteMany({ where: { tramiteId: id } })
  if (d.boxIds.length > 0) {
    await prisma.boxTramite.createMany({
      data: d.boxIds.map((boxId) => ({ boxId, tramiteId: id })),
    })
  }

  propagar()
  return { ok: true }
}

export interface DatosBox {
  id: string | null
  alaId: string
  pisoId: string
  numero: number
  nombre: string
  horaApertura: string
  horaCierre: string
  diasSemana: string
  tramiteIds: string[]
}

export async function guardarBox(actor: Actor, d: DatosBox): Promise<Resultado> {
  if (!puedeEditarCatalogo(actor.rol)) return { ok: false, errores: [SIN_PERMISO] }

  const malo = fallo(
    validarNombre("nombre", d.nombre),
    validarEntero("numero", d.numero, 1),
    validarFranja(d.horaApertura, d.horaCierre),
    validarDiasSemana(d.diasSemana)
  )
  if (malo) return malo

  // @@unique([alaId, numero]) lo garantiza en la base, pero el mensaje de
  // Prisma no es legible para quien carga.
  const choca = await prisma.box.findFirst({
    where: { alaId: d.alaId, numero: d.numero, ...(d.id ? { id: { not: d.id } } : {}) },
  })
  if (choca) {
    return {
      ok: false,
      errores: [{ campo: "numero", mensaje: "Ya hay un box con ese número en el ala" }],
    }
  }

  const campos = {
    alaId: d.alaId,
    pisoId: d.pisoId,
    numero: d.numero,
    nombre: d.nombre.trim(),
    horaApertura: d.horaApertura,
    horaCierre: d.horaCierre,
    diasSemana: d.diasSemana,
  }

  const id = d.id
    ? (await prisma.box.update({ where: { id: d.id }, data: campos })).id
    : (await prisma.box.create({ data: { ...campos, activo: true } })).id

  await prisma.boxTramite.deleteMany({ where: { boxId: id } })
  if (d.tramiteIds.length > 0) {
    await prisma.boxTramite.createMany({
      data: d.tramiteIds.map((tramiteId) => ({ boxId: id, tramiteId })),
    })
  }

  propagar()
  return { ok: true }
}

export type EntidadSimple = "sede" | "ala" | "piso" | "categoria"

export interface DatosSimple {
  id: string | null
  nombre: string
  /** orden en Ala y Categoria, nivel en Piso. Sede lo ignora. */
  posicion: number
  /** Sede no lo usa; Ala y Piso lo necesitan. */
  sedeId?: string
  /** Categoria lo necesita. */
  icono?: string
}

export async function guardarSimple(
  actor: Actor,
  entidad: EntidadSimple,
  d: DatosSimple
): Promise<Resultado> {
  if (!puedeEditarCatalogo(actor.rol)) return { ok: false, errores: [SIN_PERMISO] }

  const malo = fallo(
    validarNombre("nombre", d.nombre),
    entidad === "sede" ? null : validarEntero("posicion", d.posicion, 0),
    entidad === "categoria" ? validarIcono(d.icono ?? "") : null
  )
  if (malo) return malo

  const nombre = d.nombre.trim()

  switch (entidad) {
    case "sede":
      d.id
        ? await prisma.sede.update({ where: { id: d.id }, data: { nombre } })
        : await prisma.sede.create({ data: { nombre, activa: true } })
      break
    case "ala": {
      const datos = { nombre, orden: d.posicion, sedeId: d.sedeId! }
      d.id
        ? await prisma.ala.update({ where: { id: d.id }, data: datos })
        : await prisma.ala.create({ data: { ...datos, activa: true } })
      break
    }
    case "piso": {
      const datos = { nombre, nivel: d.posicion, sedeId: d.sedeId! }
      d.id
        ? await prisma.piso.update({ where: { id: d.id }, data: datos })
        : await prisma.piso.create({ data: { ...datos, activa: true } })
      break
    }
    case "categoria": {
      const datos = { nombre, orden: d.posicion, icono: d.icono! }
      d.id
        ? await prisma.categoria.update({ where: { id: d.id }, data: datos })
        : await prisma.categoria.create({ data: { ...datos, activa: true } })
      break
    }
  }

  propagar()
  return { ok: true }
}

export async function cambiarActivo(
  actor: Actor,
  entidad: Entidad,
  id: string,
  activo: boolean
): Promise<Resultado> {
  if (!puedeEditarCatalogo(actor.rol)) return { ok: false, errores: [SIN_PERMISO] }

  // Reactivar es una escritura como cualquier otra: si el prefijo se le
  // asigno a otro tramite mientras estaba de baja, hay que cambiarlo antes.
  if (entidad === "tramite" && activo) {
    const t = await prisma.tramite.findUnique({ where: { id } })
    if (!t) return { ok: false, errores: [{ campo: "id", mensaje: "No existe" }] }
    const e = validarPrefijo(t.prefijo, await prefijosTomados(id))
    if (e) return { ok: false, errores: [e] }
  }

  switch (entidad) {
    case "sede": await prisma.sede.update({ where: { id }, data: { activa: activo } }); break
    case "ala": await prisma.ala.update({ where: { id }, data: { activa: activo } }); break
    case "piso": await prisma.piso.update({ where: { id }, data: { activa: activo } }); break
    case "categoria": await prisma.categoria.update({ where: { id }, data: { activa: activo } }); break
    case "box": await prisma.box.update({ where: { id }, data: { activo } }); break
    case "tramite": await prisma.tramite.update({ where: { id }, data: { activo } }); break
  }

  propagar()
  return { ok: true }
}

export async function borrar(
  actor: Actor,
  entidad: Entidad,
  id: string
): Promise<Resultado> {
  if (!puedeEditarCatalogo(actor.rol)) return { ok: false, errores: [SIN_PERMISO] }

  // Se verifica acá, no solo al pintar el boton: entre que la pagina se
  // renderizo y que alguien apreto pueden haber entrado turnos.
  const refs = await contarReferencias(entidad, id)
  if (!sePuedeBorrar(refs)) {
    const cuales = Object.entries(refs)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${n} ${k}`)
      .join(", ")
    return {
      ok: false,
      errores: [{ campo: "referencias", mensaje: `No se puede borrar: tiene ${cuales}` }],
    }
  }

  switch (entidad) {
    case "sede": await prisma.sede.delete({ where: { id } }); break
    case "ala": await prisma.ala.delete({ where: { id } }); break
    case "piso": await prisma.piso.delete({ where: { id } }); break
    case "categoria": await prisma.categoria.delete({ where: { id } }); break
    case "box": await prisma.box.delete({ where: { id } }); break
    case "tramite": await prisma.tramite.delete({ where: { id } }); break
  }

  propagar()
  return { ok: true }
}
```

- [ ] **Step 4: Correr el test**

Run: `npm run test:integration -- tests/integration/mutaciones.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Verificar la suite completa**

Run: `npm test`
Expected: todo pasa.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/mutaciones.ts tests/integration/mutaciones.test.ts
git commit -m "feat(sp4a): mutaciones del catalogo con control de rol en el servidor"
```

---

## Task 8: Panel base, guard y Server Actions

**Files:**
- Create: `lib/admin/estadoFormulario.ts`, `lib/admin/acciones.ts`, `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/_componentes/TablaAbm.tsx`, `app/admin/_componentes/Campos.tsx`

**Interfaces:**
- Consumes: `actorActual`, `puedeVerCatalogo`, `puedeEditarCatalogo` de Task 2; todas las mutaciones de Task 7.
- Produces: `interface EstadoFormulario { errores: ErrorCampo[]; guardado: boolean }` y `ESTADO_INICIAL`, ambos desde `lib/admin/estadoFormulario.ts`; Server Actions `accionGuardarTramite`, `accionGuardarBox`, `accionGuardarSimple`, `accionCambiarActivo`, `accionBorrar`, todas con firma `(prev: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>`; componentes `TablaAbm`, `FilaAbm`, `CampoTexto`, `CampoNumero`, `CampoSelect`, `CampoDias`, `CampoCasillas`.

- [ ] **Step 1: Escribir `lib/admin/estadoFormulario.ts`**

Va aparte de `acciones.ts` a propósito:

```ts
import type { ErrorCampo } from "./validaciones"

/**
 * Vive fuera de acciones.ts porque un modulo con "use server" solo puede
 * exportar funciones asincronas: exportar esta constante desde ahi rompe el
 * build de Next.
 */
export interface EstadoFormulario {
  errores: ErrorCampo[]
  guardado: boolean
}

export const ESTADO_INICIAL: EstadoFormulario = { errores: [], guardado: false }
```

- [ ] **Step 2: Escribir `lib/admin/acciones.ts`**

```ts
"use server"

import { revalidatePath } from "next/cache"
import { actorActual } from "./acceso"
import {
  guardarTramite,
  guardarBox,
  guardarSimple,
  cambiarActivo,
  borrar,
  type EntidadSimple,
  type Resultado,
} from "./mutaciones"
import type { Entidad } from "./referencias"
import { type EstadoFormulario } from "./estadoFormulario"

const NO_AUTENTICADO: EstadoFormulario = {
  errores: [{ campo: "rol", mensaje: "Tu sesión venció. Volvé a entrar" }],
  guardado: false,
}

function aEstado(r: Resultado): EstadoFormulario {
  return r.ok ? { errores: [], guardado: true } : { errores: r.errores, guardado: false }
}

function texto(fd: FormData, clave: string): string {
  return String(fd.get(clave) ?? "")
}

function entero(fd: FormData, clave: string): number {
  return Number.parseInt(texto(fd, clave), 10)
}

function idOpcional(fd: FormData): string | null {
  const v = texto(fd, "id")
  return v === "" ? null : v
}

function varios(fd: FormData, clave: string): string[] {
  return fd.getAll(clave).map(String).filter((v) => v !== "")
}

function refrescar(): void {
  revalidatePath("/admin", "layout")
  // El kiosco tambien lee el catalogo y su pagina es un Server Component.
  revalidatePath("/kiosco")
}

export async function accionGuardarTramite(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const r = await guardarTramite(actor, {
    id: idOpcional(fd),
    categoriaId: texto(fd, "categoriaId"),
    nombre: texto(fd, "nombre"),
    subtitulo: texto(fd, "subtitulo"),
    icono: texto(fd, "icono"),
    prefijo: texto(fd, "prefijo").toUpperCase(),
    destinoAlaId: texto(fd, "destinoAlaId"),
    destinoPisoId: texto(fd, "destinoPisoId"),
    horaApertura: texto(fd, "horaApertura"),
    horaCierre: texto(fd, "horaCierre"),
    diasSemana: varios(fd, "dia").sort().join(""),
    duracionMinimaEsperada: entero(fd, "duracionMinimaEsperada"),
    orden: entero(fd, "orden"),
    boxIds: varios(fd, "boxId"),
  })

  if (r.ok) refrescar()
  return aEstado(r)
}

export async function accionGuardarBox(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const r = await guardarBox(actor, {
    id: idOpcional(fd),
    alaId: texto(fd, "alaId"),
    pisoId: texto(fd, "pisoId"),
    numero: entero(fd, "numero"),
    nombre: texto(fd, "nombre"),
    horaApertura: texto(fd, "horaApertura"),
    horaCierre: texto(fd, "horaCierre"),
    diasSemana: varios(fd, "dia").sort().join(""),
    tramiteIds: varios(fd, "tramiteId"),
  })

  if (r.ok) refrescar()
  return aEstado(r)
}

export async function accionGuardarSimple(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const entidad = texto(fd, "entidad") as EntidadSimple
  const r = await guardarSimple(actor, entidad, {
    id: idOpcional(fd),
    nombre: texto(fd, "nombre"),
    posicion: entero(fd, "posicion"),
    sedeId: texto(fd, "sedeId") || undefined,
    icono: texto(fd, "icono") || undefined,
  })

  if (r.ok) refrescar()
  return aEstado(r)
}

export async function accionCambiarActivo(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const r = await cambiarActivo(
    actor,
    texto(fd, "entidad") as Entidad,
    texto(fd, "id"),
    texto(fd, "activo") === "1"
  )

  if (r.ok) refrescar()
  return aEstado(r)
}

export async function accionBorrar(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const r = await borrar(actor, texto(fd, "entidad") as Entidad, texto(fd, "id"))

  if (r.ok) refrescar()
  return aEstado(r)
}
```

- [ ] **Step 3: Escribir el guard**

Crear `app/admin/layout.tsx`:

```tsx
import Link from "next/link"
import { redirect } from "next/navigation"
import { actorActual, puedeVerCatalogo, puedeEditarCatalogo } from "@/lib/admin/acceso"

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode
}) {
  const actor = await actorActual()

  // El guard vive en el layout, no en cada pagina: asi cubre toda la rama
  // /admin/* sin que haya que acordarse de repetirlo en una pagina nueva.
  if (!actor || !puedeVerCatalogo(actor.rol)) redirect("/operador/login")

  const soloLectura = !puedeEditarCatalogo(actor.rol)

  return (
    <div className="min-h-dvh bg-gris-20">
      <header className="flex items-center justify-between border-b border-gainsboro bg-white px-6 py-4">
        <nav className="flex items-center gap-6">
          <Link href="/admin" className="font-titulo text-lg font-semibold">
            Administración
          </Link>
          <Link href="/admin/catalogo/tramites" className="text-sm hover:underline">
            Trámites
          </Link>
          <Link href="/admin/catalogo/boxes" className="text-sm hover:underline">
            Boxes
          </Link>
          <Link href="/admin/catalogo/simples" className="text-sm hover:underline">
            Sedes, alas, pisos y categorías
          </Link>
        </nav>

        <div className="flex items-center gap-4 text-sm">
          {soloLectura && (
            <span className="rounded-lg bg-gainsboro px-3 py-1 font-semibold">
              Sólo lectura
            </span>
          )}
          <span>{actor.nombre}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 4: Escribir el índice**

Crear `app/admin/page.tsx`:

```tsx
import Link from "next/link"
import { prisma } from "@/lib/db"

export default async function PaginaAdmin() {
  const [tramites, boxes, categorias] = await Promise.all([
    prisma.tramite.count({ where: { activo: true } }),
    prisma.box.count({ where: { activo: true } }),
    prisma.categoria.count({ where: { activa: true } }),
  ])

  const tarjetas = [
    { href: "/admin/catalogo/tramites", titulo: "Trámites", cuantos: tramites },
    { href: "/admin/catalogo/boxes", titulo: "Boxes", cuantos: boxes },
    { href: "/admin/catalogo/simples", titulo: "Categorías", cuantos: categorias },
  ]

  return (
    <>
      <h1 className="mb-6 font-titulo text-2xl font-semibold">Catálogo</h1>
      <div className="grid grid-cols-3 gap-4">
        {tarjetas.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-xl border border-gainsboro bg-white p-6 hover:border-gris-principal"
          >
            <p className="text-3xl font-semibold">{t.cuantos}</p>
            <p className="mt-1 text-sm text-gris-principal">{t.titulo} activos</p>
          </Link>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 5: Escribir los campos reutilizables**

Crear `app/admin/_componentes/Campos.tsx`:

```tsx
"use client"

import type { ErrorCampo } from "@/lib/admin/validaciones"

const BASE =
  "w-full rounded-lg border-2 border-gris-70 bg-white px-3 py-2 " +
  "focus:border-gris-principal focus:outline-none disabled:bg-gris-20"

function mensajeDe(errores: ErrorCampo[], campo: string): string | undefined {
  return errores.find((e) => e.campo === campo)?.mensaje
}

function Envoltura({
  etiqueta,
  campo,
  errores,
  children,
}: {
  etiqueta: string
  campo: string
  errores: ErrorCampo[]
  children: React.ReactNode
}) {
  const error = mensajeDe(errores, campo)
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold">{etiqueta}</span>
      {children}
      {/* El error va pegado al campo, no arriba de todo: quien lo tiene que
          corregir esta mirando aca. */}
      {error && (
        <span role="alert" className="text-sm text-osp">
          {error}
        </span>
      )}
    </label>
  )
}

export function CampoTexto({
  etiqueta,
  campo,
  errores,
  valor,
  soloLectura,
  requerido = true,
}: {
  etiqueta: string
  campo: string
  errores: ErrorCampo[]
  valor?: string
  soloLectura: boolean
  requerido?: boolean
}) {
  return (
    <Envoltura etiqueta={etiqueta} campo={campo} errores={errores}>
      <input
        className={BASE}
        name={campo}
        defaultValue={valor}
        disabled={soloLectura}
        required={requerido}
      />
    </Envoltura>
  )
}

export function CampoNumero({
  etiqueta,
  campo,
  errores,
  valor,
  soloLectura,
  minimo = 0,
}: {
  etiqueta: string
  campo: string
  errores: ErrorCampo[]
  valor?: number
  soloLectura: boolean
  minimo?: number
}) {
  return (
    <Envoltura etiqueta={etiqueta} campo={campo} errores={errores}>
      <input
        className={BASE}
        type="number"
        name={campo}
        defaultValue={valor}
        min={minimo}
        disabled={soloLectura}
        required
      />
    </Envoltura>
  )
}

export function CampoSelect({
  etiqueta,
  campo,
  errores,
  valor,
  opciones,
  soloLectura,
}: {
  etiqueta: string
  campo: string
  errores: ErrorCampo[]
  valor?: string
  opciones: { id: string; nombre: string }[]
  soloLectura: boolean
}) {
  return (
    <Envoltura etiqueta={etiqueta} campo={campo} errores={errores}>
      <select
        className={BASE}
        name={campo}
        defaultValue={valor ?? ""}
        disabled={soloLectura}
        required
      >
        <option value="">Elegí una opción</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>{o.nombre}</option>
        ))}
      </select>
    </Envoltura>
  )
}

const DIAS = [
  { valor: "0", nombre: "Dom" },
  { valor: "1", nombre: "Lun" },
  { valor: "2", nombre: "Mar" },
  { valor: "3", nombre: "Mié" },
  { valor: "4", nombre: "Jue" },
  { valor: "5", nombre: "Vie" },
  { valor: "6", nombre: "Sáb" },
]

/**
 * Casillas, no texto libre: diasSemana es un conjunto de digitos y escribirlo
 * a mano es la forma mas facil de cargar "1223" sin darse cuenta.
 */
export function CampoDias({
  errores,
  valor = "",
  soloLectura,
}: {
  errores: ErrorCampo[]
  valor?: string
  soloLectura: boolean
}) {
  const error = mensajeDe(errores, "diasSemana")
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-semibold">Días</legend>
      <div className="flex gap-3">
        {DIAS.map((d) => (
          <label key={d.valor} className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              name="dia"
              value={d.valor}
              defaultChecked={valor.includes(d.valor)}
              disabled={soloLectura}
            />
            {d.nombre}
          </label>
        ))}
      </div>
      {error && (
        <span role="alert" className="text-sm text-osp">
          {error}
        </span>
      )}
    </fieldset>
  )
}

export function CampoCasillas({
  etiqueta,
  campo,
  opciones,
  marcados,
  soloLectura,
}: {
  etiqueta: string
  campo: string
  opciones: { id: string; nombre: string }[]
  marcados: string[]
  soloLectura: boolean
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-semibold">{etiqueta}</legend>
      <div className="flex flex-wrap gap-3">
        {opciones.map((o) => (
          <label key={o.id} className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              name={campo}
              value={o.id}
              defaultChecked={marcados.includes(o.id)}
              disabled={soloLectura}
            />
            {o.nombre}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 6: Escribir la tabla de listado**

Crear `app/admin/_componentes/TablaAbm.tsx`:

```tsx
"use client"

import { useActionState } from "react"
import { accionCambiarActivo, accionBorrar } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"

export interface FilaAbm {
  id: string
  celdas: string[]
  activa: boolean
  /** Si tiene referencias, no se ofrece el borrado definitivo. */
  borrable: boolean
}

function BotonEstado({
  entidad,
  fila,
  soloLectura,
}: {
  entidad: string
  fila: FilaAbm
  soloLectura: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionCambiarActivo, ESTADO_INICIAL)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="entidad" value={entidad} />
      <input type="hidden" name="id" value={fila.id} />
      <input type="hidden" name="activo" value={fila.activa ? "0" : "1"} />
      <button
        className="text-sm underline disabled:no-underline disabled:text-gris-80"
        disabled={soloLectura || pendiente}
      >
        {fila.activa ? "Desactivar" : "Activar"}
      </button>
      {estado.errores.length > 0 && (
        <span role="alert" className="ml-2 text-sm text-osp">
          {estado.errores[0].mensaje}
        </span>
      )}
    </form>
  )
}

function BotonBorrar({
  entidad,
  fila,
  soloLectura,
}: {
  entidad: string
  fila: FilaAbm
  soloLectura: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionBorrar, ESTADO_INICIAL)

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="entidad" value={entidad} />
      <input type="hidden" name="id" value={fila.id} />
      <button
        className="text-sm text-osp underline disabled:no-underline disabled:text-gris-80"
        disabled={soloLectura || pendiente}
        // Borrar de verdad es irreversible y no tiene deshacer.
        onClick={(e) => {
          if (!confirm("Se borra definitivamente. ¿Seguro?")) e.preventDefault()
        }}
      >
        Borrar
      </button>
      {estado.errores.length > 0 && (
        <span role="alert" className="ml-2 text-sm text-osp">
          {estado.errores[0].mensaje}
        </span>
      )}
    </form>
  )
}

export function TablaAbm({
  entidad,
  columnas,
  filas,
  soloLectura,
}: {
  entidad: string
  columnas: string[]
  filas: FilaAbm[]
  soloLectura: boolean
}) {
  if (filas.length === 0) {
    return <p className="rounded-xl bg-white p-6 text-gris-principal">Todavía no hay ninguno.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gainsboro bg-white">
      <table className="w-full text-left">
        <thead className="border-b border-gainsboro">
          <tr>
            {columnas.map((c) => (
              <th key={c} scope="col" className="px-4 py-3 text-sm font-semibold">{c}</th>
            ))}
            <th scope="col" className="px-4 py-3 text-sm font-semibold">Estado</th>
            <th scope="col" className="px-4 py-3 text-sm font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-b border-gris-20 last:border-0">
              {f.celdas.map((c, i) => (
                <td key={i} className="px-4 py-3">{c}</td>
              ))}
              <td className="px-4 py-3">
                {/* El estado no se comunica solo por color. */}
                <span className={f.activa ? "font-semibold" : "text-gris-80"}>
                  {f.activa ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="flex gap-4 px-4 py-3">
                <BotonEstado entidad={entidad} fila={f} soloLectura={soloLectura} />
                {f.borrable && (
                  <BotonBorrar entidad={entidad} fila={f} soloLectura={soloLectura} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 7: Verificar que compila y que el guard rebota**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npx next build`
Expected: build limpio, con `/admin` en la lista de rutas.

- [ ] **Step 8: Commit**

```bash
git add lib/admin/estadoFormulario.ts lib/admin/acciones.ts app/admin
git commit -m "feat(sp4a): panel base, guard de rol y Server Actions"
```

---

## Task 9: ABM de sedes, alas, pisos y categorías

**Files:**
- Create: `app/admin/catalogo/simples/page.tsx`, `app/admin/catalogo/simples/FormularioSimple.tsx`

**Interfaces:**
- Consumes: `accionGuardarSimple`, `ESTADO_INICIAL` de Task 8; `TablaAbm`, `FilaAbm`, `CampoTexto`, `CampoNumero`, `CampoSelect` de Task 8; `contarReferencias`, `sePuedeBorrar` de Task 5; `NOMBRES_DE_ICONO` de `lib/kiosco/iconos.ts`.
- Produces: la ruta `/admin/catalogo/simples`.

- [ ] **Step 1: Escribir el formulario**

Crear `app/admin/catalogo/simples/FormularioSimple.tsx`:

```tsx
"use client"

import { useActionState } from "react"
import { accionGuardarSimple } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import { CampoTexto, CampoNumero, CampoSelect } from "../../_componentes/Campos"
import type { EntidadSimple } from "@/lib/admin/mutaciones"

export function FormularioSimple({
  entidad,
  etiquetaPosicion,
  sedes,
  iconos,
  soloLectura,
}: {
  entidad: EntidadSimple
  etiquetaPosicion: string | null
  sedes: { id: string; nombre: string }[]
  iconos: string[] | null
  soloLectura: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarSimple, ESTADO_INICIAL)

  return (
    <form action={accion} className="mb-6 grid grid-cols-4 items-end gap-4 rounded-xl bg-white p-4">
      <input type="hidden" name="entidad" value={entidad} />
      <input type="hidden" name="id" value="" />

      <CampoTexto
        etiqueta="Nombre"
        campo="nombre"
        errores={estado.errores}
        soloLectura={soloLectura}
      />

      {etiquetaPosicion && (
        <CampoNumero
          etiqueta={etiquetaPosicion}
          campo="posicion"
          errores={estado.errores}
          soloLectura={soloLectura}
          valor={0}
        />
      )}
      {!etiquetaPosicion && <input type="hidden" name="posicion" value="0" />}

      {sedes.length > 0 && (
        <CampoSelect
          etiqueta="Sede"
          campo="sedeId"
          errores={estado.errores}
          opciones={sedes}
          soloLectura={soloLectura}
        />
      )}

      {iconos && (
        <CampoSelect
          etiqueta="Icono"
          campo="icono"
          errores={estado.errores}
          opciones={iconos.map((i) => ({ id: i, nombre: i }))}
          soloLectura={soloLectura}
        />
      )}

      <button
        className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
        disabled={soloLectura || pendiente}
      >
        {pendiente ? "Guardando…" : "Agregar"}
      </button>

      {estado.errores.some((e) => e.campo === "rol") && (
        <p role="alert" className="col-span-4 text-sm text-osp">
          {estado.errores.find((e) => e.campo === "rol")?.mensaje}
        </p>
      )}
    </form>
  )
}
```

- [ ] **Step 2: Escribir la página**

Crear `app/admin/catalogo/simples/page.tsx`:

```tsx
import { prisma } from "@/lib/db"
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { contarReferencias, sePuedeBorrar, type Entidad } from "@/lib/admin/referencias"
import { NOMBRES_DE_ICONO } from "@/lib/kiosco/iconos"
import { TablaAbm, type FilaAbm } from "../../_componentes/TablaAbm"
import { FormularioSimple } from "./FormularioSimple"

async function filasDe(
  entidad: Entidad,
  registros: { id: string; activa: boolean; celdas: string[] }[]
): Promise<FilaAbm[]> {
  return Promise.all(
    registros.map(async (r) => ({
      id: r.id,
      celdas: r.celdas,
      activa: r.activa,
      borrable: sePuedeBorrar(await contarReferencias(entidad, r.id)),
    }))
  )
}

export default async function PaginaSimples() {
  const actor = await actorActual()
  const soloLectura = !actor || !puedeEditarCatalogo(actor.rol)

  const [sedes, alas, pisos, categorias] = await Promise.all([
    prisma.sede.findMany({ orderBy: { nombre: "asc" } }),
    prisma.ala.findMany({ orderBy: { orden: "asc" }, include: { sede: true } }),
    prisma.piso.findMany({ orderBy: { nivel: "asc" }, include: { sede: true } }),
    prisma.categoria.findMany({ orderBy: { orden: "asc" } }),
  ])

  const opcionesSede = sedes.map((s) => ({ id: s.id, nombre: s.nombre }))

  const [filasSedes, filasAlas, filasPisos, filasCategorias] = await Promise.all([
    filasDe("sede", sedes.map((s) => ({ id: s.id, activa: s.activa, celdas: [s.nombre] }))),
    filasDe("ala", alas.map((a) => ({
      id: a.id,
      activa: a.activa,
      celdas: [a.nombre, a.sede.nombre, String(a.orden)],
    }))),
    filasDe("piso", pisos.map((p) => ({
      id: p.id,
      activa: p.activa,
      celdas: [p.nombre, p.sede.nombre, String(p.nivel)],
    }))),
    filasDe("categoria", categorias.map((c) => ({
      id: c.id,
      activa: c.activa,
      celdas: [c.nombre, c.icono, String(c.orden)],
    }))),
  ])

  return (
    <>
      <h1 className="mb-6 font-titulo text-2xl font-semibold">
        Sedes, alas, pisos y categorías
      </h1>

      <section className="mb-10">
        <h2 className="mb-3 font-titulo text-lg font-semibold">Sedes</h2>
        <FormularioSimple
          entidad="sede"
          etiquetaPosicion={null}
          sedes={[]}
          iconos={null}
          soloLectura={soloLectura}
        />
        <TablaAbm
          entidad="sede"
          columnas={["Nombre"]}
          filas={filasSedes}
          soloLectura={soloLectura}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-titulo text-lg font-semibold">Alas</h2>
        <FormularioSimple
          entidad="ala"
          etiquetaPosicion="Orden"
          sedes={opcionesSede}
          iconos={null}
          soloLectura={soloLectura}
        />
        <TablaAbm
          entidad="ala"
          columnas={["Nombre", "Sede", "Orden"]}
          filas={filasAlas}
          soloLectura={soloLectura}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-titulo text-lg font-semibold">Pisos</h2>
        <FormularioSimple
          entidad="piso"
          etiquetaPosicion="Nivel"
          sedes={opcionesSede}
          iconos={null}
          soloLectura={soloLectura}
        />
        <TablaAbm
          entidad="piso"
          columnas={["Nombre", "Sede", "Nivel"]}
          filas={filasPisos}
          soloLectura={soloLectura}
        />
      </section>

      <section>
        <h2 className="mb-3 font-titulo text-lg font-semibold">Categorías</h2>
        <FormularioSimple
          entidad="categoria"
          etiquetaPosicion="Orden"
          sedes={[]}
          iconos={NOMBRES_DE_ICONO}
          soloLectura={soloLectura}
        />
        <TablaAbm
          entidad="categoria"
          columnas={["Nombre", "Icono", "Orden"]}
          filas={filasCategorias}
          soloLectura={soloLectura}
        />
      </section>
    </>
  )
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npx next build`
Expected: build limpio, con `/admin/catalogo/simples` en la lista.

- [ ] **Step 4: Commit**

```bash
git add app/admin/catalogo/simples
git commit -m "feat(sp4a): ABM de sedes, alas, pisos y categorias"
```

---

## Task 10: ABM de boxes

**Files:**
- Create: `app/admin/catalogo/boxes/page.tsx`, `app/admin/catalogo/boxes/FormularioBox.tsx`

**Interfaces:**
- Consumes: `accionGuardarBox`, `ESTADO_INICIAL` de Task 8; los campos y `TablaAbm` de Task 8; `contarReferencias`, `sePuedeBorrar` de Task 5.
- Produces: la ruta `/admin/catalogo/boxes`.

- [ ] **Step 1: Escribir el formulario**

Crear `app/admin/catalogo/boxes/FormularioBox.tsx`:

```tsx
"use client"

import { useActionState } from "react"
import { accionGuardarBox } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import {
  CampoTexto,
  CampoNumero,
  CampoSelect,
  CampoDias,
  CampoCasillas,
} from "../../_componentes/Campos"

export function FormularioBox({
  alas,
  pisos,
  tramites,
  soloLectura,
}: {
  alas: { id: string; nombre: string }[]
  pisos: { id: string; nombre: string }[]
  tramites: { id: string; nombre: string }[]
  soloLectura: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarBox, ESTADO_INICIAL)

  return (
    <form action={accion} className="mb-6 flex flex-col gap-4 rounded-xl bg-white p-4">
      <input type="hidden" name="id" value="" />

      <div className="grid grid-cols-4 gap-4">
        <CampoTexto
          etiqueta="Nombre"
          campo="nombre"
          errores={estado.errores}
          soloLectura={soloLectura}
        />
        <CampoNumero
          etiqueta="Número"
          campo="numero"
          errores={estado.errores}
          soloLectura={soloLectura}
          minimo={1}
          valor={1}
        />
        <CampoSelect
          etiqueta="Ala"
          campo="alaId"
          errores={estado.errores}
          opciones={alas}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Piso"
          campo="pisoId"
          errores={estado.errores}
          opciones={pisos}
          soloLectura={soloLectura}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <CampoTexto
          etiqueta="Abre"
          campo="horaApertura"
          errores={estado.errores}
          valor="08:00"
          soloLectura={soloLectura}
        />
        <CampoTexto
          etiqueta="Cierra"
          campo="horaCierre"
          errores={estado.errores}
          valor="14:00"
          soloLectura={soloLectura}
        />
        <div className="col-span-2">
          <CampoDias errores={estado.errores} valor="12345" soloLectura={soloLectura} />
        </div>
      </div>

      <CampoCasillas
        etiqueta="Trámites que atiende"
        campo="tramiteId"
        opciones={tramites}
        marcados={[]}
        soloLectura={soloLectura}
      />

      <div>
        <button
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
          disabled={soloLectura || pendiente}
        >
          {pendiente ? "Guardando…" : "Agregar box"}
        </button>
      </div>

      {estado.errores.some((e) => e.campo === "rol") && (
        <p role="alert" className="text-sm text-osp">
          {estado.errores.find((e) => e.campo === "rol")?.mensaje}
        </p>
      )}
    </form>
  )
}
```

- [ ] **Step 2: Escribir la página**

Crear `app/admin/catalogo/boxes/page.tsx`:

```tsx
import { prisma } from "@/lib/db"
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { contarReferencias, sePuedeBorrar } from "@/lib/admin/referencias"
import { TablaAbm, type FilaAbm } from "../../_componentes/TablaAbm"
import { FormularioBox } from "./FormularioBox"

export default async function PaginaBoxes() {
  const actor = await actorActual()
  const soloLectura = !actor || !puedeEditarCatalogo(actor.rol)

  const [boxes, alas, pisos, tramites] = await Promise.all([
    prisma.box.findMany({
      orderBy: [{ ala: { orden: "asc" } }, { numero: "asc" }],
      include: { ala: true, piso: true, tramites: true },
    }),
    prisma.ala.findMany({ where: { activa: true }, orderBy: { orden: "asc" } }),
    prisma.piso.findMany({ where: { activa: true }, orderBy: { nivel: "asc" } }),
    prisma.tramite.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
  ])

  const filas: FilaAbm[] = await Promise.all(
    boxes.map(async (b) => ({
      id: b.id,
      celdas: [
        b.nombre,
        b.ala.nombre,
        b.piso.nombre,
        `${b.horaApertura}–${b.horaCierre}`,
        String(b.tramites.length),
      ],
      activa: b.activo,
      borrable: sePuedeBorrar(await contarReferencias("box", b.id)),
    }))
  )

  return (
    <>
      <h1 className="mb-6 font-titulo text-2xl font-semibold">Boxes</h1>

      <FormularioBox
        alas={alas.map((a) => ({ id: a.id, nombre: a.nombre }))}
        pisos={pisos.map((p) => ({ id: p.id, nombre: p.nombre }))}
        tramites={tramites.map((t) => ({ id: t.id, nombre: t.nombre }))}
        soloLectura={soloLectura}
      />

      <TablaAbm
        entidad="box"
        columnas={["Nombre", "Ala", "Piso", "Horario", "Trámites"]}
        filas={filas}
        soloLectura={soloLectura}
      />
    </>
  )
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npx next build`
Expected: build limpio con `/admin/catalogo/boxes`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/catalogo/boxes
git commit -m "feat(sp4a): ABM de boxes con asignacion de tramites"
```

---

## Task 11: ABM de trámites y aviso de destino

**Files:**
- Create: `app/admin/catalogo/tramites/page.tsx`, `app/admin/catalogo/tramites/FormularioTramite.tsx`
- Create: `lib/admin/avisos.ts`
- Test: `tests/unit/avisos.test.ts`

**Interfaces:**
- Consumes: `accionGuardarTramite`, `ESTADO_INICIAL` de Task 8; los campos y `TablaAbm` de Task 8; `contarReferencias`, `sePuedeBorrar` de Task 5.
- Produces: `avisoDestino(destinoAla: string, alasDeBoxes: string[]): string | null`; la ruta `/admin/catalogo/tramites`.

- [ ] **Step 1: Escribir el test del aviso**

Crear `tests/unit/avisos.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { avisoDestino } from "@/lib/admin/avisos"

describe("avisoDestino", () => {
  it("no avisa si todos los boxes están en el ala del destino", () => {
    expect(avisoDestino("Norte", ["Norte", "Norte"])).toBeNull()
  })

  // La redundancia entre destinoAla y el ala de los boxes es deliberada: el
  // ticket tiene que decir adonde ir aunque el tramite se quede sin boxes.
  // Por eso es aviso y no error, y por eso sin boxes no se avisa nada.
  it("no avisa si el trámite no tiene boxes", () => {
    expect(avisoDestino("Norte", [])).toBeNull()
  })

  it("avisa si algún box está en otra ala", () => {
    const a = avisoDestino("Norte", ["Norte", "Sur"])
    expect(a).not.toBeNull()
    expect(a).toContain("Sur")
  })

  it("avisa si todos los boxes están en otra ala", () => {
    expect(avisoDestino("Norte", ["Sur"])).not.toBeNull()
  })

  it("no repite el ala en el mensaje", () => {
    const a = avisoDestino("Norte", ["Sur", "Sur", "Sur"])
    expect(a?.match(/Sur/g)?.length).toBe(1)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm run test:unit -- tests/unit/avisos.test.ts`
Expected: FAIL — no existe `@/lib/admin/avisos`.

- [ ] **Step 3: Escribir `lib/admin/avisos.ts`**

```ts
/**
 * Aviso, no error. Tramite.destinoAla y el ala de los boxes que lo atienden
 * son redundantes a proposito: si el tramite se queda momentaneamente sin
 * boxes abiertos, el ticket igual tiene que decir adonde ir. Por eso una
 * discrepancia se muestra y no se bloquea, y por eso un tramite sin boxes no
 * genera ningun aviso.
 */
export function avisoDestino(
  destinoAla: string,
  alasDeBoxes: string[]
): string | null {
  const ajenas = [...new Set(alasDeBoxes.filter((a) => a !== destinoAla))]
  if (ajenas.length === 0) return null

  return `El ticket dice ${destinoAla}, pero hay boxes en ${ajenas.join(", ")}`
}
```

- [ ] **Step 4: Correr el test**

Run: `npm run test:unit -- tests/unit/avisos.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Escribir el formulario**

Crear `app/admin/catalogo/tramites/FormularioTramite.tsx`:

```tsx
"use client"

import { useActionState } from "react"
import { accionGuardarTramite } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import {
  CampoTexto,
  CampoNumero,
  CampoSelect,
  CampoDias,
  CampoCasillas,
} from "../../_componentes/Campos"

export function FormularioTramite({
  categorias,
  alas,
  pisos,
  boxes,
  iconos,
  soloLectura,
}: {
  categorias: { id: string; nombre: string }[]
  alas: { id: string; nombre: string }[]
  pisos: { id: string; nombre: string }[]
  boxes: { id: string; nombre: string }[]
  iconos: string[]
  soloLectura: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarTramite, ESTADO_INICIAL)

  return (
    <form action={accion} className="mb-6 flex flex-col gap-4 rounded-xl bg-white p-4">
      <input type="hidden" name="id" value="" />

      <div className="grid grid-cols-4 gap-4">
        <CampoTexto
          etiqueta="Nombre"
          campo="nombre"
          errores={estado.errores}
          soloLectura={soloLectura}
        />
        <CampoTexto
          etiqueta="Subtítulo"
          campo="subtitulo"
          errores={estado.errores}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Categoría"
          campo="categoriaId"
          errores={estado.errores}
          opciones={categorias}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Icono"
          campo="icono"
          errores={estado.errores}
          opciones={iconos.map((i) => ({ id: i, nombre: i }))}
          soloLectura={soloLectura}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <CampoTexto
          etiqueta="Prefijo"
          campo="prefijo"
          errores={estado.errores}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Destino: ala"
          campo="destinoAlaId"
          errores={estado.errores}
          opciones={alas}
          soloLectura={soloLectura}
        />
        <CampoSelect
          etiqueta="Destino: piso"
          campo="destinoPisoId"
          errores={estado.errores}
          opciones={pisos}
          soloLectura={soloLectura}
        />
        <CampoNumero
          etiqueta="Orden"
          campo="orden"
          errores={estado.errores}
          soloLectura={soloLectura}
          valor={0}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <CampoTexto
          etiqueta="Abre"
          campo="horaApertura"
          errores={estado.errores}
          valor="08:00"
          soloLectura={soloLectura}
        />
        <CampoTexto
          etiqueta="Cierra"
          campo="horaCierre"
          errores={estado.errores}
          valor="14:00"
          soloLectura={soloLectura}
        />
        <CampoNumero
          etiqueta="Duración mínima (min)"
          campo="duracionMinimaEsperada"
          errores={estado.errores}
          soloLectura={soloLectura}
          valor={5}
        />
        <CampoDias errores={estado.errores} valor="12345" soloLectura={soloLectura} />
      </div>

      <CampoCasillas
        etiqueta="Boxes que lo atienden"
        campo="boxId"
        opciones={boxes}
        marcados={[]}
        soloLectura={soloLectura}
      />

      <div>
        <button
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
          disabled={soloLectura || pendiente}
        >
          {pendiente ? "Guardando…" : "Agregar trámite"}
        </button>
      </div>

      {estado.errores.some((e) => e.campo === "rol") && (
        <p role="alert" className="text-sm text-osp">
          {estado.errores.find((e) => e.campo === "rol")?.mensaje}
        </p>
      )}
    </form>
  )
}
```

- [ ] **Step 6: Escribir la página**

Crear `app/admin/catalogo/tramites/page.tsx`:

```tsx
import { prisma } from "@/lib/db"
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { contarReferencias, sePuedeBorrar } from "@/lib/admin/referencias"
import { avisoDestino } from "@/lib/admin/avisos"
import { NOMBRES_DE_ICONO } from "@/lib/kiosco/iconos"
import { TablaAbm, type FilaAbm } from "../../_componentes/TablaAbm"
import { FormularioTramite } from "./FormularioTramite"

export default async function PaginaTramites() {
  const actor = await actorActual()
  const soloLectura = !actor || !puedeEditarCatalogo(actor.rol)

  const [tramites, categorias, alas, pisos, boxes] = await Promise.all([
    prisma.tramite.findMany({
      orderBy: { orden: "asc" },
      include: {
        categoria: true,
        destinoAla: true,
        boxes: { include: { box: { include: { ala: true } } } },
      },
    }),
    prisma.categoria.findMany({ where: { activa: true }, orderBy: { orden: "asc" } }),
    prisma.ala.findMany({ where: { activa: true }, orderBy: { orden: "asc" } }),
    prisma.piso.findMany({ where: { activa: true }, orderBy: { nivel: "asc" } }),
    prisma.box.findMany({
      where: { activo: true },
      orderBy: { numero: "asc" },
      include: { ala: true },
    }),
  ])

  const avisos = tramites
    .map((t) => ({
      nombre: t.nombre,
      aviso: avisoDestino(t.destinoAla.nombre, t.boxes.map((bt) => bt.box.ala.nombre)),
    }))
    .filter((a): a is { nombre: string; aviso: string } => a.aviso !== null)

  const filas: FilaAbm[] = await Promise.all(
    tramites.map(async (t) => ({
      id: t.id,
      celdas: [
        t.nombre,
        t.prefijo,
        t.categoria.nombre,
        t.destinoAla.nombre,
        `${t.horaApertura}–${t.horaCierre}`,
        String(t.boxes.length),
      ],
      activa: t.activo,
      borrable: sePuedeBorrar(await contarReferencias("tramite", t.id)),
    }))
  )

  return (
    <>
      <h1 className="mb-6 font-titulo text-2xl font-semibold">Trámites</h1>

      {avisos.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-amber-500 bg-amber-50 p-4">
          <p className="mb-2 font-semibold">Destinos que no coinciden con los boxes</p>
          <ul className="list-inside list-disc text-sm">
            {avisos.map((a) => (
              <li key={a.nombre}>
                <strong>{a.nombre}</strong>: {a.aviso}
              </li>
            ))}
          </ul>
        </div>
      )}

      <FormularioTramite
        categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
        alas={alas.map((a) => ({ id: a.id, nombre: a.nombre }))}
        pisos={pisos.map((p) => ({ id: p.id, nombre: p.nombre }))}
        boxes={boxes.map((b) => ({ id: b.id, nombre: `${b.nombre} — ${b.ala.nombre}` }))}
        iconos={NOMBRES_DE_ICONO}
        soloLectura={soloLectura}
      />

      <TablaAbm
        entidad="tramite"
        columnas={["Nombre", "Prefijo", "Categoría", "Destino", "Horario", "Boxes"]}
        filas={filas}
        soloLectura={soloLectura}
      />
    </>
  )
}
```

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npx next build`
Expected: build limpio con `/admin/catalogo/tramites`.

- [ ] **Step 8: Commit**

```bash
git add lib/admin/avisos.ts app/admin/catalogo/tramites tests/unit/avisos.test.ts
git commit -m "feat(sp4a): ABM de tramites con aviso de destino inconsistente"
```

---

## Task 12: Propagación diferida al kiosco

**Files:**
- Create: `lib/kiosco/catalogoVencido.ts`
- Modify: `lib/kiosco/socket.ts:31-34`
- Modify: `app/kiosco/Wizard.tsx`
- Test: `tests/unit/catalogoVencido.test.ts`

**Interfaces:**
- Consumes: nada de tareas previas; el evento `CATALOGO_ACTUALIZADO` que emite Task 7.
- Produces: `sePuedeRefrescar(paso: string, dni: string): boolean`; `conexionKiosco(): Socket` exportada desde `lib/kiosco/socket.ts`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/catalogoVencido.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { sePuedeRefrescar } from "@/lib/kiosco/catalogoVencido"

describe("sePuedeRefrescar", () => {
  // Ocioso: nadie perdio nada si la pagina se recarga ahora.
  it("en el paso del DNI sin nada tipeado, sí", () => {
    expect(sePuedeRefrescar("dni", "")).toBe(true)
  })

  // Recargar acá le borra los digitos sin explicación.
  it("en el paso del DNI con dígitos tipeados, no", () => {
    expect(sePuedeRefrescar("dni", "2")).toBe(false)
    expect(sePuedeRefrescar("dni", "20123456")).toBe(false)
  })

  it("en cualquier otro paso, no", () => {
    expect(sePuedeRefrescar("categoria", "")).toBe(false)
    expect(sePuedeRefrescar("tramite", "")).toBe(false)
    expect(sePuedeRefrescar("resultado", "")).toBe(false)
  })

  // El paso de error ya esta pidiendo reintentar: refrescar solo ayuda.
  it("en el paso de error, sí", () => {
    expect(sePuedeRefrescar("error", "")).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm run test:unit -- tests/unit/catalogoVencido.test.ts`
Expected: FAIL — no existe `@/lib/kiosco/catalogoVencido`.

- [ ] **Step 3: Escribir `lib/kiosco/catalogoVencido.ts`**

```ts
/**
 * Si el kiosco puede recargar el catalogo ahora mismo sin arruinarle el
 * tramite a nadie. Recargar de golpe a alguien que esta en el medio del
 * wizard le borra lo que hizo y lo devuelve al inicio sin explicacion; el
 * cambio se aplica cuando termina o cuando salta la inactividad.
 */
export function sePuedeRefrescar(paso: string, dni: string): boolean {
  if (paso === "error") return true
  return paso === "dni" && dni === ""
}
```

- [ ] **Step 4: Correr el test**

Run: `npm run test:unit -- tests/unit/catalogoVencido.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Exportar la conexión del kiosco**

`lib/kiosco/socket.ts` ya mantiene un singleton de socket, pero su función `conexion()` es privada. En la línea 31, cambiar la declaración para exportarla con un nombre que diga de quién es la conexión:

```ts
/**
 * El socket del kiosco, uno solo por pestaña. Lo usa generarTurnoPorSocket y
 * tambien quien necesite escuchar eventos del servidor: abrir una segunda
 * conexion duplicaria los avisos.
 */
export function conexionKiosco(): Socket {
  if (!socket) socket = io({ transports: ["websocket", "polling"] })
  return socket
}
```

Y actualizar la única llamada interna, en `generarTurnoPorSocket`:

```ts
    conexionKiosco().emit("GENERAR_TURNO", cmd, (r: RespuestaGeneracion) => {
      clearTimeout(t)
      resolve(r ?? fallo)
    })
```

**No usar `lib/useSocket.ts`**: es legacy de la era Supabase, apunta a `ws://10.25.1.77:3001` hardcodeado y no lo usa nadie del kiosco.

- [ ] **Step 6: Conectar el Wizard**

En `app/kiosco/Wizard.tsx`, agregar a los imports existentes:

```tsx
import { useRouter } from "next/navigation"
import { sePuedeRefrescar } from "@/lib/kiosco/catalogoVencido"
```

Y ampliar el import que ya existe de `@/lib/kiosco/socket`:

```tsx
import {
  generarTurnoPorSocket,
  conexionKiosco,
  type TurnoDelServidor,
} from "@/lib/kiosco/socket"
```

Dentro del componente, después del bloque de inactividad (línea ~132), agregar:

```tsx
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
```

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm test`
Expected: todo pasa.

- [ ] **Step 8: Commit**

```bash
git add lib/kiosco/catalogoVencido.ts lib/kiosco/socket.ts app/kiosco/Wizard.tsx tests/unit/catalogoVencido.test.ts
git commit -m "feat(sp4a): el kiosco difiere el cambio de catalogo si esta en uso"
```

---

## Task 13: E2E y documentación

**Files:**
- Create: `e2e/admin.spec.ts`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Escribir el E2E**

Crear `e2e/admin.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

// Sin sesion, /admin no existe para el visitante: el guard redirige antes de
// renderizar nada. Es la unica parte del panel que se puede probar sin
// credenciales institucionales reales.
test("el panel rebota a quien no tiene sesión", async ({ page }) => {
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/operador\/login/)
})

test("las rutas internas del panel también rebotan", async ({ page }) => {
  await page.goto("/admin/catalogo/tramites")
  await expect(page).toHaveURL(/\/operador\/login/)
})

test("el login ofrece usuario y contraseña antes que cualquier destino", async ({ page }) => {
  await page.goto("/operador/login")
  await expect(page.getByLabel("Usuario")).toBeVisible()
  await expect(page.getByLabel("Contraseña")).toBeVisible()
  // El selector de destino aparece recien despues de validar credenciales.
  await expect(page.getByLabel("Dónde entrar")).toHaveCount(0)
})
```

- [ ] **Step 2: Correr el E2E**

Run: `npm run test:e2e -- e2e/admin.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 3: Documentar en `CLAUDE.md`**

Reemplazar la línea que dice que la asignación de boxes se hace a mano hasta SP4:

```markdown
El alta de empleados es por script: `npm run importar:empleados -- usuario1 usuario2`. La asignación
de boxes se hace a mano en la base hasta que SP4b traiga el ABM de empleados.
```

Agregar después del bloque de SP3:

```markdown
**SP4a — COMPLETO.** Panel de administración del catálogo en `/admin`, con control de acceso por rol.

Tres roles en `Empleado.rol`: `operador` (no entra), `supervisor` (ve el catálogo en sólo lectura) y
`admin` (ve y edita). El chequeo se hace siempre en el servidor: los controles deshabilitados de la
interfaz son cosméticos, y `lib/admin/mutaciones.ts` rechaza toda escritura que no venga de un admin.

El primer admin se promueve a mano, porque el script de importación crea a todos como `operador`:

```sql
UPDATE Empleado SET rol = 'admin' WHERE dniInstitucional = '<documento>';
```

Después entra por `/operador/login` con sus credenciales institucionales y elige
"Panel de administración" en el selector de destino.

**Sesión sin box.** `SesionOperador.boxId` es nullable: una sesión sin box es una sesión de panel. No
exige asignación en `EmpleadoBox` ni toma ningún box en exclusiva.

**Las siete entidades se editan desde `/admin/catalogo/*`.** Desactivar es lo normal; el borrado
definitivo aparece sólo cuando la entidad no tiene ninguna referencia, y se vuelve a verificar en el
servidor al momento de borrar.

**El prefijo del trámite tiene que ser único entre los activos.** El número del turno es prefijo más
contador, y `Contador` es por trámite: dos trámites con prefijo `P` generan dos `P01` el mismo día.
Al reactivar un trámite se revalida, por si el prefijo se le asignó a otro mientras estaba de baja.

**Cada mutación invalida el caché antes de emitir `CATALOGO_ACTUALIZADO`.** Al revés, un cliente
rápido recibiría el caché viejo. El evento acelera la propagación pero no sostiene la correctitud: el
caché ya invalidado hace que cualquier `GET /api/catalogo` posterior traiga los datos nuevos.

**El caché es un singleton en memoria del proceso**, así que `invalidarCatalogo()` sólo funciona con
un único servidor Node. Al escalar horizontalmente hay que mover el caché afuera.

**El kiosco difiere el cambio si está en uso.** Recarga al instante si está en el paso del DNI sin
nada tipeado; si hay alguien en el medio del wizard, lo aplica al volver al inicio.
```

Actualizar la tabla de sub-proyectos:

```markdown
| SP4a | ABM de catálogo y control de acceso por rol | **COMPLETO** |
| SP4b | ABM de empleados y asignación de boxes | Sin spec |
| SP4c | Panel del supervisor | Sin spec |
| SP4d | Administración de dispositivos | Sin spec |
| SP5 | Dashboard de estadísticas | Sin spec |
```

- [ ] **Step 4: Verificación manual**

Levantar el servidor con `npm run dev`. Promover un empleado a `admin` con el `UPDATE` de arriba,
entrar por `/operador/login`, elegir "Panel de administración", y comprobar:

1. Crear una categoría nueva aparece en la tabla.
2. Crear un trámite con un prefijo ya usado muestra el error debajo del campo `prefijo`.
3. Con `/kiosco` abierto en otra pestaña en el paso del DNI vacío, guardar un cambio lo refleja solo.
4. Con `/kiosco` en el paso de categorías, guardar un cambio **no** lo interrumpe; al terminar o al
   saltar la inactividad, la lista aparece actualizada.
5. Cambiar el rol del empleado a `supervisor`, volver a entrar, y comprobar que los formularios se ven
   deshabilitados.

- [ ] **Step 5: Correr la suite completa**

Run: `npm test`
Expected: todo pasa.

Run: `npx next build`
Expected: build limpio.

- [ ] **Step 6: Commit**

```bash
git add e2e/admin.spec.ts CLAUDE.md
git commit -m "docs: SP4a completo, con E2E del guard del panel"
```

---

## Mapa de cobertura del spec

| Sección del spec | Tarea |
|---|---|
| §3 Migración | 1 |
| §4.1 Los roles | 2 |
| §4.2 Login con rol | 3 |
| §4.3 El guard | 8 |
| §5.1 Server Actions y singleton de io | 6, 8 |
| §5.2 Orden de la mutación | 7 |
| §6.1 Prefijo único, incluida reactivación | 4, 7 |
| §6.2 Resto de validaciones | 4 |
| §6.3 Aviso del destino | 11 |
| §7 Las bajas | 5, 7 |
| §8 Propagación | 7, 12 |
| §8.1 Límites documentados | 13 |
| §9 Errores y degradación | 6, 7, 8 |
| §10 Pruebas | 1–13 |
| §11 Archivos | 1–13 |
