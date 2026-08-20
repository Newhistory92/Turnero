# SP6 — Usuarios: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una pantalla `/admin/usuarios` donde el admin importa gente desde la base de la obra social, le asigna rol y boxes, y la da de baja.

**Architecture:** Se reusa el núcleo de importación que ya existe en `scripts/importarEmpleados.ts`, moviéndolo a `lib/admin/importacion.ts` para que la interfaz y la línea de comandos compartan una sola implementación. Una capa nueva `lib/admin/usuarios.ts` concentra la lectura y la escritura de empleados con las validaciones de autorización. Los Server Components de `app/admin/usuarios/` sólo componen.

**Tech Stack:** Next.js 15.2.4 (App Router), React 19, Prisma 6 sobre SQL Server, Vitest, Playwright, Tailwind.

## Global Constraints

- **Nunca se copia la contraseña ni su hash a la base del Turnero.** Ninguna consulta de este plan selecciona `claveUsuario`. La validación de credenciales sigue siendo en vivo contra la obra social en cada login.
- Sólo `admin` entra a `/admin/usuarios`. `puedeEditarCatalogo(rol)` es el predicado, y se revalida en **cada mutación** — no se confía en el formulario.
- **Nadie puede editar su propia fila.** Con `d.empleadoId === actor.empleadoId` se descartan `rol` y `activo`, y se guardan sólo los boxes. No es un error.
- El guard de auto-edición corre **antes** que la validación de rol. Validar el rol primero haría fallar el guardado de tus propios boxes si el formulario manipulado trajera además un rol inválido.
- `Actor` expone **`empleadoId`**, no `id`. Ver `lib/admin/acceso.ts`.
- Reimportar a alguien que ya existe **no le cambia el rol**: sólo actualiza el nombre y lo pone `activo: true`.
- Las consultas a la obra social filtran siempre con `u.anulado = 0 AND ${SQL_EMPLEADOS}`, la constante ya exportada por `lib/auth/institucional.ts`.
- **Convención del repo:** los comentarios en código van **sin tildes** (`atencion`, `asi`, `aca`). Los textos de interfaz y los nombres de tests (`describe`/`it`) **sí llevan tildes**.
- Comentarios que expliquen **por qué**, no qué. Ver `lib/queue/disponibilidad.ts` como referencia de tono.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `lib/admin/importacion.ts` *(nuevo)* | `FilaEmpleado`, `nombreCompleto`, `importarEmpleados`, `listarImportables` |
| `scripts/importarEmpleados.ts` *(modificar)* | Envoltorio CLI: parseo de argumentos y mensajes de consola |
| `lib/admin/usuarios.ts` *(nuevo)* | `listarUsuarios` y `guardarUsuario` con las validaciones |
| `lib/admin/acciones.ts` *(modificar)* | `accionGuardarUsuario` y `accionImportar` |
| `app/admin/usuarios/page.tsx` *(nuevo)* | Server Component: guard y consultas |
| `app/admin/usuarios/TablaUsuarios.tsx` *(nuevo)* | Cliente: una tarjeta editable por empleado |
| `app/admin/usuarios/PanelImportar.tsx` *(nuevo)* | Cliente: buscador y casillas |
| `app/admin/layout.tsx` *(modificar)* | El link nuevo |

---

## Task 1: Mover el núcleo de importación a `lib/`

**Files:**
- Create: `lib/admin/importacion.ts`
- Modify: `scripts/importarEmpleados.ts` (reemplazo completo)
- Modify: `tests/integration/importarEmpleados.test.ts:3` (sólo la línea del import)

**Interfaces:**
- Consumes: `SQL_EMPLEADOS` de `@/lib/auth/institucional`, `prisma` de `@/lib/db`.
- Produces: `FilaEmpleado` (interface con `nombreUsuario`, `documento`, `nombrePersona: string | null`, `apellidoPersona: string | null`), `Consulta` (tipo `(usuarios: string[]) => Promise<FilaEmpleado[]>`), `nombreCompleto(f: FilaEmpleado): string`, `importarEmpleados(usuarios: string[], consulta?: Consulta): Promise<{ creados: number; actualizados: number; noEncontrados: string[] }>`.

> **Esta tarea es un movimiento, no un rediseño.** La lógica se copia tal cual. La prueba de que salió bien es que `tests/integration/importarEmpleados.test.ts` pasa hasta el Step 4 sin cambiarle ni una aserción — sólo la ruta del import. Si sentís la tentación de mejorar algo de la función mientras la movés, no lo hagas: cualquier cambio de comportamiento acá es indistinguible de un error de transcripción. Recién en el Step 5, con el movimiento ya verificado, se agrega el test que faltaba.

- [ ] **Step 1: Cambiar el import del test para que apunte al módulo nuevo**

En `tests/integration/importarEmpleados.test.ts`, línea 3, reemplazá:

```ts
import { importarEmpleados, type FilaEmpleado } from "@/scripts/importarEmpleados"
```

por:

```ts
import { importarEmpleados, type FilaEmpleado } from "@/lib/admin/importacion"
```

No toques nada más del archivo.

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run tests/integration/importarEmpleados.test.ts`

Expected: FAIL — no se puede resolver `@/lib/admin/importacion` (el módulo todavía no existe).

- [ ] **Step 3: Crear `lib/admin/importacion.ts` con el núcleo movido**

```ts
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

