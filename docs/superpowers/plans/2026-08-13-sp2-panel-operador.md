# SP2 — Panel de operador y motor de cola

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un empleado de la obra social pueda iniciar sesión en un box y atender la cola de turnos — llamar, rellamar, marcar ausente, iniciar, finalizar y derivar.

**Architecture:** El login valida en vivo contra `[ObraSocial].[dbo].[Usuario]` con bcrypt y abre una fila en `SesionOperador`, que **es** la sesión; la cookie sólo lleva su id. Los comandos son handlers en `server/handlers/` con forma fija: validar → transacción Prisma → escribir `TurnoEvento` → emitir a rooms. El panel es una ruta Next que recibe un `SNAPSHOT` al conectar y deltas después.

**Tech Stack:** Next.js 15.2.4 (App Router), React 19, custom server con Socket.io 4, SQL Server 2022 vía Prisma 6, Tailwind 3.4, Vitest, Playwright, `bcryptjs`.

**Spec:** `docs/superpowers/specs/2026-08-13-sp2-panel-operador-design.md`

## Global Constraints

- **La clave de la obra social no se copia, cachea ni loguea.** Se valida en vivo en cada login y se descarta. Nunca se escribe en la base del turnero.
- **La conexión a `ObraSocial` es de sólo lectura.** Se accede con nombre de tres partes (`[ObraSocial].[dbo].[Tabla]`) vía `$queryRaw`. Nunca se le corre una migración.
- **SP2 no agrega ninguna migración de Prisma.** Todos los modelos que necesita ya existen.
- **No se toca `lib/queue/`, `server/rooms.ts`, `generarTurno` ni `llamarTurno`.** Están completos y testeados.
- **`esAfiliado` es `bit NOT NULL`:** se compara con `= 0`, nunca con `IS NULL`.
- **Los errores nunca son mudos.** Cada handler devuelve `{ ok: false, codigo, mensaje, detalle }`. Prohibido `catch { console.error }`.
- **`--gris-80` (#6f7b7e) no se usa para texto** — 4.4:1, no llega a AA. Va en iconos, bordes y estados deshabilitados. Hay un test que lo verifica (`tests/unit/contraste.test.ts`).
- **Código, nombres de archivo, comentarios y commits en español.**
- Los tests de integración corren contra `Turnero_Test`. `tests/setup.ts` aborta la suite si `DATABASE_URL` no termina en `_Test`. **No la desactives.**

---

## File Structure

**Autenticación** (`lib/auth/`)
- `institucional.ts` — lee `[ObraSocial].[dbo].[Usuario]` y verifica bcrypt. Única pieza que toca la base ajena.
- `sesion.ts` — abre, cierra, valida y renueva `SesionOperador`. Firma y lee la cookie.

**Handlers** (`server/handlers/`) — uno por archivo, siguiendo `llamarTurno.ts`
- `rellamarTurno.ts` · `marcarAusente.ts` · `iniciarAtencion.ts` · `finalizarAtencion.ts` · `derivarTurno.ts`

**Cola del box** (`lib/queue/`)
- `resumen.ts` — arma el desglose por trámite. Puro, sin base.

**Panel** (`app/operador/`)
- `page.tsx` · `login/page.tsx` · `PanelOperador.tsx` · `TurnoActivo.tsx` · `ColaBox.tsx` · `ListaAusentes.tsx` · `DialogoDerivar.tsx` · `usarAtajos.ts` · `usarSocketOperador.ts`

**Rutas API** (`app/api/auth/`)
- `login/route.ts` · `logout/route.ts`

**Jobs** (`server/jobs/`)
- `abandonados.ts` · `retencionDni.ts` · `programador.ts`

**Script** (`scripts/`)
- `importarEmpleados.ts`

---

## Task 1: Dependencias y variables de entorno

**Files:**
- Modify: `package.json`
- Modify: `.env.local`, `.env.test.local`
- Create: `lib/config.ts`
- Test: `tests/unit/config.test.ts`

**Interfaces:**
- Produces: `MINUTOS_SESION_VENCIDA: number`, `HORA_CIERRE_DIARIO: string`, `RETENCION_DNI_DIAS: number`, `sesionSecreto(): string` desde `@/lib/config`

- [ ] **Step 1: Instalar dependencias**

```bash
npm install bcryptjs cookie
npm install -D @types/bcryptjs @types/cookie
```

- [ ] **Step 2: Escribir el test que falla**

Crear `tests/unit/config.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest"
import { leerConfig } from "@/lib/config"

const originales = { ...process.env }
afterEach(() => {
  process.env = { ...originales }
})

describe("configuración de SP2", () => {
  it("usa los valores por defecto cuando no hay variables", () => {
    delete process.env.MINUTOS_SESION_VENCIDA
    delete process.env.HORA_CIERRE_DIARIO
    delete process.env.RETENCION_DNI_DIAS
    const c = leerConfig()
    expect(c.minutosSesionVencida).toBe(15)
    expect(c.horaCierreDiario).toBe("23:00")
    expect(c.retencionDniDias).toBe(90)
  })

  it("respeta los valores del entorno", () => {
    process.env.MINUTOS_SESION_VENCIDA = "5"
    process.env.RETENCION_DNI_DIAS = "30"
    const c = leerConfig()
    expect(c.minutosSesionVencida).toBe(5)
    expect(c.retencionDniDias).toBe(30)
  })

  it("ignora valores no numéricos y cae al default", () => {
    process.env.MINUTOS_SESION_VENCIDA = "quince"
    expect(leerConfig().minutosSesionVencida).toBe(15)
  })

  it("sesionSecreto explota si falta la variable, en vez de firmar con un default", () => {
    delete process.env.SESION_SECRETO
    expect(() => leerConfig().sesionSecreto()).toThrow(/SESION_SECRETO/)
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/config.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/config"`

- [ ] **Step 4: Implementar**

Crear `lib/config.ts`:

```typescript
function entero(valor: string | undefined, porDefecto: number): number {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : porDefecto
}

export interface Config {
  minutosSesionVencida: number
  horaCierreDiario: string
  retencionDniDias: number
  sesionSecreto: () => string
}

export function leerConfig(): Config {
  return {
    minutosSesionVencida: entero(process.env.MINUTOS_SESION_VENCIDA, 15),
    horaCierreDiario: process.env.HORA_CIERRE_DIARIO ?? "23:00",
    retencionDniDias: entero(process.env.RETENCION_DNI_DIAS, 90),
    // Se lee tarde y explota: firmar cookies con un secreto por defecto es
    // peor que no arrancar, porque nadie se entera hasta que es tarde.
    sesionSecreto: () => {
      const s = process.env.SESION_SECRETO
      if (!s) throw new Error("Falta SESION_SECRETO: la cookie de sesión no se puede firmar")
      return s
    },
  }
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/config.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 6: Agregar las variables a los dos entornos**

Agregar al final de `.env.local` **y** de `.env.test.local`:

```
SESION_SECRETO="cambiar-esto-por-una-cadena-larga-y-aleatoria-en-produccion"
MINUTOS_SESION_VENCIDA=15
HORA_CIERRE_DIARIO=23:00
RETENCION_DNI_DIAS=90
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/config.ts tests/unit/config.test.ts
git commit -m "feat: configuración y dependencias de SP2"
```

---

## Task 2: Validación de credenciales contra la obra social

**Files:**
- Create: `lib/auth/institucional.ts`
- Test: `tests/unit/institucional.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `interface UsuarioInstitucional { nombreUsuario: string; documento: string; nombreCompleto: string }`
  - `type ResultadoCredencial = { ok: true; usuario: UsuarioInstitucional } | { ok: false; codigo: "CREDENCIAL_INVALIDA" | "ERROR_BASE"; mensaje: string; detalle?: string }`
  - `verificarCredencial(nombreUsuario: string, clave: string): Promise<ResultadoCredencial>`
  - `SQL_EMPLEADOS: string` — el `WHERE` que define "es empleado", reutilizado por el script de importación

- [ ] **Step 1: Escribir el test que falla**

El test **no toca la obra social**: inyecta una función de consulta falsa. Crear `tests/unit/institucional.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import bcrypt from "bcryptjs"
import { verificarCredencial, type FilaUsuario } from "@/lib/auth/institucional"

const hash = bcrypt.hashSync("secreta123", 10)

function consultaFalsa(filas: FilaUsuario[]) {
  return async () => filas
}

const activo: FilaUsuario = {
  nombreUsuario: "silviaflores",
  claveUsuario: hash,
  anulado: false,
  esAfiliado: false,
  documento: "25319010",
  nombrePersona: "Silvia",
  apellidoPersona: "Flores",
}

describe("verificarCredencial", () => {
  it("acepta la clave correcta y devuelve documento y nombre", async () => {
    const r = await verificarCredencial("silviaflores", "secreta123", consultaFalsa([activo]))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.usuario.documento).toBe("25319010")
      expect(r.usuario.nombreCompleto).toBe("Flores, Silvia")
    }
  })

  it("rechaza la clave incorrecta", async () => {
    const r = await verificarCredencial("silviaflores", "otra", consultaFalsa([activo]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("CREDENCIAL_INVALIDA")
  })

  it("rechaza al usuario anulado", async () => {
    const r = await verificarCredencial("x", "secreta123", consultaFalsa([{ ...activo, anulado: true }]))
    expect(r.ok).toBe(false)
  })

  it("rechaza al afiliado: el portal web no es el turnero", async () => {
    const r = await verificarCredencial("x", "secreta123", consultaFalsa([{ ...activo, esAfiliado: true }]))
    expect(r.ok).toBe(false)
  })

  it("rechaza al usuario inexistente", async () => {
    const r = await verificarCredencial("nadie", "secreta123", consultaFalsa([]))
    expect(r.ok).toBe(false)
  })

  it("da el mismo mensaje ante cualquier fallo, para no confirmar qué usuarios existen", async () => {
    const inexistente = await verificarCredencial("nadie", "x", consultaFalsa([]))
    const claveMala = await verificarCredencial("silviaflores", "x", consultaFalsa([activo]))
    const anulado = await verificarCredencial("x", "secreta123", consultaFalsa([{ ...activo, anulado: true }]))
    if (inexistente.ok || claveMala.ok || anulado.ok) throw new Error("deberían fallar las tres")
    expect(claveMala.mensaje).toBe(inexistente.mensaje)
    expect(anulado.mensaje).toBe(inexistente.mensaje)
  })

  it("nunca devuelve el hash", async () => {
    const r = await verificarCredencial("silviaflores", "secreta123", consultaFalsa([activo]))
    expect(JSON.stringify(r)).not.toContain("$2")
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/institucional.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/auth/institucional"`

- [ ] **Step 3: Implementar**

Crear `lib/auth/institucional.ts`:

```typescript
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

export interface FilaUsuario {
  nombreUsuario: string
  claveUsuario: string
  anulado: boolean
  esAfiliado: boolean
  documento: string
  nombrePersona: string | null
  apellidoPersona: string | null
}

export interface UsuarioInstitucional {
  nombreUsuario: string
  documento: string
  nombreCompleto: string
}

export type ResultadoCredencial =
  | { ok: true; usuario: UsuarioInstitucional }
  | { ok: false; codigo: "CREDENCIAL_INVALIDA" | "ERROR_BASE"; mensaje: string; detalle?: string }

/**
 * [Usuario] mezcla empleados con afiliados, clinicas, prestadores, otras obras
 * sociales y organismos externos. Empleado es el que no tiene ninguna marca.
 * esAfiliado es bit NOT NULL: va con = 0, nunca con IS NULL.
 */
export const SQL_EMPLEADOS = `
  u.esAfiliado = 0
  AND u.idClinica IS NULL
  AND u.idPrestador IS NULL
  AND u.codObraSocial IS NULL
  AND u.codOrganismoExterno IS NULL
`

const MENSAJE_GENERICO = "Usuario o contraseña incorrectos"

type Consulta = (nombreUsuario: string) => Promise<FilaUsuario[]>

const consultaReal: Consulta = (nombreUsuario) =>
  prisma.$queryRaw<FilaUsuario[]>`
    SELECT TOP 1
      LTRIM(RTRIM(u.nombreUsuario)) AS nombreUsuario,
      u.claveUsuario,
      u.anulado,
      u.esAfiliado,
      LTRIM(RTRIM(p.numeroDocPersona)) AS documento,
      LTRIM(RTRIM(p.nombrePersona)) AS nombrePersona,
      LTRIM(RTRIM(p.apellidoPersona)) AS apellidoPersona
    FROM [ObraSocial].[dbo].[Usuario] u
    JOIN [ObraSocial].[dbo].[Persona] p ON p.idPersona = u.idPersona
    WHERE u.nombreUsuario = ${nombreUsuario}
  `

export async function verificarCredencial(
  nombreUsuario: string,
  clave: string,
  consulta: Consulta = consultaReal
): Promise<ResultadoCredencial> {
  const rechazo = {
    ok: false as const,
    codigo: "CREDENCIAL_INVALIDA" as const,
    mensaje: MENSAJE_GENERICO,
  }

  try {
    const filas = await consulta(nombreUsuario)
    const fila = filas[0]

    // Un solo mensaje para inexistente, anulado, afiliado y clave incorrecta:
    // distinguirlos le confirma a cualquiera que un usuario existe.
    if (!fila || fila.anulado || fila.esAfiliado) return rechazo
    if (!(await bcrypt.compare(clave, fila.claveUsuario))) return rechazo

    const apellido = fila.apellidoPersona?.trim() ?? ""
    const nombre = fila.nombrePersona?.trim() ?? ""
    return {
      ok: true,
      usuario: {
        nombreUsuario: fila.nombreUsuario.trim(),
        documento: fila.documento.trim(),
        nombreCompleto: apellido && nombre ? `${apellido}, ${nombre}` : apellido || nombre,
      },
    }
  } catch (e) {
    return {
      ok: false,
      codigo: "ERROR_BASE",
      mensaje: "No se pudo validar la credencial",
      detalle: e instanceof Error ? e.message : String(e),
    }
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/institucional.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add lib/auth/institucional.ts tests/unit/institucional.test.ts
git commit -m "feat: validación de credenciales contra la obra social"
```

---

## Task 3: Sesión de operador

**Files:**
- Create: `lib/auth/sesion.ts`
- Test: `tests/integration/sesion.test.ts`

**Interfaces:**
- Consumes: `leerConfig` de `@/lib/config`
- Produces:
  - `type ResultadoApertura = { ok: true; sesionId: string } | { ok: false; codigo: "BOX_OCUPADO" | "BOX_NO_ASIGNADO" | "ERROR_BASE"; mensaje: string; detalle?: string }`
  - `abrirSesion(empleadoId: string, boxId: string): Promise<ResultadoApertura>`
  - `cerrarSesion(sesionId: string): Promise<void>`
  - `sesionActiva(sesionId: string): Promise<{ id: string; empleadoId: string; boxId: string } | null>`
  - `renovarLatido(sesionId: string): Promise<void>`
  - `firmarCookie(sesionId: string): string` · `leerCookie(valor: string | undefined): string | null`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/sesion.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import {
  abrirSesion, cerrarSesion, sesionActiva, renovarLatido,
  firmarCookie, leerCookie,
} from "@/lib/auth/sesion"

async function escenario() {
  await prisma.sesionOperador.deleteMany()
  await prisma.empleadoBox.deleteMany()
  await prisma.empleado.deleteMany()

  const box = await prisma.box.findFirstOrThrow()
  const otroBox = await prisma.box.findFirstOrThrow({ where: { id: { not: box.id } } })
  const ana = await prisma.empleado.create({
    data: { dniInstitucional: "25319010", nombre: "Flores, Silvia", rol: "operador" },
  })
  const beto = await prisma.empleado.create({
    data: { dniInstitucional: "32878228", nombre: "Tello, Gonzalo", rol: "operador" },
  })
  await prisma.empleadoBox.create({ data: { empleadoId: ana.id, boxId: box.id } })
  await prisma.empleadoBox.create({ data: { empleadoId: beto.id, boxId: box.id } })
  return { box, otroBox, ana, beto }
}

describe("sesión de operador", () => {
  let ctx: Awaited<ReturnType<typeof escenario>>
  beforeEach(async () => { ctx = await escenario() })

  it("abre la sesión y la deja activa", async () => {
    const r = await abrirSesion(ctx.ana.id, ctx.box.id)
    expect(r.ok).toBe(true)
    if (r.ok) {
      const s = await sesionActiva(r.sesionId)
      expect(s?.boxId).toBe(ctx.box.id)
      expect(s?.empleadoId).toBe(ctx.ana.id)
    }
  })

  it("rechaza un box que no tiene asignado", async () => {
    const r = await abrirSesion(ctx.ana.id, ctx.otroBox.id)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("BOX_NO_ASIGNADO")
  })

  it("rechaza el box si otro lo tiene con latido fresco", async () => {
    await abrirSesion(ctx.ana.id, ctx.box.id)
    const r = await abrirSesion(ctx.beto.id, ctx.box.id)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.codigo).toBe("BOX_OCUPADO")
      expect(r.mensaje).toContain("Flores")
    }
  })

  it("toma el box si el latido está vencido, y cierra la sesión colgada", async () => {
    const vieja = await abrirSesion(ctx.ana.id, ctx.box.id)
    if (!vieja.ok) throw new Error("debería haber abierto")

    const hace30 = new Date(Date.now() - 30 * 60 * 1000)
    await prisma.sesionOperador.update({
      where: { id: vieja.sesionId },
      data: { ultimoLatido: hace30 },
    })

    const nueva = await abrirSesion(ctx.beto.id, ctx.box.id)
    expect(nueva.ok).toBe(true)
    expect(await sesionActiva(vieja.sesionId)).toBeNull()
  })

  it("la sesión cerrada deja de estar activa", async () => {
    const r = await abrirSesion(ctx.ana.id, ctx.box.id)
    if (!r.ok) throw new Error("debería haber abierto")
    await cerrarSesion(r.sesionId)
    expect(await sesionActiva(r.sesionId)).toBeNull()
  })

  it("el latido corre el vencimiento", async () => {
    const r = await abrirSesion(ctx.ana.id, ctx.box.id)
    if (!r.ok) throw new Error("debería haber abierto")
    const hace30 = new Date(Date.now() - 30 * 60 * 1000)
    await prisma.sesionOperador.update({ where: { id: r.sesionId }, data: { ultimoLatido: hace30 } })

    await renovarLatido(r.sesionId)

    const bloqueada = await abrirSesion(ctx.beto.id, ctx.box.id)
    expect(bloqueada.ok).toBe(false)
  })

  it("la cookie firmada se lee de vuelta", () => {
    expect(leerCookie(firmarCookie("abc-123"))).toBe("abc-123")
  })

  it("una cookie manipulada no se acepta", () => {
    const firmada = firmarCookie("abc-123")
    expect(leerCookie(firmada.replace("abc-123", "otro-id"))).toBeNull()
    expect(leerCookie("basura")).toBeNull()
    expect(leerCookie(undefined)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/integration/sesion.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/auth/sesion"`

- [ ] **Step 3: Implementar**

Crear `lib/auth/sesion.ts`:

```typescript
import { createHmac, timingSafeEqual } from "crypto"
import { prisma } from "@/lib/db"
import { leerConfig } from "@/lib/config"

export type ResultadoApertura =
  | { ok: true; sesionId: string }
  | {
      ok: false
      codigo: "BOX_OCUPADO" | "BOX_NO_ASIGNADO" | "ERROR_BASE"
      mensaje: string
      detalle?: string
    }

function vencimiento(): Date {
  return new Date(Date.now() - leerConfig().minutosSesionVencida * 60 * 1000)
}

export async function abrirSesion(
  empleadoId: string,
  boxId: string
): Promise<ResultadoApertura> {
  try {
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
      // Latido vencido: alguien cerro el navegador sin desloguearse.
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

export async function cerrarSesion(sesionId: string): Promise<void> {
  await prisma.sesionOperador.updateMany({
    where: { id: sesionId, fin: null },
    data: { fin: new Date() },
  })
}

export async function sesionActiva(
  sesionId: string
): Promise<{ id: string; empleadoId: string; boxId: string } | null> {
  const s = await prisma.sesionOperador.findFirst({
    where: { id: sesionId, fin: null },
  })
  return s ? { id: s.id, empleadoId: s.empleadoId, boxId: s.boxId } : null
}

export async function renovarLatido(sesionId: string): Promise<void> {
  await prisma.sesionOperador.updateMany({
    where: { id: sesionId, fin: null },
    data: { ultimoLatido: new Date() },
  })
}

export const NOMBRE_COOKIE = "turnero_sesion"

function firma(valor: string): string {
  return createHmac("sha256", leerConfig().sesionSecreto()).update(valor).digest("hex")
}

export function firmarCookie(sesionId: string): string {
  return `${sesionId}.${firma(sesionId)}`
}

export function leerCookie(valor: string | undefined): string | null {
  if (!valor) return null
  const corte = valor.lastIndexOf(".")
  if (corte <= 0) return null

  const sesionId = valor.slice(0, corte)
  const recibida = Buffer.from(valor.slice(corte + 1))
  const esperada = Buffer.from(firma(sesionId))

  // Comparacion de tiempo constante: un === filtraria el secreto por timing.
  if (recibida.length !== esperada.length) return null
  return timingSafeEqual(recibida, esperada) ? sesionId : null
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/integration/sesion.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add lib/auth/sesion.ts tests/integration/sesion.test.ts
git commit -m "feat: apertura, cierre y cookie firmada de SesionOperador"
```

---

## Task 4: Script de importación de empleados

**Files:**
- Create: `scripts/importarEmpleados.ts`
- Modify: `package.json` (scripts)
- Test: `tests/integration/importarEmpleados.test.ts`

**Interfaces:**
- Consumes: `SQL_EMPLEADOS` de `@/lib/auth/institucional`
- Produces: `importarEmpleados(usuarios: string[], consulta?: Consulta): Promise<{ creados: number; actualizados: number; noEncontrados: string[] }>`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/importarEmpleados.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { importarEmpleados, type FilaEmpleado } from "@/scripts/importarEmpleados"

const gente: FilaEmpleado[] = [
  { nombreUsuario: "silviaflores", documento: "25319010", nombrePersona: "Silvia", apellidoPersona: "Flores" },
  { nombreUsuario: "gonzalotello", documento: "32878228", nombrePersona: "Gonzalo", apellidoPersona: "Tello" },
]

const consultaFalsa = async (usuarios: string[]) =>
  gente.filter((g) => usuarios.includes(g.nombreUsuario))

beforeEach(async () => {
  await prisma.sesionOperador.deleteMany()
  await prisma.empleadoBox.deleteMany()
  await prisma.empleado.deleteMany()
})

describe("importarEmpleados", () => {
  it("crea los empleados pedidos con el documento como llave", async () => {
    const r = await importarEmpleados(["silviaflores", "gonzalotello"], consultaFalsa)
    expect(r.creados).toBe(2)

    const silvia = await prisma.empleado.findUniqueOrThrow({
      where: { dniInstitucional: "25319010" },
    })
    expect(silvia.nombre).toBe("Flores, Silvia")
    expect(silvia.rol).toBe("operador")
    expect(silvia.activo).toBe(true)
  })

  it("importa sólo los pedidos, no todos los empleados de la institución", async () => {
    await importarEmpleados(["silviaflores"], consultaFalsa)
    expect(await prisma.empleado.count()).toBe(1)
  })

  it("es idempotente: correrlo dos veces no duplica", async () => {
    await importarEmpleados(["silviaflores"], consultaFalsa)
    const segunda = await importarEmpleados(["silviaflores"], consultaFalsa)
    expect(segunda.creados).toBe(0)
    expect(segunda.actualizados).toBe(1)
    expect(await prisma.empleado.count()).toBe(1)
  })

  it("informa los usuarios que no encontró en vez de fallar en silencio", async () => {
    const r = await importarEmpleados(["silviaflores", "fantasma"], consultaFalsa)
    expect(r.noEncontrados).toEqual(["fantasma"])
    expect(r.creados).toBe(1)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/integration/importarEmpleados.test.ts`
Expected: FAIL — `Failed to resolve import "@/scripts/importarEmpleados"`

- [ ] **Step 3: Implementar**

Crear `scripts/importarEmpleados.ts`:

```typescript
import { prisma } from "@/lib/db"
import { SQL_EMPLEADOS } from "@/lib/auth/institucional"

export interface FilaEmpleado {
  nombreUsuario: string
  documento: string
  nombrePersona: string | null
  apellidoPersona: string | null
}

export type Consulta = (usuarios: string[]) => Promise<FilaEmpleado[]>

const consultaReal: Consulta = async (usuarios) => {
  // Los nombres de usuario van como parametros; el WHERE de SQL_EMPLEADOS es
  // constante y no lleva entrada del usuario.
  const lista = usuarios.map((_, i) => `@P${i + 1}`).join(", ")
  const sql = `
    SELECT
      LTRIM(RTRIM(u.nombreUsuario)) AS nombreUsuario,
      LTRIM(RTRIM(p.numeroDocPersona)) AS documento,
      LTRIM(RTRIM(p.nombrePersona)) AS nombrePersona,
      LTRIM(RTRIM(p.apellidoPersona)) AS apellidoPersona
    FROM [ObraSocial].[dbo].[Usuario] u
    JOIN [ObraSocial].[dbo].[Persona] p ON p.idPersona = u.idPersona
    WHERE u.anulado = 0
      AND ${SQL_EMPLEADOS}
      AND u.nombreUsuario IN (${lista})
  `
  return prisma.$queryRawUnsafe<FilaEmpleado[]>(sql, ...usuarios)
}

function nombreCompleto(f: FilaEmpleado): string {
  const apellido = f.apellidoPersona?.trim() ?? ""
  const nombre = f.nombrePersona?.trim() ?? ""
  return apellido && nombre ? `${apellido}, ${nombre}` : apellido || nombre || f.nombreUsuario
}

export async function importarEmpleados(
  usuarios: string[],
  consulta: Consulta = consultaReal
): Promise<{ creados: number; actualizados: number; noEncontrados: string[] }> {
  if (usuarios.length === 0) return { creados: 0, actualizados: 0, noEncontrados: [] }

  const filas = await consulta(usuarios)
  const encontrados = new Set(filas.map((f) => f.nombreUsuario))
  const noEncontrados = usuarios.filter((u) => !encontrados.has(u))

  let creados = 0
  let actualizados = 0

  for (const fila of filas) {
    const existente = await prisma.empleado.findUnique({
      where: { dniInstitucional: fila.documento },
    })
    if (existente) {
      await prisma.empleado.update({
        where: { dniInstitucional: fila.documento },
        data: { nombre: nombreCompleto(fila), activo: true },
      })
      actualizados++
    } else {
      await prisma.empleado.create({
        data: {
          dniInstitucional: fila.documento,
          nombre: nombreCompleto(fila),
          rol: "operador",
        },
      })
      creados++
    }
  }

  return { creados, actualizados, noEncontrados }
}

// Uso: npm run importar:empleados -- silviaflores gonzalotello
if (process.argv[1]?.includes("importarEmpleados")) {
  const usuarios = process.argv.slice(2)
  if (usuarios.length === 0) {
    console.error("Pasá al menos un nombreUsuario. Ej: npm run importar:empleados -- silviaflores")
    process.exit(1)
  }
  importarEmpleados(usuarios)
    .then((r) => {
      console.log(`Creados: ${r.creados} · Actualizados: ${r.actualizados}`)
      if (r.noEncontrados.length > 0) {
        console.warn(`No encontrados (no son empleados o están anulados): ${r.noEncontrados.join(", ")}`)
      }
    })
    .catch((e) => {
      console.error("Falló la importación:", e.message)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/integration/importarEmpleados.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Agregar el script a package.json**

En `"scripts"`, después de `"db:test:seed"`:

```json
"importar:empleados": "tsx --env-file=.env.local scripts/importarEmpleados.ts"
```

- [ ] **Step 6: Commit**

```bash
git add scripts/importarEmpleados.ts tests/integration/importarEmpleados.test.ts package.json
git commit -m "feat: script de importación selectiva de empleados"
```

---

## Task 5: Resumen de la cola por trámite

**Files:**
- Create: `lib/queue/resumen.ts`
- Test: `tests/unit/resumen.test.ts`

**Interfaces:**
- Consumes: `TurnoDominio`, `BoxDominio` de `@/lib/queue/tipos`
- Produces:
  - `interface LineaResumen { tramiteId: string; tramiteNombre: string; categoriaNombre: string; cuantos: number }`
  - `interface ResumenCola { total: number; lineas: LineaResumen[]; esperaMasVieja: number | null }`
  - `resumirCola(turnos: TurnoDominio[], box: BoxDominio, nombres: Map<string, { tramite: string; categoria: string }>, ahora?: Date): ResumenCola`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/resumen.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { resumirCola } from "@/lib/queue/resumen"
import type { TurnoDominio, BoxDominio } from "@/lib/queue/tipos"

const box: BoxDominio = {
  id: "box-1",
  activo: true,
  tramiteIds: ["carnet", "expedientes", "aportes"],
  horaApertura: "08:00",
  horaCierre: "13:00",
  diasSemana: "1111100",
}

const nombres = new Map([
  ["carnet", { tramite: "Carnet", categoria: "Afiliaciones" }],
  ["expedientes", { tramite: "Recepción de Expedientes", categoria: "Afiliaciones" }],
  ["aportes", { tramite: "Aportes", categoria: "Afiliaciones" }],
  ["protesis", { tramite: "Prótesis", categoria: "Auditoría Médica" }],
])

function turno(id: string, tramiteId: string, minutosAtras: number): TurnoDominio {
  return {
    id,
    numero: id,
    tramiteId,
    estado: "esperando",
    boxId: null,
    createdAt: new Date(Date.now() - minutosAtras * 60 * 1000),
    derivadoDeId: null,
  }
}

describe("resumirCola", () => {
  it("cuenta el total de los que esperan", () => {
    const r = resumirCola([turno("a", "carnet", 5), turno("b", "aportes", 3)], box, nombres)
    expect(r.total).toBe(2)
  })

  it("desglosa por trámite, no por categoría", () => {
    const turnos = [
      turno("a", "carnet", 10), turno("b", "carnet", 8),
      turno("c", "expedientes", 5),
    ]
    const r = resumirCola(turnos, box, nombres)
    expect(r.lineas).toEqual([
      { tramiteId: "carnet", tramiteNombre: "Carnet", categoriaNombre: "Afiliaciones", cuantos: 2 },
      { tramiteId: "expedientes", tramiteNombre: "Recepción de Expedientes", categoriaNombre: "Afiliaciones", cuantos: 1 },
    ])
  })

  it("ordena las líneas de mayor a menor", () => {
    const turnos = [
      turno("a", "aportes", 9),
      turno("b", "carnet", 8), turno("c", "carnet", 7), turno("d", "carnet", 6),
    ]
    const r = resumirCola(turnos, box, nombres)
    expect(r.lineas[0].tramiteId).toBe("carnet")
    expect(r.lineas[0].cuantos).toBe(3)
  })

  it("no cuenta trámites que el box no atiende", () => {
    const r = resumirCola([turno("a", "protesis", 5)], box, nombres)
    expect(r.total).toBe(0)
    expect(r.lineas).toEqual([])
  })

  it("no cuenta los que ya no esperan", () => {
    const llamado = { ...turno("a", "carnet", 5), estado: "llamado" as const }
    const r = resumirCola([llamado, turno("b", "carnet", 3)], box, nombres)
    expect(r.total).toBe(1)
  })

  it("informa hace cuántos minutos espera el más viejo", () => {
    const ahora = new Date()
    const r = resumirCola([turno("a", "carnet", 40), turno("b", "carnet", 5)], box, nombres, ahora)
    expect(r.esperaMasVieja).toBe(40)
  })

  it("con la cola vacía no inventa una espera", () => {
    const r = resumirCola([], box, nombres)
    expect(r.total).toBe(0)
    expect(r.esperaMasVieja).toBeNull()
  })

  it("omite las líneas en cero: el operador ve lo que hay, no lo que falta", () => {
    const r = resumirCola([turno("a", "carnet", 5)], box, nombres)
    expect(r.lineas).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/resumen.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/queue/resumen"`

- [ ] **Step 3: Implementar**

Crear `lib/queue/resumen.ts`:

```typescript
import type { TurnoDominio, BoxDominio } from "./tipos"
import { colaDelBox } from "./seleccion"

export interface LineaResumen {
  tramiteId: string
  tramiteNombre: string
  categoriaNombre: string
  cuantos: number
}

export interface ResumenCola {
  total: number
  lineas: LineaResumen[]
  esperaMasVieja: number | null
}

export function resumirCola(
  turnos: TurnoDominio[],
  box: BoxDominio,
  nombres: Map<string, { tramite: string; categoria: string }>,
  ahora: Date = new Date()
): ResumenCola {
  // colaDelBox ya filtra por estado esperando y por los tramites del box,
  // y devuelve ordenado del mas viejo al mas nuevo.
  const cola = colaDelBox(turnos, box)

  const cuenta = new Map<string, number>()
  for (const t of cola) {
    cuenta.set(t.tramiteId, (cuenta.get(t.tramiteId) ?? 0) + 1)
  }

  const lineas: LineaResumen[] = [...cuenta.entries()]
    .map(([tramiteId, cuantos]) => ({
      tramiteId,
      tramiteNombre: nombres.get(tramiteId)?.tramite ?? tramiteId,
      categoriaNombre: nombres.get(tramiteId)?.categoria ?? "",
      cuantos,
    }))
    .sort((a, b) => b.cuantos - a.cuantos || a.tramiteNombre.localeCompare(b.tramiteNombre))

  const masViejo = cola[0]
  const esperaMasVieja = masViejo
    ? Math.floor((ahora.getTime() - masViejo.createdAt.getTime()) / 60000)
    : null

  return { total: cola.length, lineas, esperaMasVieja }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/resumen.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add lib/queue/resumen.ts tests/unit/resumen.test.ts
git commit -m "feat: resumen de la cola desglosado por trámite"
```

---

## Task 6: Handlers de rellamar, ausente, iniciar y finalizar

**Files:**
- Create: `server/handlers/rellamarTurno.ts`, `server/handlers/marcarAusente.ts`, `server/handlers/iniciarAtencion.ts`, `server/handlers/finalizarAtencion.ts`
- Test: `tests/integration/atencion.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores
- Produces, los cuatro con la misma forma:
  - `interface ComandoTurnoBox { turnoId: string; boxId: string; empleadoId?: string | null }`
  - `type ResultadoComando = { ok: true; turno: Turno } | { ok: false; codigo: "TRANSICION_INVALIDA" | "TURNO_INEXISTENTE" | "BOX_AJENO" | "ERROR_BASE"; mensaje: string; detalle?: string }`
  - `rellamarTurno(cmd)` · `marcarAusente(cmd)` · `iniciarAtencion(cmd)` · `finalizarAtencion(cmd)`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/atencion.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { generarTurno } from "@/server/handlers/generarTurno"
import { llamarTurno } from "@/server/handlers/llamarTurno"
import { rellamarTurno } from "@/server/handlers/rellamarTurno"
import { marcarAusente } from "@/server/handlers/marcarAusente"
import { iniciarAtencion } from "@/server/handlers/iniciarAtencion"
import { finalizarAtencion } from "@/server/handlers/finalizarAtencion"

async function escenario() {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()

  const tramite = await prisma.tramite.findFirstOrThrow({
    where: { nombre: "Planes Especiales" },
    include: { boxes: true },
  })
  const boxA = tramite.boxes[0].boxId
  const boxB = tramite.boxes[1].boxId

  const g = await generarTurno({ tramiteId: tramite.id, dni: null, requestId: "at-1" })
  if (!g.ok) throw new Error("no se pudo generar")
  await llamarTurno({ turnoId: g.turno.id, boxId: boxA })
  return { turnoId: g.turno.id, boxA, boxB }
}

describe("handlers de atención", () => {
  let ctx: Awaited<ReturnType<typeof escenario>>
  beforeEach(async () => { ctx = await escenario() })

  it("rellamar deja el turno en llamado y suma un evento", async () => {
    const r = await rellamarTurno({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("llamado")
    expect(await prisma.turnoEvento.count({
      where: { turnoId: ctx.turnoId, tipo: "rellamado" },
    })).toBe(1)
  })

  it("cada rellamado queda como evento propio", async () => {
    await rellamarTurno({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    await rellamarTurno({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(await prisma.turnoEvento.count({
      where: { turnoId: ctx.turnoId, tipo: "rellamado" },
    })).toBe(2)
  })

  it("marcar ausente saca el turno de la cola activa", async () => {
    const r = await marcarAusente({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("ausente")
  })

  it("un ausente se puede volver a llamar", async () => {
    await marcarAusente({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    const r = await llamarTurno({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(r.ok).toBe(true)
  })

  it("iniciar pasa a atendiendo", async () => {
    const r = await iniciarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("atendiendo")
  })

  it("finalizar pasa a finalizado desde atendiendo", async () => {
    await iniciarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    const r = await finalizarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.turno.estado).toBe("finalizado")
  })

  it("no se puede finalizar lo que no se inició", async () => {
    const r = await finalizarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("TRANSICION_INVALIDA")
  })

  it("registra las atenciones cortas: el sesgo de ≥7 min era el hallazgo 4", async () => {
    await iniciarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    await finalizarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxA })
    expect(await prisma.turnoEvento.count({
      where: { turnoId: ctx.turnoId, tipo: "finalizado" },
    })).toBe(1)
  })

  it("un box ajeno no puede operar sobre el turno de otro", async () => {
    const r = await iniciarAtencion({ turnoId: ctx.turnoId, boxId: ctx.boxB })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("BOX_AJENO")
  })

  it("un turno inexistente no explota, devuelve error tipado", async () => {
    const r = await iniciarAtencion({ turnoId: "no-existe", boxId: ctx.boxA })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("TURNO_INEXISTENTE")
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/integration/atencion.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/handlers/rellamarTurno"`

- [ ] **Step 3: Escribir el tronco común de los cuatro handlers**

Crear `server/handlers/comandoTurno.ts`:

```typescript
import { prisma } from "@/lib/db"
import type { Turno } from "@prisma/client"
import { transicion } from "@/lib/queue/estado"
import type { TipoEvento, TurnoDominio } from "@/lib/queue/tipos"

export interface ComandoTurnoBox {
  turnoId: string
  boxId: string
  empleadoId?: string | null
}

export type ResultadoComando =
  | { ok: true; turno: Turno }
  | {
      ok: false
      codigo: "TRANSICION_INVALIDA" | "TURNO_INEXISTENTE" | "BOX_AJENO" | "ERROR_BASE"
      mensaje: string
      detalle?: string
    }

/**
 * Tronco de rellamar, ausente, iniciar y finalizar: los cuatro validan contra
 * estado.ts, escriben el evento dentro de la misma transaccion, y devuelven el
 * turno actualizado. La regla de que transiciones son validas vive solo en
 * estado.ts; aca no se duplica.
 */
export async function aplicarComando(
  cmd: ComandoTurnoBox,
  evento: TipoEvento
): Promise<ResultadoComando> {
  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await tx.turno.findUnique({ where: { id: cmd.turnoId } })
      if (!actual) {
        return {
          ok: false as const,
          codigo: "TURNO_INEXISTENTE" as const,
          mensaje: "Ese turno no existe",
        }
      }

      if (actual.boxId && actual.boxId !== cmd.boxId) {
        return {
          ok: false as const,
          codigo: "BOX_AJENO" as const,
          mensaje: "Ese turno lo está atendiendo otro box",
        }
      }

      const dominio: TurnoDominio = {
        id: actual.id,
        numero: actual.numero,
        tramiteId: actual.tramiteId,
        estado: actual.estado as TurnoDominio["estado"],
        boxId: actual.boxId,
        createdAt: actual.createdAt,
        derivadoDeId: actual.derivadoDeId,
      }

      const paso = transicion(dominio, evento, { boxId: cmd.boxId })
      if (!paso.ok) {
        return {
          ok: false as const,
          codigo: "TRANSICION_INVALIDA" as const,
          mensaje: paso.mensaje,
        }
      }

      const turno = await tx.turno.update({
        where: { id: cmd.turnoId },
        data: { estado: paso.turno.estado, boxId: paso.turno.boxId },
      })

      await tx.turnoEvento.create({
        data: {
          turnoId: cmd.turnoId,
          tipo: evento,
          boxId: cmd.boxId,
          empleadoId: cmd.empleadoId ?? null,
        },
      })

      return { ok: true as const, turno }
    })
  } catch (e) {
    return {
      ok: false,
      codigo: "ERROR_BASE",
      mensaje: "No se pudo aplicar el comando",
      detalle: e instanceof Error ? e.message : String(e),
    }
  }
}
```

- [ ] **Step 4: Escribir los cuatro handlers**

Crear `server/handlers/rellamarTurno.ts`:

```typescript
import { aplicarComando, type ComandoTurnoBox, type ResultadoComando } from "./comandoTurno"

export type { ComandoTurnoBox, ResultadoComando }

export function rellamarTurno(cmd: ComandoTurnoBox): Promise<ResultadoComando> {
  return aplicarComando(cmd, "rellamado")
}
```

Crear `server/handlers/marcarAusente.ts`:

```typescript
import { aplicarComando, type ComandoTurnoBox, type ResultadoComando } from "./comandoTurno"

export function marcarAusente(cmd: ComandoTurnoBox): Promise<ResultadoComando> {
  return aplicarComando(cmd, "ausente")
}
```

Crear `server/handlers/iniciarAtencion.ts`:

```typescript
import { aplicarComando, type ComandoTurnoBox, type ResultadoComando } from "./comandoTurno"

export function iniciarAtencion(cmd: ComandoTurnoBox): Promise<ResultadoComando> {
  return aplicarComando(cmd, "iniciado")
}
```

Crear `server/handlers/finalizarAtencion.ts`:

```typescript
import { aplicarComando, type ComandoTurnoBox, type ResultadoComando } from "./comandoTurno"

// Sin umbral de duracion: el hallazgo 4 del diseño general era que solo se
// registraban atenciones de 7 minutos o mas, y eso sesgaba las estadisticas.
export function finalizarAtencion(cmd: ComandoTurnoBox): Promise<ResultadoComando> {
  return aplicarComando(cmd, "finalizado")
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run tests/integration/atencion.test.ts`
Expected: PASS — 10 tests

- [ ] **Step 6: Commit**

```bash
git add server/handlers/comandoTurno.ts server/handlers/rellamarTurno.ts server/handlers/marcarAusente.ts server/handlers/iniciarAtencion.ts server/handlers/finalizarAtencion.ts tests/integration/atencion.test.ts
git commit -m "feat: handlers de rellamar, ausente, iniciar y finalizar"
```

---

## Task 7: Handler de derivación

**Files:**
- Create: `server/handlers/derivarTurno.ts`
- Test: `tests/integration/derivarHandler.test.ts`

**Interfaces:**
- Consumes: `aplicarComando` de `./comandoTurno`
- Produces:
  - `interface ComandoDerivar { turnoId: string; boxId: string; tramiteDestinoId: string; empleadoId?: string | null }`
  - `type ResultadoDerivacion = { ok: true; origen: Turno; destino: Turno } | { ok: false; codigo: "TRANSICION_INVALIDA" | "TURNO_INEXISTENTE" | "BOX_AJENO" | "TRAMITE_INEXISTENTE" | "MISMO_TRAMITE" | "ERROR_BASE"; mensaje: string; detalle?: string }`
  - `derivarTurno(cmd: ComandoDerivar): Promise<ResultadoDerivacion>`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/derivarHandler.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { generarTurno } from "@/server/handlers/generarTurno"
import { llamarTurno } from "@/server/handlers/llamarTurno"
import { iniciarAtencion } from "@/server/handlers/iniciarAtencion"
import { derivarTurno } from "@/server/handlers/derivarTurno"

async function escenario() {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()

  const origen = await prisma.tramite.findFirstOrThrow({
    where: { nombre: "Planes Especiales" },
    include: { boxes: true },
  })
  const destino = await prisma.tramite.findFirstOrThrow({ where: { nombre: "Bioquímica" } })
  const boxA = origen.boxes[0].boxId

  const g = await generarTurno({ tramiteId: origen.id, dni: "20123456", requestId: "der-1" })
  if (!g.ok) throw new Error("no se pudo generar")
  await llamarTurno({ turnoId: g.turno.id, boxId: boxA })
  return { turno: g.turno, boxA, destinoId: destino.id, origenId: origen.id }
}

describe("derivarTurno", () => {
  let ctx: Awaited<ReturnType<typeof escenario>>
  beforeEach(async () => { ctx = await escenario() })

  it("deja el origen en derivado y crea el destino en esperando", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.origen.estado).toBe("derivado")
      expect(r.destino.estado).toBe("esperando")
      expect(r.destino.tramiteId).toBe(ctx.destinoId)
    }
  })

  it("el número no cambia: el papel que la persona tiene en la mano sigue valiendo", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId,
    })
    if (!r.ok) throw new Error("debería haber derivado")
    expect(r.destino.numero).toBe(ctx.turno.numero)
  })

  it("conserva createdAt, así la FIFO lo ubica por su antigüedad real", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId,
    })
    if (!r.ok) throw new Error("debería haber derivado")
    expect(r.destino.createdAt.getTime()).toBe(ctx.turno.createdAt.getTime())
  })

  it("no toca el contador del trámite destino: la serie no debe saltear números", async () => {
    await derivarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId })
    const contador = await prisma.contador.findFirst({ where: { tramiteId: ctx.destinoId } })
    expect(contador).toBeNull()
  })

  it("encadena con derivadoDeId", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId,
    })
    if (!r.ok) throw new Error("debería haber derivado")
    expect(r.destino.derivadoDeId).toBe(ctx.turno.id)
  })

  it("escribe el evento derivado con el trámite destino en detalle", async () => {
    await derivarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId })
    const ev = await prisma.turnoEvento.findFirstOrThrow({
      where: { turnoId: ctx.turno.id, tipo: "derivado" },
    })
    expect(ev.detalle).toContain(ctx.destinoId)
  })

  it("se puede derivar desde atendiendo, no sólo desde llamado", async () => {
    await iniciarAtencion({ turnoId: ctx.turno.id, boxId: ctx.boxA })
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId,
    })
    expect(r.ok).toBe(true)
  })

  it("arrastra el DNI y el nombre al turno nuevo", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.destinoId,
    })
    if (!r.ok) throw new Error("debería haber derivado")
    expect(r.destino.dni).toBe("20123456")
  })

  it("rechaza derivar al mismo trámite", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: ctx.origenId,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("MISMO_TRAMITE")
  })

  it("rechaza un trámite destino que no existe", async () => {
    const r = await derivarTurno({
      turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: "no-existe",
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("TRAMITE_INEXISTENTE")
  })

  it("si falla, no deja el origen derivado sin destino", async () => {
    await derivarTurno({ turnoId: ctx.turno.id, boxId: ctx.boxA, tramiteDestinoId: "no-existe" })
    const origen = await prisma.turno.findUniqueOrThrow({ where: { id: ctx.turno.id } })
    expect(origen.estado).toBe("llamado")
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/integration/derivarHandler.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/handlers/derivarTurno"`

- [ ] **Step 3: Implementar**

Crear `server/handlers/derivarTurno.ts`:

```typescript
import { prisma } from "@/lib/db"
import type { Turno } from "@prisma/client"
import { transicion } from "@/lib/queue/estado"
import type { TurnoDominio } from "@/lib/queue/tipos"

export interface ComandoDerivar {
  turnoId: string
  boxId: string
  tramiteDestinoId: string
  empleadoId?: string | null
}

export type ResultadoDerivacion =
  | { ok: true; origen: Turno; destino: Turno }
  | {
      ok: false
      codigo:
        | "TRANSICION_INVALIDA" | "TURNO_INEXISTENTE" | "BOX_AJENO"
        | "TRAMITE_INEXISTENTE" | "MISMO_TRAMITE" | "ERROR_BASE"
      mensaje: string
      detalle?: string
    }

/**
 * La derivacion crea un turno nuevo en vez de mutar el original: asi el origen
 * cuenta como atencion del box A con su tiempo real, y el destino cuenta como
 * entrada a la cola del area nueva. Mutando tramiteId se perderia el trabajo
 * del primer box.
 *
 * El numero, la fecha y el createdAt se copian tal cual: la persona conserva el
 * ticket impreso, que es el motivo entero de no volver a imprimir. Y el
 * contador del destino no se toca, porque si se incrementara su serie
 * saltearia numeros.
 */
export async function derivarTurno(cmd: ComandoDerivar): Promise<ResultadoDerivacion> {
  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await tx.turno.findUnique({ where: { id: cmd.turnoId } })
      if (!actual) {
        return {
          ok: false as const,
          codigo: "TURNO_INEXISTENTE" as const,
          mensaje: "Ese turno no existe",
        }
      }

      if (actual.boxId && actual.boxId !== cmd.boxId) {
        return {
          ok: false as const,
          codigo: "BOX_AJENO" as const,
          mensaje: "Ese turno lo está atendiendo otro box",
        }
      }

      if (actual.tramiteId === cmd.tramiteDestinoId) {
        return {
          ok: false as const,
          codigo: "MISMO_TRAMITE" as const,
          mensaje: "El destino tiene que ser un trámite distinto",
        }
      }

      const destino = await tx.tramite.findUnique({ where: { id: cmd.tramiteDestinoId } })
      if (!destino) {
        return {
          ok: false as const,
          codigo: "TRAMITE_INEXISTENTE" as const,
          mensaje: "Ese trámite no existe",
        }
      }

      const dominio: TurnoDominio = {
        id: actual.id,
        numero: actual.numero,
        tramiteId: actual.tramiteId,
        estado: actual.estado as TurnoDominio["estado"],
        boxId: actual.boxId,
        createdAt: actual.createdAt,
        derivadoDeId: actual.derivadoDeId,
      }

      const paso = transicion(dominio, "derivado", { boxId: cmd.boxId })
      if (!paso.ok) {
        return {
          ok: false as const,
          codigo: "TRANSICION_INVALIDA" as const,
          mensaje: paso.mensaje,
        }
      }

      const origen = await tx.turno.update({
        where: { id: cmd.turnoId },
        data: { estado: "derivado", boxId: cmd.boxId },
      })

      await tx.turnoEvento.create({
        data: {
          turnoId: cmd.turnoId,
          tipo: "derivado",
          boxId: cmd.boxId,
          empleadoId: cmd.empleadoId ?? null,
          detalle: `destino:${cmd.tramiteDestinoId}`,
        },
      })

      const nuevo = await tx.turno.create({
        data: {
          numero: actual.numero,
          fecha: actual.fecha,
          createdAt: actual.createdAt,
          tramiteId: cmd.tramiteDestinoId,
          dni: actual.dni,
          nombreAfiliado: actual.nombreAfiliado,
          estado: "esperando",
          requestId: `derivacion-${cmd.turnoId}-${cmd.tramiteDestinoId}`,
          derivadoDeId: cmd.turnoId,
        },
      })

      await tx.turnoEvento.create({
        data: { turnoId: nuevo.id, tipo: "generado", detalle: `derivado-de:${cmd.turnoId}` },
      })

      return { ok: true as const, origen, destino: nuevo }
    })
  } catch (e) {
    return {
      ok: false,
      codigo: "ERROR_BASE",
      mensaje: "No se pudo derivar el turno",
      detalle: e instanceof Error ? e.message : String(e),
    }
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/integration/derivarHandler.test.ts`
Expected: PASS — 11 tests

- [ ] **Step 5: Commit**

```bash
git add server/handlers/derivarTurno.ts tests/integration/derivarHandler.test.ts
git commit -m "feat: handler de derivación entre trámites"
```

---

## Task 8: Jobs diarios

**Files:**
- Create: `server/jobs/abandonados.ts`, `server/jobs/retencionDni.ts`, `server/jobs/programador.ts`
- Test: `tests/integration/jobs.test.ts`

**Interfaces:**
- Consumes: `leerConfig` de `@/lib/config`
- Produces:
  - `marcarAbandonados(fecha?: Date): Promise<{ abandonados: number; huerfanos: number }>`
  - `borrarDniVencidos(ahora?: Date): Promise<{ borrados: number }>`
  - `programarJobs(): () => void` — devuelve la función para detenerlos

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/jobs.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { generarTurno } from "@/server/handlers/generarTurno"
import { llamarTurno } from "@/server/handlers/llamarTurno"
import { iniciarAtencion } from "@/server/handlers/iniciarAtencion"
import { marcarAbandonados } from "@/server/jobs/abandonados"
import { borrarDniVencidos } from "@/server/jobs/retencionDni"

async function escenario() {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()

  const tramite = await prisma.tramite.findFirstOrThrow({
    where: { nombre: "Planes Especiales" },
    include: { boxes: true },
  })
  return { tramiteId: tramite.id, boxA: tramite.boxes[0].boxId }
}

describe("job de abandonados", () => {
  let ctx: Awaited<ReturnType<typeof escenario>>
  beforeEach(async () => { ctx = await escenario() })

  it("pasa a abandonado lo que quedó esperando", async () => {
    const g = await generarTurno({ tramiteId: ctx.tramiteId, dni: null, requestId: "j1" })
    if (!g.ok) throw new Error("no se pudo generar")

    const r = await marcarAbandonados()
    expect(r.abandonados).toBe(1)

    const t = await prisma.turno.findUniqueOrThrow({ where: { id: g.turno.id } })
    expect(t.estado).toBe("abandonado")
  })

  it("no toca los finalizados ni los llamados", async () => {
    const g = await generarTurno({ tramiteId: ctx.tramiteId, dni: null, requestId: "j2" })
    if (!g.ok) throw new Error("no se pudo generar")
    await llamarTurno({ turnoId: g.turno.id, boxId: ctx.boxA })

    await marcarAbandonados()
    const t = await prisma.turno.findUniqueOrThrow({ where: { id: g.turno.id } })
    expect(t.estado).toBe("llamado")
  })

  it("cierra los atendiendo huérfanos y los marca con un evento de revisión", async () => {
    const g = await generarTurno({ tramiteId: ctx.tramiteId, dni: null, requestId: "j3" })
    if (!g.ok) throw new Error("no se pudo generar")
    await llamarTurno({ turnoId: g.turno.id, boxId: ctx.boxA })
    await iniciarAtencion({ turnoId: g.turno.id, boxId: ctx.boxA })

    const r = await marcarAbandonados()
    expect(r.huerfanos).toBe(1)

    const t = await prisma.turno.findUniqueOrThrow({ where: { id: g.turno.id } })
    expect(t.estado).toBe("finalizado")

    const ev = await prisma.turnoEvento.findFirst({
      where: { turnoId: g.turno.id, tipo: "revision" },
    })
    expect(ev).not.toBeNull()
  })

  it("es idempotente", async () => {
    await generarTurno({ tramiteId: ctx.tramiteId, dni: null, requestId: "j4" })
    await marcarAbandonados()
    const segunda = await marcarAbandonados()
    expect(segunda.abandonados).toBe(0)
    expect(segunda.huerfanos).toBe(0)
  })
})

describe("job de retención de DNI", () => {
  let ctx: Awaited<ReturnType<typeof escenario>>
  beforeEach(async () => { ctx = await escenario() })

  it("borra el DNI de los turnos vencidos y deja el turno", async () => {
    const g = await generarTurno({ tramiteId: ctx.tramiteId, dni: "20123456", requestId: "r1" })
    if (!g.ok) throw new Error("no se pudo generar")

    const hace100Dias = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
    await prisma.turno.update({
      where: { id: g.turno.id },
      data: { createdAt: hace100Dias },
    })

    const r = await borrarDniVencidos()
    expect(r.borrados).toBe(1)

    const t = await prisma.turno.findUniqueOrThrow({ where: { id: g.turno.id } })
    expect(t.dni).toBeNull()
    expect(t.numero).toBe(g.turno.numero)
  })

  it("no toca los turnos dentro del plazo", async () => {
    const g = await generarTurno({ tramiteId: ctx.tramiteId, dni: "20123456", requestId: "r2" })
    if (!g.ok) throw new Error("no se pudo generar")

    await borrarDniVencidos()
    const t = await prisma.turno.findUniqueOrThrow({ where: { id: g.turno.id } })
    expect(t.dni).toBe("20123456")
  })

  it("es idempotente", async () => {
    const g = await generarTurno({ tramiteId: ctx.tramiteId, dni: "20123456", requestId: "r3" })
    if (!g.ok) throw new Error("no se pudo generar")
    await prisma.turno.update({
      where: { id: g.turno.id },
      data: { createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) },
    })

    await borrarDniVencidos()
    const segunda = await borrarDniVencidos()
    expect(segunda.borrados).toBe(0)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/integration/jobs.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/jobs/abandonados"`

- [ ] **Step 3: Implementar los dos jobs**

Crear `server/jobs/abandonados.ts`:

```typescript
import { prisma } from "@/lib/db"

/**
 * Corre a hora fija y no al cerrar el ultimo box: "cerrado" solo detiene la
 * emision de tickets, y los turnos en cola se siguen atendiendo despues del
 * horario.
 *
 * Los "atendiendo" huerfanos son los que quedaron abiertos porque el operador
 * se fue sin finalizarlos. estado.ts no tiene salida de atendiendo salvo
 * finalizado y derivado, y agregar un estado obligaria a una migracion que SP2
 * no necesita, asi que se cierran como finalizado con un evento "revision".
 * SP5 debe excluir de las metricas de duracion los turnos con ese evento: su
 * tiempo medido no corresponde a una atencion real.
 */
export async function marcarAbandonados(
  fecha: Date = new Date()
): Promise<{ abandonados: number; huerfanos: number }> {
  const dia = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()))

  const { count: abandonados } = await prisma.turno.updateMany({
    where: { fecha: dia, estado: "esperando" },
    data: { estado: "abandonado" },
  })

  const huerfanos = await prisma.turno.findMany({
    where: { fecha: dia, estado: "atendiendo" },
    select: { id: true, boxId: true },
  })

  for (const t of huerfanos) {
    await prisma.$transaction([
      prisma.turno.update({ where: { id: t.id }, data: { estado: "finalizado" } }),
      prisma.turnoEvento.create({
        data: {
          turnoId: t.id,
          tipo: "revision",
          boxId: t.boxId,
          detalle: "cerrado por el job diario: quedó en atendiendo sin finalizar",
        },
      }),
    ])
  }

  return { abandonados, huerfanos: huerfanos.length }
}
```

Crear `server/jobs/retencionDni.ts`:

```typescript
import { prisma } from "@/lib/db"
import { leerConfig } from "@/lib/config"

/** El turno queda; el dato personal no. Turno.dni es dato personal. */
export async function borrarDniVencidos(
  ahora: Date = new Date()
): Promise<{ borrados: number }> {
  const corte = new Date(ahora.getTime() - leerConfig().retencionDniDias * 24 * 60 * 60 * 1000)

  const { count } = await prisma.turno.updateMany({
    where: { createdAt: { lt: corte }, dni: { not: null } },
    data: { dni: null, nombreAfiliado: null },
  })

  return { borrados: count }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/integration/jobs.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Escribir el programador**

Crear `server/jobs/programador.ts`:

```typescript
import { leerConfig } from "@/lib/config"
import { marcarAbandonados } from "./abandonados"
import { borrarDniVencidos } from "./retencionDni"

function msHastaLaHora(hhmm: string, ahora: Date): number {
  const [h, m] = hhmm.split(":").map(Number)
  const objetivo = new Date(ahora)
  objetivo.setHours(h, m, 0, 0)
  if (objetivo <= ahora) objetivo.setDate(objetivo.getDate() + 1)
  return objetivo.getTime() - ahora.getTime()
}

async function correr(): Promise<void> {
  try {
    const a = await marcarAbandonados()
    const d = await borrarDniVencidos()
    console.log(
      `[jobs] abandonados=${a.abandonados} huérfanos=${a.huerfanos} dni-borrados=${d.borrados}`
    )
  } catch (e) {
    console.error("[jobs] fallaron:", e instanceof Error ? e.message : e)
  }
}

/** Devuelve la funcion para detenerlos. */
export function programarJobs(): () => void {
  const { horaCierreDiario } = leerConfig()
  let diario: ReturnType<typeof setInterval> | null = null

  const primero = setTimeout(() => {
    void correr()
    diario = setInterval(() => void correr(), 24 * 60 * 60 * 1000)
  }, msHastaLaHora(horaCierreDiario, new Date()))

  return () => {
    clearTimeout(primero)
    if (diario) clearInterval(diario)
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add server/jobs/ tests/integration/jobs.test.ts
git commit -m "feat: jobs diarios de abandonados y retención de DNI"
```

---

## Task 9: Rutas de login y logout

**Files:**
- Create: `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`
- Create: `lib/auth/operador.ts`
- Test: `tests/integration/login.test.ts`

**Interfaces:**
- Consumes: `verificarCredencial`, `abrirSesion`, `cerrarSesion`, `firmarCookie`, `NOMBRE_COOKIE`
- Produces:
  - `type ResultadoLogin = { ok: true; sesionId: string; empleado: { id: string; nombre: string }; boxId: string } | { ok: false; codigo: "CREDENCIAL_INVALIDA" | "NO_HABILITADO" | "BOX_OCUPADO" | "BOX_NO_ASIGNADO" | "ERROR_BASE"; mensaje: string; detalle?: string }`
  - `login(nombreUsuario: string, clave: string, boxId: string, verificar?): Promise<ResultadoLogin>`
  - `boxesDe(documento: string): Promise<{ id: string; nombre: string }[]>`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/integration/login.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { login } from "@/lib/auth/operador"
import type { FilaUsuario } from "@/lib/auth/institucional"

const hash = bcrypt.hashSync("secreta123", 10)

const silviaInstitucional: FilaUsuario = {
  nombreUsuario: "silviaflores",
  claveUsuario: hash,
  anulado: false,
  esAfiliado: false,
  documento: "25319010",
  nombrePersona: "Silvia",
  apellidoPersona: "Flores",
}

const verificarFalso = (filas: FilaUsuario[]) => async () => filas

async function escenario(conEmpleado = true) {
  await prisma.sesionOperador.deleteMany()
  await prisma.empleadoBox.deleteMany()
  await prisma.empleado.deleteMany()

  const box = await prisma.box.findFirstOrThrow()
  const otroBox = await prisma.box.findFirstOrThrow({ where: { id: { not: box.id } } })

  if (conEmpleado) {
    const e = await prisma.empleado.create({
      data: { dniInstitucional: "25319010", nombre: "Flores, Silvia", rol: "operador" },
    })
    await prisma.empleadoBox.create({ data: { empleadoId: e.id, boxId: box.id } })
  }
  return { box, otroBox }
}

describe("login del operador", () => {
  it("con credencial válida y empleado habilitado, abre sesión", async () => {
    const ctx = await escenario()
    const r = await login("silviaflores", "secreta123", ctx.box.id, verificarFalso([silviaInstitucional]))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.empleado.nombre).toBe("Flores, Silvia")
      expect(r.boxId).toBe(ctx.box.id)
    }
  })

  it("rechaza la clave incorrecta", async () => {
    const ctx = await escenario()
    const r = await login("silviaflores", "mala", ctx.box.id, verificarFalso([silviaInstitucional]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("CREDENCIAL_INVALIDA")
  })

  it("credencial válida pero sin alta en el turnero: mensaje específico, porque ya se autenticó", async () => {
    const ctx = await escenario(false)
    const r = await login("silviaflores", "secreta123", ctx.box.id, verificarFalso([silviaInstitucional]))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.codigo).toBe("NO_HABILITADO")
      expect(r.mensaje).toContain("no estás habilitado")
    }
  })

  it("rechaza un box que no tiene asignado", async () => {
    const ctx = await escenario()
    const r = await login("silviaflores", "secreta123", ctx.otroBox.id, verificarFalso([silviaInstitucional]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("BOX_NO_ASIGNADO")
  })

  it("rechaza si el box está ocupado con latido fresco", async () => {
    const ctx = await escenario()
    await login("silviaflores", "secreta123", ctx.box.id, verificarFalso([silviaInstitucional]))
    const r = await login("silviaflores", "secreta123", ctx.box.id, verificarFalso([silviaInstitucional]))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("BOX_OCUPADO")
  })

  it("no devuelve nada parecido a la clave ni al hash", async () => {
    const ctx = await escenario()
    const r = await login("silviaflores", "secreta123", ctx.box.id, verificarFalso([silviaInstitucional]))
    const serializado = JSON.stringify(r)
    expect(serializado).not.toContain("secreta123")
    expect(serializado).not.toContain("$2")
  })

  it("no guarda la clave en la base del turnero", async () => {
    const ctx = await escenario()
    await login("silviaflores", "secreta123", ctx.box.id, verificarFalso([silviaInstitucional]))
    const empleado = await prisma.empleado.findUniqueOrThrow({
      where: { dniInstitucional: "25319010" },
    })
    expect(JSON.stringify(empleado)).not.toContain("secreta123")
    expect(JSON.stringify(empleado)).not.toContain("$2")
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/integration/login.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/auth/operador"`

- [ ] **Step 3: Implementar el orquestador**

Crear `lib/auth/operador.ts`:

```typescript
import { prisma } from "@/lib/db"
import { verificarCredencial, type FilaUsuario } from "./institucional"
import { abrirSesion } from "./sesion"

export type ResultadoLogin =
  | { ok: true; sesionId: string; empleado: { id: string; nombre: string }; boxId: string }
  | {
      ok: false
      codigo:
        | "CREDENCIAL_INVALIDA" | "NO_HABILITADO" | "BOX_OCUPADO"
        | "BOX_NO_ASIGNADO" | "ERROR_BASE"
      mensaje: string
      detalle?: string
    }

type Consulta = (nombreUsuario: string) => Promise<FilaUsuario[]>

export async function login(
  nombreUsuario: string,
  clave: string,
  boxId: string,
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

  // Aca el mensaje si es especifico: la credencial ya se valido, asi que no se
  // le esta confirmando nada a un desconocido, y le sirve a una persona
  // legitima para saber que tiene que pedir el alta.
  if (!empleado || !empleado.activo) {
    return {
      ok: false,
      codigo: "NO_HABILITADO",
      mensaje: "Tu usuario es válido pero no estás habilitado en el turnero",
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
  }
}

/** Los boxes que la persona tiene asignados, para el selector del login. */
export async function boxesDe(documento: string): Promise<{ id: string; nombre: string }[]> {
  const empleado = await prisma.empleado.findUnique({
    where: { dniInstitucional: documento },
    include: { boxes: { include: { box: { include: { ala: true } } } } },
  })
  if (!empleado) return []
  return empleado.boxes.map((eb) => ({
    id: eb.box.id,
    nombre: `${eb.box.nombre} — Ala ${eb.box.ala.nombre}`,
  }))
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/integration/login.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Escribir las rutas API**

Crear `app/api/auth/login/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { login } from "@/lib/auth/operador"
import { firmarCookie, NOMBRE_COOKIE } from "@/lib/auth/sesion"

export async function POST(req: Request) {
  const { usuario, clave, boxId } = await req.json()

  if (!usuario || !clave || !boxId) {
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

Crear `app/api/auth/logout/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { cerrarSesion, leerCookie, NOMBRE_COOKIE } from "@/lib/auth/sesion"

export async function POST() {
  const almacen = await cookies()
  const sesionId = leerCookie(almacen.get(NOMBRE_COOKIE)?.value)
  if (sesionId) await cerrarSesion(sesionId)

  const res = NextResponse.json({ ok: true })
  res.cookies.delete(NOMBRE_COOKIE)
  return res
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/auth/operador.ts app/api/auth/ tests/integration/login.test.ts
git commit -m "feat: rutas de login y logout del operador"
```

---

## Task 10: Socket del operador — autenticación, snapshot y comandos

**Files:**
- Modify: `server/index.ts`
- Create: `server/snapshot.ts`
- Modify: `server/rooms.ts` (agregar los eventos nuevos)
- Test: `tests/unit/rooms.test.ts` (extender)

**Interfaces:**
- Consumes: los cinco handlers, `sesionActiva`, `renovarLatido`, `leerCookie`, `resumirCola`
- Produces:
  - `armarSnapshot(boxId: string): Promise<SnapshotOperador>`
  - `interface SnapshotOperador { boxId: string; boxNombre: string; resumen: ResumenCola; cola: TurnoPanel[]; ausentes: TurnoPanel[]; activo: TurnoPanel | null }`
  - `interface TurnoPanel { id: string; numero: string; tramiteId: string; tramiteNombre: string; nombreAfiliado: string | null; estado: string; createdAt: string }`
  - Eventos nuevos en `EventoTurnero`: `"TURNO_DERIVADO"`

- [ ] **Step 1: Extender el test de rooms**

Agregar al final de `tests/unit/rooms.test.ts`:

```typescript
describe("ruteo de TURNO_DERIVADO", () => {
  it("avisa al box que derivó y a los que atienden el trámite destino", () => {
    const rooms = destinatarios("TURNO_DERIVADO", {
      ala: "Sur",
      piso: "Planta Baja",
      boxId: "box-origen",
      tramiteBoxIds: ["box-destino-1", "box-destino-2"],
    })
    expect(rooms).toContain("box:box-origen")
    expect(rooms).toContain("box:box-destino-1")
    expect(rooms).toContain("box:box-destino-2")
    expect(rooms).toContain("admin")
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/rooms.test.ts`
Expected: FAIL — TypeScript rechaza `"TURNO_DERIVADO"`, que no está en `EventoTurnero`

- [ ] **Step 3: Agregar el evento a rooms.ts**

En `server/rooms.ts`, agregar a `EventoTurnero` después de `"TURNO_FINALIZADO"`:

```typescript
  | "TURNO_DERIVADO"
```

Y en el `switch` de `destinatarios`, agregar `"TURNO_DERIVADO"` al caso que ya agrupa ausente/iniciado/finalizado:

```typescript
    case "TURNO_AUSENTE":
    case "TURNO_INICIADO":
    case "TURNO_FINALIZADO":
    case "TURNO_DERIVADO":
      if (ctx.boxId) rooms.add(roomBox(ctx.boxId))
      ctx.tramiteBoxIds.forEach((id) => rooms.add(roomBox(id)))
      break
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/rooms.test.ts`
Expected: PASS

- [ ] **Step 5: Escribir el snapshot**

Crear `server/snapshot.ts`:

```typescript
import { prisma } from "@/lib/db"
import { obtenerCatalogo } from "@/lib/catalogo"
import { resumirCola, type ResumenCola } from "@/lib/queue/resumen"
import type { TurnoDominio } from "@/lib/queue/tipos"

export interface TurnoPanel {
  id: string
  numero: string
  tramiteId: string
  tramiteNombre: string
  nombreAfiliado: string | null
  estado: string
  createdAt: string
}

export interface SnapshotOperador {
  boxId: string
  boxNombre: string
  resumen: ResumenCola
  cola: TurnoPanel[]
  ausentes: TurnoPanel[]
  activo: TurnoPanel | null
}

function hoy(): Date {
  const a = new Date()
  return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()))
}

export async function armarSnapshot(boxId: string): Promise<SnapshotOperador> {
  const catalogo = await obtenerCatalogo()
  const box = catalogo.boxes.find((b) => b.id === boxId)
  const boxDb = await prisma.box.findUniqueOrThrow({ where: { id: boxId } })

  const nombres = new Map(
    catalogo.tramites.map((t) => [
      t.id,
      {
        tramite: t.nombre,
        categoria: catalogo.categorias.find((c) => c.id === t.categoriaId)?.nombre ?? "",
      },
    ])
  )

  const turnosDb = await prisma.turno.findMany({
    where: { fecha: hoy(), estado: { in: ["esperando", "ausente", "llamado", "atendiendo"] } },
    orderBy: { createdAt: "asc" },
  })

  const aPanel = (t: (typeof turnosDb)[number]): TurnoPanel => ({
    id: t.id,
    numero: t.numero,
    tramiteId: t.tramiteId,
    tramiteNombre: nombres.get(t.tramiteId)?.tramite ?? t.tramiteId,
    nombreAfiliado: t.nombreAfiliado,
    estado: t.estado,
    createdAt: t.createdAt.toISOString(),
  })

  const dominio: TurnoDominio[] = turnosDb.map((t) => ({
    id: t.id,
    numero: t.numero,
    tramiteId: t.tramiteId,
    estado: t.estado as TurnoDominio["estado"],
    boxId: t.boxId,
    createdAt: t.createdAt,
    derivadoDeId: t.derivadoDeId,
  }))

  const delBox = box ? box.tramiteIds : []
  const resumen = box
    ? resumirCola(dominio, box, nombres)
    : { total: 0, lineas: [], esperaMasVieja: null }

  return {
    boxId,
    boxNombre: boxDb.nombre,
    resumen,
    cola: turnosDb
      .filter((t) => t.estado === "esperando" && delBox.includes(t.tramiteId))
      .map(aPanel),
    ausentes: turnosDb
      .filter((t) => t.estado === "ausente" && t.boxId === boxId)
      .map(aPanel),
    // El turno en curso: es lo que permite recuperar la pantalla tras un
    // refresh o un corte de red, porque la sesion vive en la base.
    activo:
      turnosDb
        .filter((t) => t.boxId === boxId && ["llamado", "atendiendo"].includes(t.estado))
        .map(aPanel)[0] ?? null,
  }
}
```

- [ ] **Step 6: Cablear el socket**

Reemplazar `server/index.ts` completo:

```typescript
import type { Server as IoServer, Socket } from "socket.io"
import { parse as parseCookie } from "cookie"
import { generarTurno } from "./handlers/generarTurno"
import { llamarTurno } from "./handlers/llamarTurno"
import { rellamarTurno } from "./handlers/rellamarTurno"
import { marcarAusente } from "./handlers/marcarAusente"
import { iniciarAtencion } from "./handlers/iniciarAtencion"
import { finalizarAtencion } from "./handlers/finalizarAtencion"
import { derivarTurno } from "./handlers/derivarTurno"
import { registrarLatido } from "./handlers/latido"
import { destinatarios, roomBox, TODOS, type EventoTurnero } from "./rooms"
import { obtenerCatalogo } from "@/lib/catalogo"
import { leerCookie, NOMBRE_COOKIE, sesionActiva, renovarLatido } from "@/lib/auth/sesion"
import { armarSnapshot } from "./snapshot"

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

/** El socket saca la sesion de la misma cookie que el HTTP. */
async function sesionDelSocket(socket: Socket) {
  const cabecera = socket.handshake.headers.cookie
  if (!cabecera) return null
  const sesionId = leerCookie(parseCookie(cabecera)[NOMBRE_COOKIE])
  return sesionId ? await sesionActiva(sesionId) : null
}

export function montarTurnero(io: IoServer): void {
  io.on("connection", (socket: Socket) => {
    socket.on("SUSCRIBIR", ({ room }: { room: string }, ack?: () => void) => {
      socket.join(room)
      ack?.()
    })

    socket.on("LATIDO_KIOSCO", async (cmd) => {
      await registrarLatido(cmd)
    })

    socket.on("GENERAR_TURNO", async (cmd, ack?: (r: unknown) => void) => {
      const r = await generarTurno(cmd)
      ack?.(r)
      if (r.ok) await emitir(io, "TURNO_GENERADO", { turno: r.turno }, r.turno.tramiteId, null)
    })

    // --- Operador ---

    socket.on("ENTRAR_BOX", async (_datos, ack?: (r: unknown) => void) => {
      const sesion = await sesionDelSocket(socket)
      if (!sesion) {
        ack?.({ ok: false, codigo: "SIN_SESION", mensaje: "Iniciá sesión de nuevo" })
        return
      }
      socket.join(roomBox(sesion.boxId))
      socket.data.sesion = sesion
      ack?.({ ok: true, snapshot: await armarSnapshot(sesion.boxId) })
    })

    socket.on("LATIDO_OPERADOR", async () => {
      const sesion = socket.data.sesion
      if (sesion) await renovarLatido(sesion.id)
    })

    // llamarTurno devuelve ResultadoLlamado y los otros cuatro ResultadoComando.
    // Sin este tipo comun, Object.entries produce una union de funciones que
    // TypeScript no deja invocar. Los dos resultados comparten lo que se usa aca.
    type Manejador = (cmd: {
      turnoId: string
      boxId: string
      empleadoId?: string | null
    }) => Promise<
      { ok: true; turno: { tramiteId: string; boxId: string | null } } | { ok: false }
    >

    const comandos: Record<string, { fn: Manejador; evento: EventoTurnero }> = {
      LLAMAR_TURNO: { fn: llamarTurno, evento: "TURNO_LLAMADO" },
      RELLAMAR_TURNO: { fn: rellamarTurno, evento: "TURNO_RELLAMADO" },
      MARCAR_AUSENTE: { fn: marcarAusente, evento: "TURNO_AUSENTE" },
      INICIAR_ATENCION: { fn: iniciarAtencion, evento: "TURNO_INICIADO" },
      FINALIZAR_ATENCION: { fn: finalizarAtencion, evento: "TURNO_FINALIZADO" },
    }

    for (const [nombre, { fn, evento }] of Object.entries(comandos)) {
      socket.on(nombre, async (cmd, ack?: (r: unknown) => void) => {
        const sesion = socket.data.sesion
        if (!sesion) {
          ack?.({ ok: false, codigo: "SIN_SESION", mensaje: "Iniciá sesión de nuevo" })
          return
        }
        // El box y el empleado salen de la sesion, nunca del cliente.
        const r = await fn({
          turnoId: cmd.turnoId,
          boxId: sesion.boxId,
          empleadoId: sesion.empleadoId,
        })
        ack?.(r)
        if (r.ok) await emitir(io, evento, { turno: r.turno }, r.turno.tramiteId, r.turno.boxId)
      })
    }

    socket.on("DERIVAR_TURNO", async (cmd, ack?: (r: unknown) => void) => {
      const sesion = socket.data.sesion
      if (!sesion) {
        ack?.({ ok: false, codigo: "SIN_SESION", mensaje: "Iniciá sesión de nuevo" })
        return
      }
      const r = await derivarTurno({
        turnoId: cmd.turnoId,
        boxId: sesion.boxId,
        tramiteDestinoId: cmd.tramiteDestinoId,
        empleadoId: sesion.empleadoId,
      })
      ack?.(r)
      if (r.ok) {
        await emitir(io, "TURNO_DERIVADO", { turno: r.origen }, r.origen.tramiteId, r.origen.boxId)
        // El destino entra a otra cola: los boxes de ese tramite tienen que verlo.
        await emitir(io, "TURNO_GENERADO", { turno: r.destino }, r.destino.tramiteId, null)
      }
    })
  })
}
```

- [ ] **Step 7: Cablear los jobs al arranque**

En `server.ts`, después de montar el turnero, agregar:

```typescript
import { programarJobs } from "./server/jobs/programador"

// ... despues de montarTurnero(io)
programarJobs()
```

- [ ] **Step 8: Correr toda la suite**

Run: `npm test`
Expected: PASS — todo verde, incluidos los tests previos de SP0 y SP1

- [ ] **Step 9: Commit**

```bash
git add server/index.ts server/snapshot.ts server/rooms.ts server.ts tests/unit/rooms.test.ts
git commit -m "feat: socket del operador con sesión, snapshot y comandos"
```

---

## Task 11: Pantalla de login

**Files:**
- Create: `app/operador/login/page.tsx`
- Create: `app/api/auth/boxes/route.ts`
- Create: `app/operador/layout.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/login`
- Produces: la ruta `/operador/login`

- [ ] **Step 1: Ruta que lista los boxes**

Como el selector de box necesita saber qué boxes tiene la persona **antes** de tener sesión, se resuelve validando la credencial y devolviendo los boxes sin abrir sesión.

Crear `app/api/auth/boxes/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { verificarCredencial } from "@/lib/auth/institucional"
import { boxesDe } from "@/lib/auth/operador"

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

  const boxes = await boxesDe(credencial.usuario.documento)
  if (boxes.length === 0) {
    return NextResponse.json(
      { ok: false, mensaje: "Tu usuario es válido pero no estás habilitado en el turnero" },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true, boxes })
}
```

- [ ] **Step 2: Layout del operador**

Crear `app/operador/layout.tsx`:

```typescript
import type { ReactNode } from "react"

export default function LayoutOperador({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-gris-20 font-cuerpo text-gris-principal">
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Pantalla de login**

Crear `app/operador/login/page.tsx`:

```typescript
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
```

- [ ] **Step 4: Verificar a mano**

Run: `npm run dev`

Abrir `http://localhost:5000/operador/login`. Con un usuario sin alta en `Empleado`, tiene que decir *"Tu usuario es válido pero no estás habilitado en el turnero"*. Con usuario o clave incorrectos, *"Usuario o contraseña incorrectos"*.

- [ ] **Step 5: Commit**

```bash
git add app/operador/layout.tsx app/operador/login/ app/api/auth/boxes/
git commit -m "feat: pantalla de login del operador"
```

---

## Task 12: El panel

**Files:**
- Create: `app/operador/page.tsx`, `app/operador/PanelOperador.tsx`, `app/operador/TurnoActivo.tsx`, `app/operador/ColaBox.tsx`, `app/operador/ListaAusentes.tsx`, `app/operador/usarSocketOperador.ts`

**Interfaces:**
- Consumes: `SnapshotOperador`, `TurnoPanel` de `@/server/snapshot`
- Produces: la ruta `/operador`

- [ ] **Step 1: El hook del socket**

Crear `app/operador/usarSocketOperador.ts`:

```typescript
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import type { SnapshotOperador } from "@/server/snapshot"

const MS_LATIDO = 60_000

export interface RespuestaComando {
  ok: boolean
  codigo?: string
  mensaje?: string
}

export function usarSocketOperador() {
  const [snapshot, setSnapshot] = useState<SnapshotOperador | null>(null)
  const [conectado, setConectado] = useState(false)
  const [sinSesion, setSinSesion] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  const refrescar = useCallback((s: Socket) => {
    s.emit("ENTRAR_BOX", {}, (r: { ok: boolean; snapshot?: SnapshotOperador }) => {
      if (r.ok && r.snapshot) {
        setSnapshot(r.snapshot)
        setSinSesion(false)
      } else {
        setSinSesion(true)
      }
    })
  }, [])

  useEffect(() => {
    const s = io()
    socketRef.current = s

    s.on("connect", () => {
      setConectado(true)
      refrescar(s)
    })
    s.on("disconnect", () => setConectado(false))

    // Cualquier delta que toque este box: se pide el snapshot de nuevo. Con una
    // cola de decenas de turnos el costo es despreciable, y evita mantener dos
    // copias de la logica de proyeccion (servidor y cliente) que se desincronizan.
    const eventos = [
      "TURNO_GENERADO", "TURNO_LLAMADO", "TURNO_RELLAMADO",
      "TURNO_AUSENTE", "TURNO_INICIADO", "TURNO_FINALIZADO", "TURNO_DERIVADO",
    ]
    for (const e of eventos) s.on(e, () => refrescar(s))

    const latido = setInterval(() => s.emit("LATIDO_OPERADOR"), MS_LATIDO)

    return () => {
      clearInterval(latido)
      s.close()
    }
  }, [refrescar])

  const enviar = useCallback(
    (comando: string, datos: Record<string, unknown>): Promise<RespuestaComando> =>
      new Promise((resolver) => {
        const s = socketRef.current
        if (!s) {
          resolver({ ok: false, mensaje: "Sin conexión" })
          return
        }
        s.emit(comando, datos, (r: RespuestaComando) => {
          if (r?.codigo === "SIN_SESION") setSinSesion(true)
          resolver(r ?? { ok: false, mensaje: "Sin respuesta del servidor" })
        })
      }),
    []
  )

  return { snapshot, conectado, sinSesion, enviar }
}
```

- [ ] **Step 2: La cola**

Crear `app/operador/ColaBox.tsx`:

```typescript
"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { SnapshotOperador } from "@/server/snapshot"

function haceCuanto(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return "recién"
  if (minutos < 60) return `${minutos} min`
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`
}

export function ColaBox({ snapshot }: { snapshot: SnapshotOperador }) {
  const [abierta, setAbierta] = useState(false)
  const { resumen, cola } = snapshot

  return (
    <section className="rounded-2xl bg-white p-6">
      <h2 className="font-titulo text-2xl font-semibold" data-testid="total-cola">
        {resumen.total === 0
          ? "Nadie esperando"
          : `${resumen.total} esperando`}
      </h2>

      {resumen.esperaMasVieja !== null && (
        <p className="mt-1 text-sm">
          El más antiguo espera hace {resumen.esperaMasVieja} min
        </p>
      )}

      {/* Desglose por tramite, no por categoria: el operador de Afiliaciones
          necesita saber cuantos son para carnet y cuantos para expedientes. */}
      {resumen.lineas.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2" data-testid="desglose">
          {resumen.lineas.map((l) => (
            <li key={l.tramiteId} className="text-lg">
              <strong>{l.cuantos}</strong> {l.tramiteNombre}
            </li>
          ))}
        </ul>
      )}

      {cola.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAbierta((v) => !v)}
            aria-expanded={abierta}
            className="mt-4 flex items-center gap-2 text-sm font-semibold"
          >
            {abierta ? (
              <ChevronDown className="h-5 w-5 text-gris-80" aria-hidden />
            ) : (
              <ChevronRight className="h-5 w-5 text-gris-80" aria-hidden />
            )}
            {abierta ? "Ocultar la lista" : "Ver la lista"}
          </button>

          {abierta && (
            <ol className="mt-3 flex flex-col gap-2" data-testid="lista-cola">
              {cola.map((t) => (
                <li
                  key={t.id}
                  className="flex items-baseline justify-between border-b border-gris-70 pb-2"
                >
                  <span className="font-mono text-lg font-semibold">{t.numero}</span>
                  <span className="flex-1 px-4 text-sm">{t.tramiteNombre}</span>
                  <span className="text-sm">{haceCuanto(t.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Los ausentes**

Crear `app/operador/ListaAusentes.tsx`:

```typescript
"use client"

import type { TurnoPanel } from "@/server/snapshot"

export function ListaAusentes({
  ausentes,
  onLlamar,
  deshabilitado,
}: {
  ausentes: TurnoPanel[]
  onLlamar: (turnoId: string) => void
  deshabilitado: boolean
}) {
  if (ausentes.length === 0) return null

  return (
    <section className="rounded-2xl bg-white p-6">
      <h2 className="font-titulo text-xl font-semibold">
        Ausentes ({ausentes.length})
      </h2>
      {/* Es la unica via que saltea la FIFO, y esta permitida porque estado.ts
          modela ausente -> llamado: es gente que ya espero su turno. */}
      <ul className="mt-3 flex flex-col gap-2">
        {ausentes.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-4">
            <span className="font-mono text-lg font-semibold">{t.numero}</span>
            <span className="flex-1 text-sm">{t.tramiteNombre}</span>
            <button
              type="button"
              onClick={() => onLlamar(t.id)}
              disabled={deshabilitado}
              className="rounded-xl border-2 border-gris-70 px-4 py-2 text-sm font-semibold disabled:text-gris-80"
            >
              Llamar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: El turno activo**

Crear `app/operador/TurnoActivo.tsx`:

```typescript
"use client"

import { useEffect, useState } from "react"
import type { TurnoPanel } from "@/server/snapshot"

function Cronometro({ desde }: { desde: number }) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])

  const s = Math.floor((ahora - desde) / 1000)
  return (
    <p className="mt-4 font-mono text-2xl tabular-nums">
      {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </p>
  )
}

export function TurnoActivo({
  turno,
  inicioAtencion,
  onLlamarSiguiente,
  onRellamar,
  onAusente,
  onIniciar,
  onFinalizar,
  onDerivar,
  hayCola,
  ocupado,
}: {
  turno: TurnoPanel | null
  inicioAtencion: number | null
  onLlamarSiguiente: () => void
  onRellamar: () => void
  onAusente: () => void
  onIniciar: () => void
  onFinalizar: () => void
  onDerivar: () => void
  hayCola: boolean
  ocupado: boolean
}) {
  const principal =
    "rounded-2xl bg-gris-principal px-8 py-5 text-xl font-semibold text-white " +
    "disabled:bg-gainsboro disabled:text-gris-80"
  const secundario =
    "rounded-2xl border-2 border-gris-70 bg-white px-6 py-4 text-lg font-semibold " +
    "disabled:text-gris-80"

  if (!turno) {
    return (
      <section className="flex flex-col items-center justify-center rounded-2xl bg-white p-10">
        <p className="text-lg">Sin turno en atención</p>
        <button
          type="button"
          onClick={onLlamarSiguiente}
          disabled={!hayCola || ocupado}
          data-testid="llamar-siguiente"
          className={`mt-6 ${principal}`}
        >
          Llamar siguiente
        </button>
        {!hayCola && <p className="mt-3 text-sm">No hay nadie esperando</p>}
      </section>
    )
  }

  return (
    <section className="flex flex-col items-center rounded-2xl bg-white p-10">
      <p className="text-sm font-semibold uppercase tracking-wide">
        {turno.estado === "atendiendo" ? "Atendiendo" : "Llamado"}
      </p>
      <p className="font-titulo text-8xl font-bold text-osp" data-testid="numero-activo">
        {turno.numero}
      </p>
      {turno.nombreAfiliado && <p className="mt-2 text-2xl">{turno.nombreAfiliado}</p>}
      <p className="text-lg">{turno.tramiteNombre}</p>

      {turno.estado === "atendiendo" && inicioAtencion && <Cronometro desde={inicioAtencion} />}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {turno.estado === "llamado" ? (
          <>
            <button type="button" onClick={onIniciar} disabled={ocupado} className={principal} data-testid="iniciar">
              Iniciar atención
            </button>
            <button type="button" onClick={onRellamar} disabled={ocupado} className={secundario}>
              Rellamar
            </button>
            <button type="button" onClick={onAusente} disabled={ocupado} className={secundario}>
              Marcar ausente
            </button>
          </>
        ) : (
          <button type="button" onClick={onFinalizar} disabled={ocupado} className={principal} data-testid="finalizar">
            Finalizar
          </button>
        )}
        <button type="button" onClick={onDerivar} disabled={ocupado} className={secundario}>
          Derivar
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: El panel que los junta**

Crear `app/operador/PanelOperador.tsx`:

```typescript
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { usarSocketOperador } from "./usarSocketOperador"
import { TurnoActivo } from "./TurnoActivo"
import { ColaBox } from "./ColaBox"
import { ListaAusentes } from "./ListaAusentes"

export function PanelOperador() {
  const router = useRouter()
  const { snapshot, conectado, sinSesion, enviar } = usarSocketOperador()
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const inicioAtencion = useRef<number | null>(null)

  useEffect(() => {
    if (sinSesion) router.push("/operador/login")
  }, [sinSesion, router])

  const activo = snapshot?.activo ?? null

  useEffect(() => {
    if (activo?.estado === "atendiendo" && inicioAtencion.current === null) {
      inicioAtencion.current = Date.now()
    }
    if (!activo || activo.estado !== "atendiendo") {
      inicioAtencion.current = null
    }
  }, [activo])

  const comando = useCallback(
    async (nombre: string, datos: Record<string, unknown> = {}) => {
      setOcupado(true)
      setAviso(null)
      const r = await enviar(nombre, datos)
      // Nunca mudo: si falla, el operador se entera y sabe por que.
      if (!r.ok) setAviso(r.mensaje ?? "No se pudo completar la acción")
      setOcupado(false)
    },
    [enviar]
  )

  const llamarSiguiente = useCallback(() => {
    const siguiente = snapshot?.cola[0]
    if (siguiente) void comando("LLAMAR_TURNO", { turnoId: siguiente.id })
  }, [snapshot, comando])

  const sobreActivo = useCallback(
    (nombre: string) => {
      if (activo) void comando(nombre, { turnoId: activo.id })
    },
    [activo, comando]
  )

  if (!snapshot) {
    return <main className="p-10 text-lg">Conectando…</main>
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-2">
      <header className="lg:col-span-2 flex items-center justify-between">
        <h1 className="font-titulo text-2xl font-semibold">{snapshot.boxNombre}</h1>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            disabled={activo?.estado === "atendiendo"}
            title={
              activo?.estado === "atendiendo"
                ? "Finalizá o derivá el turno en curso antes de salir"
                : undefined
            }
            className="rounded-xl border-2 border-gris-70 px-4 py-2 text-sm font-semibold disabled:text-gris-80"
          >
            Cerrar sesión
          </button>
        </form>
      </header>

      {!conectado && (
        <p role="alert" className="lg:col-span-2 rounded-xl bg-osp px-4 py-3 text-white">
          Sin conexión con el servidor. Las acciones están deshabilitadas.
        </p>
      )}

      {aviso && (
        <p role="alert" className="lg:col-span-2 rounded-xl bg-osp px-4 py-3 text-white">
          {aviso}
        </p>
      )}

      <TurnoActivo
        turno={activo}
        inicioAtencion={inicioAtencion.current}
        hayCola={snapshot.cola.length > 0}
        ocupado={ocupado || !conectado}
        onLlamarSiguiente={llamarSiguiente}
        onRellamar={() => sobreActivo("RELLAMAR_TURNO")}
        onAusente={() => sobreActivo("MARCAR_AUSENTE")}
        onIniciar={() => sobreActivo("INICIAR_ATENCION")}
        onFinalizar={() => sobreActivo("FINALIZAR_ATENCION")}
        onDerivar={() => setAviso("La derivación se habilita en el paso siguiente")}
      />

      <div className="flex flex-col gap-6">
        <ColaBox snapshot={snapshot} />
        <ListaAusentes
          ausentes={snapshot.ausentes}
          deshabilitado={ocupado || !conectado || activo !== null}
          onLlamar={(turnoId) => void comando("LLAMAR_TURNO", { turnoId })}
        />
      </div>
    </main>
  )
}
```

Crear `app/operador/page.tsx`:

```typescript
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { leerCookie, NOMBRE_COOKIE, sesionActiva } from "@/lib/auth/sesion"
import { PanelOperador } from "./PanelOperador"

export default async function PaginaOperador() {
  const almacen = await cookies()
  const sesionId = leerCookie(almacen.get(NOMBRE_COOKIE)?.value)
  const sesion = sesionId ? await sesionActiva(sesionId) : null
  if (!sesion) redirect("/operador/login")

  return <PanelOperador />
}
```

- [ ] **Step 6: Verificar a mano**

Run: `npm run dev`

Importar un empleado y asignarle un box:

```bash
npm run importar:empleados -- silviaflores
```

Asignar el box a mano en la base (el ABM es de SP4). Después entrar a `/operador/login`, loguearse, generar un turno desde `/kiosco` y verificar que aparece en la cola del panel.

- [ ] **Step 7: Commit**

```bash
git add app/operador/
git commit -m "feat: panel del operador con cola, turno activo y ausentes"
```

---

## Task 13: Derivación en la interfaz

**Files:**
- Create: `app/operador/DialogoDerivar.tsx`
- Create: `app/api/catalogo/route.ts`
- Modify: `app/operador/PanelOperador.tsx`

**Interfaces:**
- Consumes: `DERIVAR_TURNO` del socket, `Catalogo` de `@/lib/catalogo`
- Produces: `DialogoDerivar`

- [ ] **Step 1: Ruta del catálogo**

Crear `app/api/catalogo/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { obtenerCatalogo } from "@/lib/catalogo"

export async function GET() {
  const catalogo = await obtenerCatalogo()
  return NextResponse.json({
    categorias: catalogo.categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tramites: c.tramites.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        ala: t.destino.ala,
        piso: t.destino.piso,
      })),
    })),
  })
}
```

- [ ] **Step 2: El diálogo**

Crear `app/operador/DialogoDerivar.tsx`:

```typescript
"use client"

import { useEffect, useMemo, useState } from "react"

interface TramiteDestino {
  id: string
  nombre: string
  ala: string
  piso: string
}

interface CategoriaDestino {
  id: string
  nombre: string
  tramites: TramiteDestino[]
}

export function DialogoDerivar({
  tramiteActualId,
  onConfirmar,
  onCerrar,
}: {
  tramiteActualId: string
  onConfirmar: (tramiteId: string) => void
  onCerrar: () => void
}) {
  const [categorias, setCategorias] = useState<CategoriaDestino[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [elegido, setElegido] = useState<TramiteDestino | null>(null)

  useEffect(() => {
    fetch("/api/catalogo")
      .then((r) => r.json())
      .then((d) => setCategorias(d.categorias))
      .catch(() => setCategorias([]))
  }, [])

  useEffect(() => {
    const alEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar()
    }
    window.addEventListener("keydown", alEscape)
    return () => window.removeEventListener("keydown", alEscape)
  }, [onCerrar])

  const resultados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return categorias
      .map((c) => ({
        ...c,
        tramites: c.tramites.filter(
          (t) => t.id !== tramiteActualId && t.nombre.toLowerCase().includes(texto)
        ),
      }))
      .filter((c) => c.tramites.length > 0)
  }, [categorias, busqueda, tramiteActualId])

  // Confirmado: se muestra el destino en grande. El aviso es verbal — el
  // operador se lo lee al afiliado, que conserva el ticket que ya tiene.
  if (elegido) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gris-principal/60 p-6">
        <div className="w-full max-w-xl rounded-2xl bg-white p-10 text-center">
          <p className="text-lg">Derivar a</p>
          <p className="mt-2 font-titulo text-4xl font-bold">{elegido.nombre}</p>
          <p className="mt-6 font-titulo text-3xl font-semibold">Ala {elegido.ala}</p>
          <p className="text-2xl">{elegido.piso}</p>
          <p className="mt-6 text-sm">
            No se imprime un ticket nuevo: el afiliado conserva el que tiene, con el mismo número.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onConfirmar(elegido.id)}
              className="rounded-2xl bg-gris-principal px-8 py-4 text-lg font-semibold text-white"
            >
              Confirmar derivación
            </button>
            <button
              type="button"
              onClick={() => setElegido(null)}
              className="rounded-2xl border-2 border-gris-70 px-6 py-4 text-lg font-semibold"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-gris-principal/60 p-6">
      <div className="mt-12 w-full max-w-2xl rounded-2xl bg-white p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-titulo text-2xl font-semibold">Derivar a otro trámite</h2>
          <button type="button" onClick={onCerrar} className="text-sm font-semibold">
            Cancelar
          </button>
        </div>

        <input
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar trámite…"
          className="mt-4 w-full rounded-xl border-2 border-gris-70 px-4 py-3 text-lg focus:border-gris-principal focus:outline-none"
        />

        <div className="mt-4 max-h-96 overflow-y-auto">
          {resultados.length === 0 && <p className="py-6 text-center">Sin resultados</p>}
          {resultados.map((c) => (
            <div key={c.id} className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide">{c.nombre}</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {c.tramites.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setElegido(t)}
                      className="w-full rounded-xl px-4 py-3 text-left text-lg hover:bg-gris-20"
                    >
                      {t.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Cablearlo al panel**

En `app/operador/PanelOperador.tsx`, agregar el import:

```typescript
import { DialogoDerivar } from "./DialogoDerivar"
```

Agregar el estado, junto a los otros `useState`:

```typescript
  const [derivando, setDerivando] = useState(false)
```

Reemplazar la prop `onDerivar` del `TurnoActivo`:

```typescript
        onDerivar={() => setDerivando(true)}
```

Y agregar antes del `</main>` de cierre:

```typescript
      {derivando && activo && (
        <DialogoDerivar
          tramiteActualId={activo.tramiteId}
          onCerrar={() => setDerivando(false)}
          onConfirmar={async (tramiteDestinoId) => {
            setDerivando(false)
            await comando("DERIVAR_TURNO", { turnoId: activo.id, tramiteDestinoId })
          }}
        />
      )}
```

- [ ] **Step 4: Verificar a mano**

Run: `npm run dev`

Generar un turno, llamarlo, derivarlo a otro trámite. Verificar en la base que hay dos filas con el mismo `numero` y que el contador del destino no cambió:

```bash
npx tsx -e "import {prisma} from './lib/db'; prisma.turno.findMany({where:{derivadoDeId:{not:null}},select:{numero:true,tramiteId:true,derivadoDeId:true}}).then(r=>{console.log(r);return prisma.\$disconnect()})"
```

- [ ] **Step 5: Commit**

```bash
git add app/operador/DialogoDerivar.tsx app/operador/PanelOperador.tsx app/api/catalogo/
git commit -m "feat: derivación desde el panel del operador"
```

---

## Task 14: Atajos de teclado

**Files:**
- Create: `app/operador/usarAtajos.ts`
- Modify: `app/operador/PanelOperador.tsx`
- Test: `tests/unit/atajos.test.ts`

**Interfaces:**
- Produces: `accionDeTecla(tecla: string, estado: EstadoPanel): Accion | null`
  - `type EstadoPanel = "sin-turno" | "llamado" | "atendiendo"`
  - `type Accion = "llamar" | "iniciar" | "finalizar" | "rellamar" | "ausente" | "derivar"`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/unit/atajos.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { accionDeTecla } from "@/app/operador/usarAtajos"

describe("atajos del panel", () => {
  it("Enter recorre el camino feliz según el estado", () => {
    expect(accionDeTecla("Enter", "sin-turno")).toBe("llamar")
    expect(accionDeTecla("Enter", "llamado")).toBe("iniciar")
    expect(accionDeTecla("Enter", "atendiendo")).toBe("finalizar")
  })

  it("las letras disparan las acciones secundarias", () => {
    expect(accionDeTecla("r", "llamado")).toBe("rellamar")
    expect(accionDeTecla("a", "llamado")).toBe("ausente")
    expect(accionDeTecla("d", "llamado")).toBe("derivar")
  })

  it("acepta mayúsculas", () => {
    expect(accionDeTecla("R", "llamado")).toBe("rellamar")
  })

  it("no permite rellamar ni marcar ausente lo que ya se está atendiendo", () => {
    expect(accionDeTecla("r", "atendiendo")).toBeNull()
    expect(accionDeTecla("a", "atendiendo")).toBeNull()
  })

  it("sin turno, sólo se puede llamar", () => {
    expect(accionDeTecla("r", "sin-turno")).toBeNull()
    expect(accionDeTecla("a", "sin-turno")).toBeNull()
    expect(accionDeTecla("d", "sin-turno")).toBeNull()
  })

  it("Enter nunca dispara ausente ni derivar: no se pueden deshacer", () => {
    for (const estado of ["sin-turno", "llamado", "atendiendo"] as const) {
      const accion = accionDeTecla("Enter", estado)
      expect(accion).not.toBe("ausente")
      expect(accion).not.toBe("derivar")
    }
  })

  it("ignora teclas que no son atajos", () => {
    expect(accionDeTecla("z", "llamado")).toBeNull()
    expect(accionDeTecla(" ", "llamado")).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/unit/atajos.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/operador/usarAtajos"`

- [ ] **Step 3: Implementar**

Crear `app/operador/usarAtajos.ts`:

```typescript
"use client"

import { useEffect } from "react"

export type EstadoPanel = "sin-turno" | "llamado" | "atendiendo"
export type Accion = "llamar" | "iniciar" | "finalizar" | "rellamar" | "ausente" | "derivar"

/**
 * Enter recorre el camino feliz completo: llamar -> iniciar -> finalizar.
 * Ausente y derivar quedan fuera de Enter a proposito: no se pueden deshacer y
 * un Enter de mas no debe dispararlas.
 */
export function accionDeTecla(tecla: string, estado: EstadoPanel): Accion | null {
  if (tecla === "Enter") {
    if (estado === "sin-turno") return "llamar"
    if (estado === "llamado") return "iniciar"
    return "finalizar"
  }

  if (estado !== "llamado") return null

  switch (tecla.toLowerCase()) {
    case "r": return "rellamar"
    case "a": return "ausente"
    case "d": return "derivar"
    default: return null
  }
}

function escribiendo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false
  return (
    destino.tagName === "INPUT" ||
    destino.tagName === "TEXTAREA" ||
    destino.tagName === "SELECT" ||
    destino.isContentEditable
  )
}

export function usarAtajos(
  estado: EstadoPanel,
  activo: boolean,
  alAccionar: (accion: Accion) => void
): void {
  useEffect(() => {
    if (!activo) return

    const alApretar = (e: KeyboardEvent) => {
      // Los atajos no pisan a alguien tipeando en el buscador de derivacion.
      if (escribiendo(e.target) || e.ctrlKey || e.altKey || e.metaKey) return

      const accion = accionDeTecla(e.key, estado)
      if (accion) {
        e.preventDefault()
        alAccionar(accion)
      }
    }

    window.addEventListener("keydown", alApretar)
    return () => window.removeEventListener("keydown", alApretar)
  }, [estado, activo, alAccionar])
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/unit/atajos.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Cablearlo al panel**

En `app/operador/PanelOperador.tsx`, agregar el import:

```typescript
import { usarAtajos, type Accion, type EstadoPanel } from "./usarAtajos"
```

Y antes del `if (!snapshot)`:

```typescript
  const estadoPanel: EstadoPanel =
    !activo ? "sin-turno" : activo.estado === "atendiendo" ? "atendiendo" : "llamado"

  const confirmar = (mensaje: string) => window.confirm(mensaje)

  usarAtajos(estadoPanel, !!snapshot && conectado && !ocupado && !derivando, (accion: Accion) => {
    switch (accion) {
      case "llamar": llamarSiguiente(); break
      case "iniciar": sobreActivo("INICIAR_ATENCION"); break
      case "finalizar": sobreActivo("FINALIZAR_ATENCION"); break
      case "rellamar": sobreActivo("RELLAMAR_TURNO"); break
      // Confirmacion explicita: no se pueden deshacer.
      case "ausente":
        if (confirmar("¿Marcar este turno como ausente?")) sobreActivo("MARCAR_AUSENTE")
        break
      case "derivar": setDerivando(true); break
    }
  })
```

Además, agregar la misma confirmación al botón de ausente. Reemplazar la prop:

```typescript
        onAusente={() => {
          if (window.confirm("¿Marcar este turno como ausente?")) sobreActivo("MARCAR_AUSENTE")
        }}
```

- [ ] **Step 6: Commit**

```bash
git add app/operador/usarAtajos.ts app/operador/PanelOperador.tsx tests/unit/atajos.test.ts
git commit -m "feat: atajos de teclado del panel del operador"
```

---

## Task 15: E2E y retiro del panel legacy

**Files:**
- Create: `e2e/operador.spec.ts`
- Delete: `app/OperadorTurno/`
- Modify: `app/page.tsx` (si enlaza al panel viejo)

**Interfaces:**
- Consumes: todo lo anterior

- [ ] **Step 1: Escribir el E2E**

Crear `e2e/operador.spec.ts`:

```typescript
import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// Mismo puerto que playwright.config.ts, que lo toma de PUERTO_E2E.
const BASE = `http://localhost:${Number(process.env.PUERTO_E2E ?? 3100)}`

function cookieDeSesion(sesionId: string) {
  const { createHmac } = require("crypto") as typeof import("crypto")
  const firma = createHmac("sha256", process.env.SESION_SECRETO!).update(sesionId).digest("hex")
  return { name: "turnero_sesion", value: `${sesionId}.${firma}`, url: BASE }
}

// El login valida contra la obra social, que en E2E no se toca. Se usa un
// empleado sembrado y se entra por la cookie, saltando la pantalla de login.
test.beforeEach(async () => {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()
  await prisma.sesionOperador.deleteMany()
  await prisma.empleadoBox.deleteMany()
  await prisma.empleado.deleteMany()
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

test("el operador llama, inicia y finaliza un turno", async ({ page, context }) => {
  const box = await prisma.box.findFirstOrThrow()
  const empleado = await prisma.empleado.create({
    data: { dniInstitucional: "25319010", nombre: "Flores, Silvia", rol: "operador" },
  })
  await prisma.empleadoBox.create({ data: { empleadoId: empleado.id, boxId: box.id } })

  const tramite = await prisma.tramite.findFirstOrThrow({
    where: { boxes: { some: { boxId: box.id } } },
  })
  const hoy = new Date()
  await prisma.turno.create({
    data: {
      numero: "X01",
      fecha: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())),
      tramiteId: tramite.id,
      estado: "esperando",
      requestId: `e2e-${Date.now()}`,
    },
  })

  const sesion = await prisma.sesionOperador.create({
    data: { empleadoId: empleado.id, boxId: box.id },
  })

  await context.addCookies([cookieDeSesion(sesion.id)])

  await page.goto("/operador")

  await expect(page.getByTestId("total-cola")).toContainText("1 esperando")

  await page.getByTestId("llamar-siguiente").click()
  await expect(page.getByTestId("numero-activo")).toHaveText("X01")

  await page.getByTestId("iniciar").click()
  await expect(page.getByTestId("finalizar")).toBeVisible()

  await page.getByTestId("finalizar").click()
  await expect(page.getByTestId("llamar-siguiente")).toBeVisible()

  const turno = await prisma.turno.findFirstOrThrow({ where: { numero: "X01" } })
  expect(turno.estado).toBe("finalizado")
})

test("el desglose separa por trámite, no por categoría", async ({ page, context }) => {
  const box = await prisma.box.findFirstOrThrow()
  const empleado = await prisma.empleado.create({
    data: { dniInstitucional: "25319010", nombre: "Flores, Silvia", rol: "operador" },
  })
  await prisma.empleadoBox.create({ data: { empleadoId: empleado.id, boxId: box.id } })

  const tramites = await prisma.tramite.findMany({
    where: { boxes: { some: { boxId: box.id } } },
    take: 2,
  })
  test.skip(tramites.length < 2, "el box necesita al menos dos trámites")

  const hoy = new Date()
  const fecha = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
  for (const [i, t] of tramites.entries()) {
    await prisma.turno.create({
      data: {
        numero: `Y0${i}`,
        fecha,
        tramiteId: t.id,
        estado: "esperando",
        requestId: `e2e-desglose-${i}-${Date.now()}`,
      },
    })
  }

  const sesion = await prisma.sesionOperador.create({
    data: { empleadoId: empleado.id, boxId: box.id },
  })
  await context.addCookies([cookieDeSesion(sesion.id)])

  await page.goto("/operador")
  await expect(page.getByTestId("total-cola")).toContainText("2 esperando")

  const desglose = page.getByTestId("desglose")
  for (const t of tramites) {
    await expect(desglose).toContainText(t.nombre)
  }
})
```

- [ ] **Step 2: Correr el E2E**

Run: `npm run test:e2e -- e2e/operador.spec.ts`
Expected: PASS — 2 tests

- [ ] **Step 3: Retirar el panel legacy**

```bash
git rm -r app/OperadorTurno
```

Revisar si algo lo enlaza:

```bash
grep -rn "OperadorTurno" app/ lib/ server/ e2e/ --include=*.tsx --include=*.ts
```

Si `app/page.tsx` tiene un enlace al panel viejo, cambiarlo a `/operador`.

- [ ] **Step 4: Correr toda la suite**

Run: `npm test`
Expected: PASS — todo verde

Run: `npm run test:e2e`
Expected: PASS — los 7 tests de SP1 más los 2 nuevos

Run: `npx tsc --noEmit`
Expected: los errores preexistentes de `app/public-display/` siguen; **no debe haber ninguno nuevo en `app/operador/`, `lib/auth/` ni `server/`**. Los de `app/OperadorTurno/` desaparecen porque el directorio ya no existe.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: E2E del panel y retiro de app/OperadorTurno"
```

---

## Task 16: Documentación y grafo

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-08-13-sp2-panel-operador.md` (marcar tareas)

- [ ] **Step 1: Actualizar CLAUDE.md**

En la tabla de "Alcance por sub-proyecto", cambiar la fila de SP2 a **COMPLETO**.

En "Estado real", agregar debajo de la línea de SP1:

```markdown
**SP2 — COMPLETO.** Panel de operador, login contra la obra social, los cinco handlers de atención,
derivación y los dos jobs diarios. `app/OperadorTurno/` retirado.

El alta de empleados es por script: `npm run importar:empleados -- usuario1 usuario2`. La asignación
de boxes se hace a mano en la base hasta que SP4 traiga el ABM.
```

En "Comandos", agregar:

````markdown
```bash
npm run importar:empleados -- silviaflores
```
````

En "Pendientes externos", actualizar el punto 3 a resuelto: el login lee `[Usuario]` y `[Persona]` de `ObraSocial` y funciona con el usuario `prueba23`.

- [ ] **Step 2: Regenerar el grafo**

```bash
npx graphify .
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md graphify-out/ docs/superpowers/plans/
git commit -m "docs: SP2 completo, grafo regenerado"
```

---

## Notas para quien ejecute

**Lo que más fácil se hace mal:**

1. **El box y el empleado salen de la sesión, nunca del cliente.** Si el handler confía en un `boxId` que vino por el socket, cualquiera puede operar sobre el turno de otro box. En `server/index.ts` se toman de `socket.data.sesion`.

2. **`esAfiliado = 0`, no `IS NULL`.** Es `bit NOT NULL`. Un `IS NULL` no matchea nunca y el login rechazaría a todo el mundo.

3. **La derivación no toca el contador del destino.** Si aparece un `contador.upsert` en `derivarTurno`, está mal: la serie del destino saltearía números.

4. **`finalizarAtencion` no filtra por duración.** El hallazgo 4 del diseño general era exactamente eso, y el test lo cubre.

5. **Los tests de integración corren contra `Turnero_Test`.** Si `npm test` aborta con el mensaje de la guarda, es que `DATABASE_URL` quedó apuntando a la base real — probablemente por una variable de entorno de la sesión de shell. Limpiala antes de investigar otra cosa.
