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

## Estado real al 2026-08-12

Todo vive en **`main`**, pusheado. No hay ramas de trabajo activas.

**SP0 — COMPLETO.** Todas las 16 tareas están hechas y los tests pasan.

**SP1 — COMPLETO.** Todas las 14 tareas están hechas. 7 tests E2E pasan a 1920×1080.

**Verificación actual:**
- `npm test` → **97 tests, 18 archivos, todos en verde** (incluidos integración contra SQL Server real)
- `npm run test:e2e` → **7 tests E2E Playwright, todos en verde**
- `npx tsc --noEmit` → errores en código legacy (`app/OperadorTurno/`, `app/public-display/`) que preexisten; el kiosco compila limpio. Se limpian en SP2/SP3 cuando se reemplacen esas rutas.

**Base de datos:**
- `Turnero` y `Turnero_Test` creadas en SQL Server 10.25.1.144.
- Migraciones `20260812111428_inicial` y `20260812121925_derivacion` aplicadas en ambas.
- Seed corrido en ambas: 15 trámites, 4 categorías, 11 boxes.
- `.env.local` → `Turnero`, `.env.test.local` → `Turnero_Test`.
- Guarda de tests verificada: aborta si `DATABASE_URL` no termina en `_Test`.

**Para retomar SP2:** leer la sección SP2 más abajo — los datos de la base institucional ya están relevados.

> El `graphify-out/` versionado es **anterior a todo este trabajo**. Describe módulos que ya no
> existen (Supabase) y no conoce los que sí (`lib/queue/`, `lib/catalogo/`, `app/kiosco/`).
> Regeneralo con `npx graphify .` antes de confiar en él.

## SP2: lo que falta para arrancar el brainstorming

**No hay spec de SP2 todavía.** Retomar con `superpowers:brainstorming`.

**Decidido:** los operadores entran con **usuario y contraseña de la base de la obra social**, la
misma credencial que ya usan en el sistema interno. No se crea un usuario nuevo para el turnero.

**La contraseña (ni su hash) no se copia al turnero.** Razones en el diseño previo del CLAUDE.md y
confirmadas por lo que se ve en la base: si se copiara el hash bcrypt, quedaría desincronizado cuando
la cambien y un empleado dado de baja seguiría entrando.

### Datos relevados de la base institucional (`paginaobrasocialprueba`)

**1. ¿Cómo se valida una credencial?**
No hay stored procedure de autenticación. Hay que:
- Leer `[User].password` WHERE `[User].usuario = ?`
- Verificar el hash con **bcrypt** (costo 12, prefijo `$2b$12$`) usando `bcryptjs` o `bcrypt` en Node.
- No hay columna de salt separada: el salt está embebido en el hash de bcrypt, como siempre.
- Filtrar además por `[User].activo = 1` para no dejar entrar a usuarios deshabilitados.

Nota: algunos usuarios de prueba tienen password en texto plano (`len=6`). Ignorar eso; en producción
todos los reales tienen bcrypt.

**2. ¿Qué es el "usuario"?**
El campo `[User].usuario` — nombre de usuario libre tipo `juanp`, `emi25`, `marial`. No es el DNI ni
el legajo. Es lo que la persona ya tipea hoy para entrar al sistema interno.

**3. ¿Qué tabla y columnas tienen los empleados?**

Tabla `[User]` (autenticación):
- `usuario` nvarchar — nombre de usuario (campo de login)
- `password` nvarchar — hash bcrypt
- `activo` bit — 1=activo, 0=deshabilitado
- `employeeId` int → FK a `[Employee].id`
- `roleId` int → FK a `[Role].id`

Tabla `[Employee]` (persona):
- `id` int — PK
- `dni` nvarchar — DNI del empleado
- `name` nvarchar — nombre completo
- `status` nvarchar — valores observados: `'Activo'`, `'Licencia'`
- `departmentId` int → FK a `[Department].id`
- `officeId` int → FK a `[Office].id`

Tabla `[Role]` (roles disponibles):
- 1 ADMIN, 2 USER, 3 RRHH, 4 ESTADISTA, 5 SUPERVISOR

**Para importar a `Empleado` del turnero**: JOIN `[User]` con `[Employee]` por `employeeId`. Traer
`usuario`, `dni`, `name`, `status`, `roleId`. Filtrar por `activo=1` en User. Los con `status=Licencia`
se pueden importar igual: siguen siendo empleados válidos.

**El login del turnero — flujo confirmado:**
1. Recibir `usuario` + `password` del formulario
2. `SELECT usuario, password, activo, employeeId FROM [User] WHERE usuario = @usuario`
3. Si no existe o `activo=0` → rechazar
4. `bcrypt.compare(password, row.password)` → si false → rechazar
5. Si true → buscar en `Empleado` del turnero por `dniInstitucional` (o importar si no existe)
6. Crear `SesionOperador`

**Preguntas de diseño todavía sin respuesta** (para el brainstorming):
- ¿Qué dispositivo usa el operador — PC de escritorio o tablet?
- ¿Una persona puede cubrir más de un box a la vez?
- ¿El panel muestra la cola completa o sólo el siguiente turno?
- ¿Qué roles del sistema institucional pueden ser operadores del turnero? (Probablemente USER, SUPERVISOR y RRHH)

**Alcance de SP2:** panel de operador y motor de cola — llamar, rellamar, marcar ausente, iniciar
atención, finalizar, y **el handler `derivarTurno` con su interfaz** (el modelo y la transición ya
están hechos, ver §6.7 del spec). Más `SesionOperador` con latido, el job diario de abandonados y el
job de retención de DNI.

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

Supabase fue retirado en SP0 Task 14. `app/turnero/` fue retirado en SP1 Task 13.

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
| SP0 | Fundación de datos, motor de cola, rooms | **COMPLETO** |
| SP1 | Kiosco v2 | **COMPLETO** |
| SP2 | Panel de operador y motor de cola completo | Sin spec — datos de base relevados, listo para brainstorming |
| SP3 | Pantallas de TV y audio por ala | Sin spec |
| SP4 | Panel de administración | Sin spec |
| SP5 | Dashboard de estadísticas | Sin spec |

SP2 a SP5 necesitan su propio ciclo de brainstorming → spec → plan. El modelo de datos de SP0 ya los
contempla.

## Pendientes externos

Están en §12 del spec:

1. ~~`DATABASE_URL` de la instancia institucional~~ → **Resuelto.** `10.25.1.144:1433`, usuario `prueba23`.
2. Nombre y columnas del objeto de afiliados → parcialmente: hay tabla `[Employee]` con `dni` y `name`. Falta confirmar si afiliados (pacientes) están en otra base o en la misma.
3. Permiso `SELECT` cruzado para el login — SP2 necesita leer `[User]` y `[Employee]` de `paginaobrasocialprueba` desde el proceso del turnero. El login `prueba23` ya tiene acceso (`origin=local` en los datos vistos).
4. Modelo de la impresora térmica y confirmación de que es de 80mm
5. Estructura definitiva de trámites por box (el seed tiene la del pliego)
6. Host y puerto reales del servidor, para la `URLAllowlist` de Chrome

## Idioma

Código y nombres de archivo en español, como el resto del proyecto. Comentarios y commits en español.