export function nombreCompleto(f: FilaEmpleado): string {
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
      // No se toca el rol a proposito: un supervisor dado de baja que se
      // reimporta vuelve como supervisor, no degradado a operador.
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
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run tests/integration/importarEmpleados.test.ts`

Expected: PASS, 4/4.

- [ ] **Step 5: Agregar la cobertura que faltaba sobre el rol al reimportar**

Los tests que ya existían verifican que reimportar no duplica, pero ninguno verifica
que **no le cambie el rol** a quien ya estaba. Es una garantía del spec (§6.3) y hoy
sólo se cumple por accidente: nada la sujeta. Ahora que el módulo está en `lib/`, se
agrega el test que la fija.

Agregá este caso al final del `describe("importarEmpleados", ...)` en
`tests/integration/importarEmpleados.test.ts`:

```ts
  it("reimportar a alguien no le baja el rol ni pierde su historial", async () => {
    // Un supervisor dado de baja que se reimporta tiene que volver como
    // supervisor. Degradarlo a operador en silencio seria peor que no
    // reactivarlo.
    await importarEmpleados(["silviaflores"], consultaFalsa)
    await prisma.empleado.update({
      where: { dniInstitucional: "25319010" },
      data: { rol: "supervisor", activo: false },
    })

    await importarEmpleados(["silviaflores"], consultaFalsa)

    const silvia = await prisma.empleado.findUniqueOrThrow({
      where: { dniInstitucional: "25319010" },
    })
    expect(silvia.rol).toBe("supervisor")
    expect(silvia.activo).toBe(true)
  })
```

Run: `npx vitest run tests/integration/importarEmpleados.test.ts`

Expected: PASS, 5/5. El test pasa a la primera porque el comportamiento ya era correcto —
lo que faltaba era la red que impide que alguien lo rompa sin enterarse.

- [ ] **Step 6: Reemplazar `scripts/importarEmpleados.ts` por el envoltorio CLI**

Contenido completo del archivo:

```ts
import { prisma } from "@/lib/db"
import { importarEmpleados } from "@/lib/admin/importacion"

// Uso: npm run importar:empleados -- silviaflores gonzalotello
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
```

Nota: la guarda `if (process.argv[1]?.includes("importarEmpleados"))` que tenía el original ya no hace falta. Existía porque el archivo era a la vez módulo importable y ejecutable; ahora es sólo un ejecutable.

- [ ] **Step 7: Verificar que el comando de consola sigue funcionando**

Run: `npm run importar:empleados`

Expected: sale por error con `Pasá al menos un nombreUsuario. Ej: npm run importar:empleados -- silviaflores` y código 1. Eso confirma que el envoltorio arranca y resuelve el import del núcleo.

- [ ] **Step 8: Correr la suite entera**

Run: `npx vitest run`

Expected: PASS. Nada más importaba desde `@/scripts/importarEmpleados`, así que ningún otro test se entera del movimiento.

- [ ] **Step 9: Commit**

```bash
git add lib/admin/importacion.ts scripts/importarEmpleados.ts tests/integration/importarEmpleados.test.ts
git commit -m "refactor(sp6): mover el nucleo de importacion a lib/admin/importacion.ts"
```

---

## Task 2: `listarImportables()`

**Files:**
- Modify: `lib/admin/importacion.ts` (agregar al final)
- Test: `tests/integration/listarImportables.test.ts` *(nuevo)*

**Interfaces:**
- Consumes: `FilaEmpleado`, `nombreCompleto` de Task 1.
- Produces: `Importable` (interface con `nombreUsuario: string`, `documento: string`, `nombre: string`, `yaEsta: boolean`), `ConsultaTodos` (tipo `() => Promise<FilaEmpleado[]>`), `listarImportables(consulta?: ConsultaTodos): Promise<Importable[]>`.

- [ ] **Step 1: Escribir el test que falla**

Creá `tests/integration/listarImportables.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { listarImportables, type FilaEmpleado } from "@/lib/admin/importacion"

const DNI_YA = "99999801"
const DNI_FALTA = "99999802"

const gente: FilaEmpleado[] = [
  { nombreUsuario: "yaesta", documento: DNI_YA, nombrePersona: "Ana", apellidoPersona: "Ramírez" },
  { nombreUsuario: "falta", documento: DNI_FALTA, nombrePersona: "Beto", apellidoPersona: "Sosa" },
]

const consultaFalsa = async () => gente

async function limpiar() {
  await prisma.empleado.deleteMany({
    where: { dniInstitucional: { in: [DNI_YA, DNI_FALTA] } },
  })
}

describe("listarImportables", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("marca yaEsta en quien ya fue importado al Turnero", async () => {
    await prisma.empleado.create({
      data: { dniInstitucional: DNI_YA, nombre: "Ramírez, Ana", rol: "operador" },
    })

    const filas = await listarImportables(consultaFalsa)

    expect(filas.find((f) => f.documento === DNI_YA)?.yaEsta).toBe(true)
    expect(filas.find((f) => f.documento === DNI_FALTA)?.yaEsta).toBe(false)
  })

  it("arma el nombre como Apellido, Nombre", async () => {
    const filas = await listarImportables(consultaFalsa)
    expect(filas.find((f) => f.documento === DNI_FALTA)?.nombre).toBe("Sosa, Beto")
  })

  it("un empleado dado de baja igual cuenta como ya importado", async () => {
    // Si apareciera como importable, importarlo lo reactivaria en silencio.
    // Mejor que se vea que ya esta y se lo reactive desde la tabla.
    await prisma.empleado.create({
      data: { dniInstitucional: DNI_YA, nombre: "Ramírez, Ana", rol: "operador", activo: false },
    })

    const filas = await listarImportables(consultaFalsa)
    expect(filas.find((f) => f.documento === DNI_YA)?.yaEsta).toBe(true)
  })

  it("devuelve la lista completa aunque no haya nadie importado", async () => {
    const filas = await listarImportables(consultaFalsa)
    expect(filas).toHaveLength(2)
    expect(filas.every((f) => !f.yaEsta)).toBe(true)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run tests/integration/listarImportables.test.ts`

Expected: FAIL — `listarImportables` no está exportada.

- [ ] **Step 3: Agregar `listarImportables` al final de `lib/admin/importacion.ts`**

```ts
export interface Importable {
  nombreUsuario: string
  documento: string
  nombre: string
  yaEsta: boolean
}

export type ConsultaTodos = () => Promise<FilaEmpleado[]>

const consultaTodosReal: ConsultaTodos = () =>
  prisma.$queryRawUnsafe<FilaEmpleado[]>(`
    SELECT
      LTRIM(RTRIM(u.nombreUsuario)) AS nombreUsuario,
      LTRIM(RTRIM(p.numeroDocPersona)) AS documento,
      LTRIM(RTRIM(p.nombrePersona)) AS nombrePersona,
      LTRIM(RTRIM(p.apellidoPersona)) AS apellidoPersona
    FROM [ObraSocial].[dbo].[Usuario] u
    JOIN [ObraSocial].[dbo].[Persona] p ON p.idPersona = u.idPersona
    WHERE u.anulado = 0
      AND ${SQL_EMPLEADOS}
    ORDER BY p.apellidoPersona, p.nombrePersona
  `)

/**
 * Los empleados de la obra social, con la marca de quien ya esta en el
 * Turnero. El cruce se hace en memoria y no con un JOIN entre bases porque
 * son bases distintas y la lista ronda las 150 filas.
 */
export async function listarImportables(
  consulta: ConsultaTodos = consultaTodosReal
): Promise<Importable[]> {
  const filas = await consulta()

  const existentes = await prisma.empleado.findMany({
    where: { dniInstitucional: { in: filas.map((f) => f.documento) } },
    select: { dniInstitucional: true },
  })
  // Incluye a los inactivos: si un empleado dado de baja apareciera como
  // importable, importarlo lo reactivaria sin que se note.
  const ya = new Set(existentes.map((e) => e.dniInstitucional))

  return filas.map((f) => ({
    nombreUsuario: f.nombreUsuario,
    documento: f.documento,
    nombre: nombreCompleto(f),
    yaEsta: ya.has(f.documento),
  }))
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run tests/integration/listarImportables.test.ts`

Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/importacion.ts tests/integration/listarImportables.test.ts
git commit -m "feat(sp6): listarImportables con la marca de quien ya esta en el turnero"
```

---

## Task 3: `lib/admin/usuarios.ts`

**Files:**
- Create: `lib/admin/usuarios.ts`
- Test: `tests/integration/usuarios.test.ts` *(nuevo)*

**Interfaces:**
- Consumes: `Actor`, `esRol`, `puedeEditarCatalogo` de `@/lib/admin/acceso`; `Resultado` de `@/lib/admin/mutaciones` (es `{ ok: true } | { ok: false; errores: ErrorCampo[] }`).
- Produces: `UsuarioFila` (interface con `id`, `dniInstitucional`, `nombre`, `rol: string`, `activo: boolean`, `boxIds: string[]`), `DatosUsuario` (interface con `empleadoId: string`, `rol: string`, `activo: boolean`, `boxIds: string[]`), `listarUsuarios(): Promise<UsuarioFila[]>`, `guardarUsuario(actor: Actor, d: DatosUsuario): Promise<Resultado>`.

> **El corazón de seguridad de SP6 está en esta tarea.** Prestá atención al orden de las validaciones: el guard de auto-edición va **antes** de `esRol`.

> **Sobre dónde viven estos tests.** El spec (§11) los reparte entre unitarios —la validación de rol y el guard de la propia fila— y de integración. Van todos a `tests/integration/` porque `guardarUsuario` consulta y escribe con Prisma: probar el guard "unitariamente" exigiría simular el cliente, y un guard de autorización verificado contra un simulacro no prueba que la base haya quedado intacta. Los tests de acá afirman sobre las filas reales después de la operación, que es lo que importa.

- [ ] **Step 1: Escribir los tests que fallan**

Creá `tests/integration/usuarios.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import type { Actor } from "@/lib/admin/acceso"
import { listarUsuarios, guardarUsuario } from "@/lib/admin/usuarios"

const DNI_PRUEBA = "99999811"
const DNI_ACTOR = "99999812"

const SUPERVISOR: Actor = { empleadoId: "y", nombre: "Super", rol: "supervisor" }

async function limpiar() {
  await prisma.empleadoBox.deleteMany({
    where: { empleado: { dniInstitucional: { in: [DNI_PRUEBA, DNI_ACTOR] } } },
  })
  await prisma.empleado.deleteMany({
    where: { dniInstitucional: { in: [DNI_PRUEBA, DNI_ACTOR] } },
  })
}

async function crearEmpleado(dni: string, rol = "operador") {
  return prisma.empleado.create({
    data: { dniInstitucional: dni, nombre: `Prueba ${dni}`, rol },
  })
}

/** Un Actor admin cuyo empleadoId es real, para probar el guard de la propia fila. */
async function crearActorAdmin(): Promise<Actor> {
  const e = await crearEmpleado(DNI_ACTOR, "admin")
  return { empleadoId: e.id, nombre: e.nombre, rol: "admin" }
}

describe("listarUsuarios", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("incluye a los inactivos, para que se los pueda reactivar", async () => {
    await prisma.empleado.create({
      data: { dniInstitucional: DNI_PRUEBA, nombre: "Baja", rol: "operador", activo: false },
    })

    const filas = await listarUsuarios()
    expect(filas.find((f) => f.dniInstitucional === DNI_PRUEBA)?.activo).toBe(false)
  })

  it("trae los boxes asignados de cada empleado", async () => {
    const emp = await crearEmpleado(DNI_PRUEBA)
    const box = await prisma.box.findFirstOrThrow({ orderBy: { numero: "asc" } })
    await prisma.empleadoBox.create({ data: { empleadoId: emp.id, boxId: box.id } })

    const filas = await listarUsuarios()
    expect(filas.find((f) => f.id === emp.id)?.boxIds).toEqual([box.id])
  })
})

describe("guardarUsuario", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("el admin cambia el rol, el estado y los boxes", async () => {
    const actor = await crearActorAdmin()
    const emp = await crearEmpleado(DNI_PRUEBA)
    const box = await prisma.box.findFirstOrThrow({ orderBy: { numero: "asc" } })

    const r = await guardarUsuario(actor, {
      empleadoId: emp.id,
      rol: "supervisor",
      activo: false,
      boxIds: [box.id],
    })
    expect(r.ok).toBe(true)

    const guardado = await prisma.empleado.findUniqueOrThrow({ where: { id: emp.id } })
    expect(guardado.rol).toBe("supervisor")
    expect(guardado.activo).toBe(false)

    const asignados = await prisma.empleadoBox.findMany({ where: { empleadoId: emp.id } })
    expect(asignados.map((a) => a.boxId)).toEqual([box.id])
  })

  it("una lista de boxes vacía deja al empleado sin ninguno", async () => {
    const actor = await crearActorAdmin()
    const emp = await crearEmpleado(DNI_PRUEBA)
    const box = await prisma.box.findFirstOrThrow({ orderBy: { numero: "asc" } })
    await prisma.empleadoBox.create({ data: { empleadoId: emp.id, boxId: box.id } })

    const r = await guardarUsuario(actor, {
      empleadoId: emp.id,
      rol: "operador",
      activo: true,
      boxIds: [],
    })
    expect(r.ok).toBe(true)

    const asignados = await prisma.empleadoBox.findMany({ where: { empleadoId: emp.id } })
    expect(asignados).toEqual([])
  })

  it("un supervisor no puede editar usuarios", async () => {
    const emp = await crearEmpleado(DNI_PRUEBA)

    const r = await guardarUsuario(SUPERVISOR, {
      empleadoId: emp.id,
      rol: "admin",
      activo: true,
      boxIds: [],
    })
    expect(r.ok).toBe(false)

    const sinCambios = await prisma.empleado.findUniqueOrThrow({ where: { id: emp.id } })
    expect(sinCambios.rol).toBe("operador")
  })

  it("rechaza un rol que no está en el vocabulario", async () => {
    const actor = await crearActorAdmin()
    const emp = await crearEmpleado(DNI_PRUEBA)

    const r = await guardarUsuario(actor, {
      empleadoId: emp.id,
      rol: "jefe",
      activo: true,
      boxIds: [],
    })
    expect(r.ok).toBe(false)

    const sinCambios = await prisma.empleado.findUniqueOrThrow({ where: { id: emp.id } })
    expect(sinCambios.rol).toBe("operador")
  })

  it("rechaza a un empleado que ya no existe", async () => {
    const actor = await crearActorAdmin()

    const r = await guardarUsuario(actor, {
      empleadoId: "no-existe",
      rol: "operador",
      activo: true,
      boxIds: [],
    })
    expect(r.ok).toBe(false)
  })

  it("sobre la propia fila descarta el rol y el estado, pero guarda los boxes", async () => {
    const actor = await crearActorAdmin()
    const box = await prisma.box.findFirstOrThrow({ orderBy: { numero: "asc" } })

    const r = await guardarUsuario(actor, {
      empleadoId: actor.empleadoId,
      rol: "operador",
      activo: false,
      boxIds: [box.id],
    })
    expect(r.ok).toBe(true)

    const yo = await prisma.empleado.findUniqueOrThrow({ where: { id: actor.empleadoId } })
    expect(yo.rol).toBe("admin")
    expect(yo.activo).toBe(true)

    const asignados = await prisma.empleadoBox.findMany({ where: { empleadoId: actor.empleadoId } })
    expect(asignados.map((a) => a.boxId)).toEqual([box.id])
  })

  it("sobre la propia fila un rol inválido no impide guardar los boxes", async () => {
    // El guard de la propia fila corre antes que la validacion de rol: si
    // corriera despues, un formulario manipulado bloquearia una edicion
    // legitima de boxes.
    const actor = await crearActorAdmin()
    const box = await prisma.box.findFirstOrThrow({ orderBy: { numero: "asc" } })

    const r = await guardarUsuario(actor, {
      empleadoId: actor.empleadoId,
      rol: "jefe",
      activo: true,
      boxIds: [box.id],
    })
    expect(r.ok).toBe(true)

    const yo = await prisma.empleado.findUniqueOrThrow({ where: { id: actor.empleadoId } })
    expect(yo.rol).toBe("admin")
  })
})
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run tests/integration/usuarios.test.ts`

Expected: FAIL — no se puede resolver `@/lib/admin/usuarios`.

- [ ] **Step 3: Crear `lib/admin/usuarios.ts`**

```ts
import { prisma } from "@/lib/db"
import { esRol, puedeEditarCatalogo, type Actor } from "./acceso"
import type { Resultado } from "./mutaciones"

export interface UsuarioFila {
  id: string
  dniInstitucional: string
  nombre: string
  rol: string
  activo: boolean
  boxIds: string[]
}

/**
 * Incluye a los inactivos a proposito: dar de baja no es esconder, y si no
 * aparecieran no habria forma de reactivarlos desde la pantalla.
 */
export async function listarUsuarios(): Promise<UsuarioFila[]> {
  const filas = await prisma.empleado.findMany({
    include: { boxes: { select: { boxId: true } } },
    orderBy: { nombre: "asc" },
  })

  return filas.map((e) => ({
    id: e.id,
    dniInstitucional: e.dniInstitucional,
    nombre: e.nombre,
    rol: e.rol,
    activo: e.activo,
    boxIds: e.boxes.map((b) => b.boxId),
  }))
}

export interface DatosUsuario {
  empleadoId: string
  rol: string
  activo: boolean
  boxIds: string[]
}

export async function guardarUsuario(actor: Actor, d: DatosUsuario): Promise<Resultado> {
  // Repartir roles es la misma autoridad que editar el catalogo: si un
  // supervisor pudiera, se ascenderia a si mismo.
  if (!puedeEditarCatalogo(actor.rol)) {
    return {
      ok: false,
      errores: [{ campo: "rol", mensaje: "No tenés permiso para editar usuarios" }],
    }
  }

  const empleado = await prisma.empleado.findUnique({ where: { id: d.empleadoId } })
  if (!empleado) {
    return {
      ok: false,
      errores: [{ campo: "empleadoId", mensaje: "Ese empleado ya no existe" }],
    }
  }

  // Tu propia fila: los boxes si, el rol y el activo no. Hace imposible que
  // alguien se deje afuera del panel. La pantalla ya los muestra
  // deshabilitados, asi que un envio con esos campos cambiados viene de un
  // formulario manipulado: se guarda lo legitimo y se ignora el resto.
  const esMiFila = d.empleadoId === actor.empleadoId

  // El orden importa. Validar el rol antes del guard haria fallar la edicion
  // de tus propios boxes si el formulario manipulado trajera ademas un rol
  // invalido, cuando lo correcto es descartar ese rol y guardar los boxes.
  if (!esMiFila && !esRol(d.rol)) {
    return { ok: false, errores: [{ campo: "rol", mensaje: "Ese rol no existe" }] }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (!esMiFila) {
        await tx.empleado.update({
          where: { id: d.empleadoId },
          data: { rol: d.rol, activo: d.activo },
        })
      }

      // EmpleadoBox no tiene mas campos que las dos claves, asi que reemplazar
      // es equivalente a diferenciar y mas simple de leer.
      await tx.empleadoBox.deleteMany({ where: { empleadoId: d.empleadoId } })
      if (d.boxIds.length > 0) {
        await tx.empleadoBox.createMany({
          data: d.boxIds.map((boxId) => ({ empleadoId: d.empleadoId, boxId })),
        })
      }
    })
  } catch {
    return {
      ok: false,
      errores: [{ campo: "boxId", mensaje: "No se pudo guardar el usuario" }],
    }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/integration/usuarios.test.ts`

Expected: PASS, 9/9.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/usuarios.ts tests/integration/usuarios.test.ts
git commit -m "feat(sp6): capa de usuarios con el guard de la propia fila"
```

---

## Task 4: Página de usuarios, tabla y link en el nav

**Files:**
- Modify: `lib/admin/acciones.ts` (agregar import y una acción)
- Create: `app/admin/usuarios/page.tsx`
- Create: `app/admin/usuarios/TablaUsuarios.tsx`
- Modify: `app/admin/layout.tsx` (agregar un link)
- Test: `e2e/usuarios.spec.ts` *(nuevo)*

**Interfaces:**
- Consumes: `listarUsuarios`, `guardarUsuario`, `UsuarioFila` de Task 3; `ROLES` y `puedeEditarCatalogo` de `@/lib/admin/acceso`; `ESTADO_INICIAL` de `@/lib/admin/estadoFormulario`.
- Produces: `accionGuardarUsuario(_prev: EstadoFormulario, fd: FormData): Promise<EstadoFormulario>` en `lib/admin/acciones.ts`; el componente `TablaUsuarios`.

- [ ] **Step 1: Escribir la prueba E2E que falla**

Creá `e2e/usuarios.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

// Igual que el resto de /admin, la pantalla de usuarios no existe para quien
// no tiene sesion. Es lo unico que se puede probar sin credenciales
// institucionales reales.
test("la pantalla de usuarios rebota a quien no tiene sesión", async ({ page }) => {
  await page.goto("/admin/usuarios")
  await expect(page).toHaveURL(/\/operador\/login/)
})
```

- [ ] **Step 2: Correr la prueba para verificar que falla**

Run: `npx playwright test e2e/usuarios.spec.ts`

Expected: FAIL — `/admin/usuarios` devuelve 404, así que la URL no termina en `/operador/login`.

- [ ] **Step 3: Agregar `accionGuardarUsuario` a `lib/admin/acciones.ts`**

Primero, agregá el import del módulo nuevo junto a los que ya están arriba del archivo:

```ts
import { guardarUsuario } from "./usuarios"
```

Después, agregá este helper junto a los otros (`texto`, `entero`, `varios`):

```ts
/** Una casilla sin marcar no se envia: ausencia es false. */
function booleano(fd: FormData, clave: string): boolean {
  return fd.get(clave) !== null
}
```

Y al final del archivo, la acción:

```ts
export async function accionGuardarUsuario(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  const r = await guardarUsuario(actor, {
    empleadoId: texto(fd, "empleadoId"),
    rol: texto(fd, "rol"),
    activo: booleano(fd, "activo"),
    boxIds: varios(fd, "boxId"),
  })

  if (r.ok) revalidatePath("/admin/usuarios")
  return aEstado(r)
}
```

- [ ] **Step 4: Crear `app/admin/usuarios/TablaUsuarios.tsx`**

```tsx
"use client"

import { useActionState } from "react"
import { accionGuardarUsuario } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import { ROLES } from "@/lib/admin/acceso"
import type { UsuarioFila } from "@/lib/admin/usuarios"

interface Box {
  id: string
  nombre: string
}

export function TablaUsuarios({
  usuarios,
  boxes,
  actorId,
}: {
  usuarios: UsuarioFila[]
  boxes: Box[]
  actorId: string
}) {
  if (usuarios.length === 0) {
    return (
      <p className="rounded-xl bg-white p-4 text-sm text-gris-80">
        Todavía no hay nadie importado. Usá el botón de arriba para traer gente.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {usuarios.map((u) => (
        <Fila key={u.id} usuario={u} boxes={boxes} esMiFila={u.id === actorId} />
      ))}
    </div>
  )
}

const CAMPO =
  "rounded-lg border-2 border-gris-70 bg-white px-3 py-2 " +
  "focus:border-gris-principal focus:outline-none disabled:bg-gris-20"

function Fila({
  usuario,
  boxes,
  esMiFila,
}: {
  usuario: UsuarioFila
  boxes: Box[]
  esMiFila: boolean
}) {
  const [estado, accion, pendiente] = useActionState(accionGuardarUsuario, ESTADO_INICIAL)

  return (
    <form
      action={accion}
      // Los inactivos atenuados: se distinguen de un vistazo sin gastar una
      // columna en decir "inactivo".
      className={`flex flex-col gap-4 rounded-xl bg-white p-4 ${usuario.activo ? "" : "opacity-60"}`}
    >
      <input type="hidden" name="empleadoId" value={usuario.id} />

      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-48">
          <p className="font-semibold">{usuario.nombre}</p>
          <p className="text-sm text-gris-80">DNI {usuario.dniInstitucional}</p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Rol</span>
          <select
            className={CAMPO}
            name="rol"
            defaultValue={usuario.rol}
            disabled={esMiFila}
            required
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={usuario.activo}
            disabled={esMiFila}
          />
          Activo
        </label>

        {esMiFila && (
          <span className="rounded-lg bg-gainsboro px-3 py-1 text-xs font-semibold">
            Sos vos
          </span>
        )}
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-semibold">Boxes que atiende</legend>
        {boxes.length === 0 ? (
          <p className="text-sm text-gris-80">No hay boxes activos.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {boxes.map((b) => (
              <label key={b.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  name="boxId"
                  value={b.id}
                  defaultChecked={usuario.boxIds.includes(b.id)}
                />
                {b.nombre}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-4">
        <button
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
          disabled={pendiente}
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {estado.guardado && <span className="text-sm text-gris-80">Guardado</span>}
        {estado.errores.length > 0 && (
          <span role="alert" className="text-sm text-osp">
            {estado.errores[0].mensaje}
          </span>
        )}
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Crear `app/admin/usuarios/page.tsx`**

En esta tarea la página todavía no muestra el panel de importación: eso llega en la Task 5.

```tsx
import { redirect } from "next/navigation"
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { prisma } from "@/lib/db"
import { listarUsuarios } from "@/lib/admin/usuarios"
import { TablaUsuarios } from "./TablaUsuarios"

export default async function PaginaUsuarios() {
  const actor = await actorActual()
  if (!actor) return null

  // El layout ya dejo afuera a operador y director. Aca cae el supervisor:
  // repartir roles es autoridad de admin.
  if (!puedeEditarCatalogo(actor.rol)) redirect("/admin")

  const [usuarios, boxesCrudos] = await Promise.all([
    listarUsuarios(),
    prisma.box.findMany({
      where: { activo: true },
      include: { ala: { select: { nombre: true } } },
      orderBy: { numero: "asc" },
    }),
  ])

  const boxes = boxesCrudos.map((b) => ({
    id: b.id,
    nombre: `${b.nombre} — Ala ${b.ala.nombre}`,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-titulo text-2xl font-semibold">Usuarios</h1>
        <p className="mt-1 text-sm text-gris-80">
          Las contraseñas viven en la base de la obra social y se validan en cada ingreso.
          Acá sólo se decide quién entra al turnero, con qué rol y en qué boxes atiende.
        </p>
      </div>

      <TablaUsuarios usuarios={usuarios} boxes={boxes} actorId={actor.empleadoId} />
    </div>
  )
}
```

- [ ] **Step 6: Agregar el link en `app/admin/layout.tsx`**

Dentro del `<nav>`, justo antes del bloque `{puedeEditarCatalogo(actor.rol) && (` que envuelve el link de "Alcance de métricas", agregá:

```tsx
          {puedeEditarCatalogo(actor.rol) && (
            <Link href="/admin/usuarios" className="text-sm hover:underline">
              Usuarios
            </Link>
          )}
```

- [ ] **Step 7: Correr la prueba E2E para verificar que pasa**

Run: `npx playwright test e2e/usuarios.spec.ts`

Expected: PASS, 1/1.

- [ ] **Step 8: Verificar que compila y que la suite sigue verde**

Run: `npx tsc --noEmit`

Expected: los 3 errores preexistentes en `tests/integration/actorActual.test.ts`, `tests/integration/aislamientoAla.test.ts` y `tests/integration/referencias.test.ts`. Ningún error en los archivos nuevos.

Run: `npx vitest run`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/admin/acciones.ts app/admin/usuarios app/admin/layout.tsx e2e/usuarios.spec.ts
git commit -m "feat(sp6): pantalla de usuarios con rol, estado y boxes"
```

---

## Task 5: Panel de importación

**Files:**
- Modify: `lib/admin/acciones.ts` (agregar imports y una acción)
- Create: `app/admin/usuarios/PanelImportar.tsx`
- Modify: `app/admin/usuarios/page.tsx` (cargar los importables y montar el panel)

**Interfaces:**
- Consumes: `listarImportables`, `importarEmpleados`, `Importable` de las Tasks 1 y 2; `puedeEditarCatalogo` de `@/lib/admin/acceso`; `ESTADO_INICIAL` de `@/lib/admin/estadoFormulario`.
- Produces: `accionImportar(_prev: EstadoFormulario, fd: FormData): Promise<EstadoFormulario>`; el componente `PanelImportar`.

- [ ] **Step 1: Agregar `accionImportar` a `lib/admin/acciones.ts`**

Agregá el import del núcleo de importación junto a los otros de arriba del archivo:

```ts
import { importarEmpleados } from "./importacion"
```

Y ampliá el import que ya existe de `./acceso` para que además traiga el predicado:

```ts
import { actorActual, puedeEditarCatalogo } from "./acceso"
```

Al final del archivo, la acción:

```ts
export async function accionImportar(
  _prev: EstadoFormulario,
  fd: FormData
): Promise<EstadoFormulario> {
  const actor = await actorActual()
  if (!actor) return NO_AUTENTICADO

  // Importar da de alta gente en el turnero: la misma autoridad que repartir
  // roles. Se revalida aca y no se confia en que la pantalla haya filtrado.
  if (!puedeEditarCatalogo(actor.rol)) {
    return {
      errores: [{ campo: "rol", mensaje: "No tenés permiso para editar usuarios" }],
      guardado: false,
    }
  }

  const usuarios = varios(fd, "nombreUsuario")
  if (usuarios.length === 0) {
    return {
      errores: [{ campo: "nombreUsuario", mensaje: "Elegí al menos una persona" }],
      guardado: false,
    }
  }

  try {
    await importarEmpleados(usuarios)
  } catch {
    return {
      errores: [
        { campo: "nombreUsuario", mensaje: "No se pudo consultar la base de la obra social" },
      ],
      guardado: false,
    }
  }

  revalidatePath("/admin/usuarios")
  return { errores: [], guardado: true }
}
```

- [ ] **Step 2: Crear `app/admin/usuarios/PanelImportar.tsx`**

```tsx
"use client"

import { useActionState, useState } from "react"
import { accionImportar } from "@/lib/admin/acciones"
import { ESTADO_INICIAL } from "@/lib/admin/estadoFormulario"
import type { Importable } from "@/lib/admin/importacion"

/** Sin acentos y en minusculas, para que buscar "ramirez" encuentre "Ramírez". */
function normalizar(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

export function PanelImportar({
  importables,
  error,
}: {
  importables: Importable[]
  error: string | null
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [estado, accion, pendiente] = useActionState(accionImportar, ESTADO_INICIAL)

  // El filtrado es en el cliente: son unas 150 filas ya cargadas y no vale la
  // pena ir al servidor por cada tecla.
  const q = normalizar(busqueda)
  const visibles =
    q === ""
      ? importables
      : importables.filter(
          (i) => normalizar(i.nombre).includes(q) || normalizar(i.nombreUsuario).includes(q)
        )

  const faltan = importables.filter((i) => !i.yaEsta).length

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white"
        >
          {abierto ? "Cerrar" : "Importar desde la obra social"}
        </button>
        {!abierto && !error && (
          <span className="text-sm text-gris-80">
            {faltan === 0
              ? "No queda nadie por importar."
              : `${faltan} personas sin importar todavía.`}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-osp">
          {error}
        </p>
      )}

      {abierto && !error && (
        <form action={accion} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold">Buscar</span>
            <input
              className="rounded-lg border-2 border-gris-70 bg-white px-3 py-2 focus:border-gris-principal focus:outline-none"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o usuario"
            />
          </label>

          <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {visibles.length === 0 ? (
              <p className="text-sm text-gris-80">Nadie coincide con esa búsqueda.</p>
            ) : (
              visibles.map((i) => (
                <label
                  key={i.nombreUsuario}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-gris-20"
                >
                  <input
                    type="checkbox"
                    name="nombreUsuario"
                    value={i.nombreUsuario}
                    // Marcado y deshabilitado comunica "ya esta" sin una
                    // segunda lista, y hace imposible reimportarlo sin querer.
                    defaultChecked={i.yaEsta}
                    disabled={i.yaEsta}
                  />
                  <span className={i.yaEsta ? "text-gris-80" : ""}>
                    {i.nombre} <span className="text-gris-80">({i.nombreUsuario})</span>
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              className="rounded-lg bg-gris-principal px-4 py-2 font-semibold text-white disabled:bg-gainsboro disabled:text-gris-80"
              disabled={pendiente}
            >
              {pendiente ? "Importando…" : "Importar seleccionados"}
            </button>
            {estado.guardado && <span className="text-sm text-gris-80">Importados</span>}
            {estado.errores.length > 0 && (
              <span role="alert" className="text-sm text-osp">
                {estado.errores[0].mensaje}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Montar el panel en `app/admin/usuarios/page.tsx`**

Reemplazá el contenido completo del archivo:

```tsx
import { redirect } from "next/navigation"
import { actorActual, puedeEditarCatalogo } from "@/lib/admin/acceso"
import { prisma } from "@/lib/db"
import { listarUsuarios } from "@/lib/admin/usuarios"
import { listarImportables, type Importable } from "@/lib/admin/importacion"
import { TablaUsuarios } from "./TablaUsuarios"
import { PanelImportar } from "./PanelImportar"

export default async function PaginaUsuarios() {
  const actor = await actorActual()
  if (!actor) return null

  // El layout ya dejo afuera a operador y director. Aca cae el supervisor:
  // repartir roles es autoridad de admin.
  if (!puedeEditarCatalogo(actor.rol)) redirect("/admin")

  const [usuarios, boxesCrudos] = await Promise.all([
    listarUsuarios(),
    prisma.box.findMany({
      where: { activo: true },
      include: { ala: { select: { nombre: true } } },
      orderBy: { numero: "asc" },
    }),
  ])

  // Si la base de la obra social no responde, la pantalla lo dice. Una lista
  // vacia se leeria como "no hay nadie para importar", que es lo contrario.
  let importables: Importable[] = []
  let errorImportar: string | null = null
  try {
    importables = await listarImportables()
  } catch {
    errorImportar = "No se pudo consultar la base de la obra social"
  }

  const boxes = boxesCrudos.map((b) => ({
    id: b.id,
    nombre: `${b.nombre} — Ala ${b.ala.nombre}`,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-titulo text-2xl font-semibold">Usuarios</h1>
        <p className="mt-1 text-sm text-gris-80">
          Las contraseñas viven en la base de la obra social y se validan en cada ingreso.
          Acá sólo se decide quién entra al turnero, con qué rol y en qué boxes atiende.
        </p>
      </div>

      <PanelImportar importables={importables} error={errorImportar} />

      <TablaUsuarios usuarios={usuarios} boxes={boxes} actorId={actor.empleadoId} />
    </div>
  )
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`

Expected: los 3 errores preexistentes en `tests/integration/actorActual.test.ts`, `tests/integration/aislamientoAla.test.ts` y `tests/integration/referencias.test.ts`. Ningún error en los archivos nuevos.

- [ ] **Step 5: Correr la suite entera y la E2E**

Run: `npx vitest run`

Expected: PASS.

Run: `npx playwright test e2e/usuarios.spec.ts`

Expected: PASS, 1/1 — el guard sigue en pie después de agregar el panel.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/acciones.ts app/admin/usuarios
git commit -m "feat(sp6): panel de importacion con buscador desde la obra social"
```

---

## Verificación manual al cerrar el plan

Con el servidor de desarrollo corriendo y una sesión de admin abierta:

1. `/admin/usuarios` muestra el botón de importar y la lista de empleados.
2. El botón despliega la lista de la obra social. Los ya importados salen marcados y grises.
3. Escribir en el buscador filtra sin recargar la página.
4. Marcar a alguien e importar lo agrega a la tabla de abajo con rol `operador`.
5. Cambiarle el rol a `supervisor` y guardar: al recargar, sigue en `supervisor`.
6. Tu propia fila tiene el rol y el activo deshabilitados, con la marca "Sos vos".
7. Asignarle un box a un operador y verificar que ese operador puede elegir ese box al entrar por `/operador/login`.
