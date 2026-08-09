# Turnero — Sistema de gestión de filas

Kiosco de autoservicio, panel de operador y pantallas de llamado para una institución de salud
(OSP, San Juan). Dos alas (Norte y Sur), dos pisos, ~15 trámites, dos tótems táctiles con impresora
térmica.

---

## Empezá por acá

**El proyecto está en rediseño completo. Hay spec y planes escritos; la implementación no arrancó.**

Leé en este orden:

1. **`docs/superpowers/specs/2026-08-05-turnero-kiosco-design.md`** — el diseño aprobado. Decisiones
   cerradas, diagnóstico del código actual, modelo de datos, UI, hardening, errores y testing.
2. **`docs/superpowers/plans/2026-08-05-sp0-fundacion-datos.md`** — 16 tareas. **Se ejecuta primero.**
3. **`docs/superpowers/plans/2026-08-05-sp1-kiosco-v2.md`** — 14 tareas. Requiere SP0 terminado.

### Sin conexión a la base todavía

Se puede avanzar bastante igual. **No necesitan base:** SP0 tareas 4, 5, 6, 7, 9 y 12 (módulos puros
y repositorio de afiliados con su stub), y SP1 tareas 1, 3, 5, 6, 8, 9 y 11.

Para desbloquear el resto de SP1 sin base, `lib/catalogo/fixture.ts` sirve el mismo catálogo del seed
como objeto estático con `CATALOGO_FIXTURE=on`. **Nunca aplicar el fixture a los tests de
integración:** las tareas 10, 11 y 13 de SP0 prueban `MERGE ... WITH (HOLDLOCK)` y transiciones
condicionadas, que un objeto en memoria no reproduce. Esas quedan pendientes hasta que haya conexión.

Para ejecutarlos usá `superpowers:subagent-driven-development` (recomendado) o
`superpowers:executing-plans`. Los pasos tienen checkboxes para ir marcando.

**Al terminar un plan, actualizá el grafo del repositorio** (última tarea de cada plan):

```bash
npx graphify .
```

## Estado real al 2026-08-07

Todo vive en **`main`**, pusheado. No hay ramas de trabajo activas.

**SP0 — hecho:** tareas 1 (Vitest + guarda), 2 (schema y `lib/db.ts`, **sin migrar**), 4 (tipos),
5 (máquina de estados), 6 (disponibilidad, con dos correcciones), 7 (FIFO), 8 (catálogo + fixture),
9 (repositorio de afiliados), 12 (rooms), y los pasos 1-5 de la 15 (estado y transición de derivación).

**SP1 — hecho:** tareas 1 (tokens y contraste), 2 (shell del wizard), 3 (teclado numérico),
5 (tarjetas y pasos ② ③), 6 (impresión por iframe), 8 (inactividad), 9 (hardening), 11 (scripts del tótem).

**Bloqueado por falta de `DATABASE_URL`:**
SP0 tareas 3, 10, 11, 13, 14, 16 y los pasos 6-9 de la 15 · SP1 tareas 4, 7, 10, 12, 13, 14.

Archivos que el plan pide y **todavía no existen**: `prisma/seed.ts`, `server/index.ts`,
`server/handlers/`, `app/api/afiliados/`, `app/kiosco/pasos/PasoDni.tsx`,
`app/kiosco/pasos/PasoResultado.tsx`, `lib/kiosco/latido.ts`.

**Verificación actual:** `npm run test:unit` → 73 tests, 10 archivos, todos en verde. No hay tests de
integración corriendo porque ninguno puede: necesitan SQL Server.

**Para retomar:** conseguir el `DATABASE_URL` y arrancar por la tarea 2 de SP0 (`prisma migrate dev`),
de la que dependen todas las demás bloqueadas.

> El `graphify-out/` versionado es **anterior a todo este trabajo**. Describe módulos que ya no
> existen (Supabase) y no conoce los que sí (`lib/queue/`, `lib/catalogo/`, `app/kiosco/`).
> Regeneralo con `npx graphify .` antes de confiar en él.

## SP2: dónde quedó el brainstorming

**No hay spec de SP2 todavía.** El diseño se cortó a propósito en la pregunta de autenticación, para
no seguir conjeturando sin ver la base de la obra social. Retomar con `superpowers:brainstorming`.

**Decidido:** los operadores entran con **usuario y contraseña de la base de la obra social**, la
misma credencial que ya usan en el sistema interno. No se crea un usuario nuevo para el turnero.

**Recomendación pendiente de confirmar con la base a la vista** — importar la persona, nunca la
credencial:

- A `Empleado` se traen usuario, DNI, nombre y legajo. Necesarios para asignar boxes, permisos y
  estadísticas.
- La contraseña (ni su hash) **no se copia**. Se valida en vivo contra la base de la obra social en
  cada login. Si se copiara: se desincroniza cuando la cambian, un empleado dado de baja seguiría
  entrando hasta la próxima sincronización, y el turnero pasaría a contener credenciales del sistema
  principal — convirtiéndose en el eslabón por el que se entra a lo demás.

**Lo primero que hay que averiguar en la PC con acceso:**

1. **¿Cómo se valida una credencial?** ¿Hay un stored procedure o una API que reciba usuario y
   contraseña y devuelva sí/no (lo ideal: nunca vemos el hash), o hay que leer la columna del hash y
   verificar acá? Si es lo segundo: **qué algoritmo** (bcrypt, PBKDF2, SHA-256 con salt, MD5) y si hay
   columna de salt aparte.
2. **¿Qué es el "usuario"?** ¿El DNI, el legajo, o un nombre de usuario aparte tipo `jperez`?
3. **¿Qué tabla y columnas** tienen los empleados, y si hay un campo de estado (activo/baja) que
   permita no importar a los que ya no trabajan.

Mientras no se sepa, el diseño previsto es una interfaz `AutenticadorEmpleados` con
`validar(usuario, contraseña)` y una implementación stub, para que enchufar la real sea cambiar una
clase.

**Alcance de SP2:** panel de operador y motor de cola — llamar, rellamar, marcar ausente, iniciar
atención, finalizar, y **el handler `derivarTurno` con su interfaz** (el modelo y la transición ya
están hechos, ver §6.7 del spec). Más `SesionOperador` con latido, el job diario de abandonados y el
job de retención de DNI.

**Preguntas de diseño que quedaron sin hacer**, para retomar después de la autenticación: qué
dispositivo usa el operador (PC de escritorio o tablet), si una persona puede cubrir más de un box a
la vez, y si el panel muestra la cola completa o sólo el siguiente turno.

## El grafo del repositorio

`graphify-out/` tiene el grafo de conocimiento del código. Si necesitás entender cómo se relaciona
algo, **consultalo antes de leer archivos a ciegas**:

- `graphify-out/GRAPH_REPORT.md` — resumen: comunidades, nodos centrales, conexiones inesperadas.
- `graphify-out/graph.json` — el grafo completo, consultable con la skill `graphify`.
- `graphify-out/graph.html` — visualización.

Está desactualizado respecto de los planes: refleja el código **antes** del rediseño.

---

## Estado actual del código

Lo que hay hoy funciona parcialmente y **el spec documenta 15 hallazgos concretos** (§4). Los cuatro
que más importan, porque los planes existen en buena medida para arreglarlos:

1. **La impresión del ticket está rota** — `app/turnero/[departamento]/page.tsx:96` le pasa un `string`
   a una función que espera un objeto `Turno`.
2. **El número de turno se calcula en el cliente** — con dos kioscos, dos personas ven el mismo número.
3. **Race condition en el contador** — `server.ts` hace read-modify-write no atómico.
4. **Las estadísticas están sesgadas** — sólo se registran atenciones de 7 minutos o más.

No los arregles sueltos: están cubiertos por las tareas de los planes, con tests que impiden que vuelvan.

## Stack

| Qué | Con qué |
|---|---|
| Framework | Next.js 15.2.4, App Router, React 19 |
| Servidor | Custom server (`server.ts`) con Socket.io 4 — **no** es un deploy serverless |
| Base | **SQL Server 2022 vía Prisma.** Supabase se retira en SP0 |
| Estilos | Tailwind 3.4 + tokens institucionales |
| Iconos | Lucide. **Sin emojis** |
| Tests | Vitest + Playwright (se instalan en SP0 y SP1) |

**El proyecto todavía tiene Supabase conectado.** Es transitorio: la tarea 14 de SP0 lo retira. No
construyas nada nuevo encima de Supabase.

## Comandos

```bash
npm run dev
```

```bash
npm test
```

`npm run dev` levanta el custom server con `tsx`, no `next dev`. Cambiar eso rompe Socket.io.

## Tres bases de datos

**No se usa Docker.** Todo vive en el SQL Server 2022 de la institución, al que la máquina de
desarrollo llega por red.

| Base | Para qué | Cadena de conexión | Quién la borra |
|---|---|---|---|
| `<Institucional>` | Afiliados y empleados, **sólo lectura** | Se lee por `$queryRaw` con nombre de tres partes | Nadie. **Nunca** se le corre una migración |
| `Turnero` | Los turnos reales | `.env.local` | Nadie |
| `Turnero_Test` | Correr los tests | `.env.test.local` | **Los tests, en cada corrida** |

Los tests hacen `deleteMany()` antes de cada caso. `tests/setup.ts` aborta la suite si
`DATABASE_URL` no apunta a una base terminada en `_Test`: es lo único que separa un typo en el
`.env` de vaciar los turnos reales. **No la desactives.**

Cada migración nueva hay que aplicarla a las dos bases:

```bash
npm run db:test:migrate
```

Si `AFILIADOS_TABLA` no está definida, el repositorio de afiliados usa un stub con tres DNI de prueba.
Es el modo esperado hasta que la institución pase los datos reales.

## Reglas que no se negocian

Salieron de problemas concretos, no de preferencias:

1. **El kiosco nunca muestra ni imprime un número que no esté guardado en la base.**
2. **Cuando algo falla, se degrada a la vista.** Nada de `catch { console.error }` mudo.
3. **El kiosco nunca hace scroll.** Ni horizontal ni vertical.
4. **`--gris-80` (#6f7b7e) no se usa para texto** — da 4.4:1 y no llega a AA. Va en iconos, bordes y
   estados deshabilitados. Hay un test que lo verifica.
5. **La identidad del ala no se comunica por color** — las térmicas imprimen en blanco y negro. Banda
   rellena, tipografía y flecha.
6. **La hora sale del servidor, nunca del kiosco.** Los relojes de los tótems se desfasan.
7. **Sin `window.open` para imprimir.** Iframe oculto + `--kiosk-printing` de Chrome.

## Alcance por sub-proyecto

| | Qué | Estado |
|---|---|---|
| SP0 | Fundación de datos, motor de cola, rooms | Plan escrito |
| SP1 | Kiosco v2 | Plan escrito |
| SP2 | Panel de operador y motor de cola completo | Sin spec |
| SP3 | Pantallas de TV y audio por ala | Sin spec |
| SP4 | Panel de administración | Sin spec |
| SP5 | Dashboard de estadísticas | Sin spec |

SP2 a SP5 necesitan su propio ciclo de brainstorming → spec → plan. El modelo de datos de SP0 ya los
contempla.

## Pendientes externos

Bloquean partes de la implementación, no el arranque. Están en §12 del spec:

1. `DATABASE_URL` de la instancia institucional
2. Nombre y columnas del objeto de afiliados
3. Permiso `SELECT` cruzado para el login de la app
4. Modelo de la impresora térmica y confirmación de que es de 80mm
5. Estructura definitiva de trámites por box (el seed tiene la del pliego)
6. Host y puerto reales del servidor, para la `URLAllowlist` de Chrome

## Idioma

Código y nombres de archivo en español, como el resto del proyecto. Comentarios y commits en español.
