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

**SP2 — COMPLETO.** Panel de operador, login contra la obra social, los cinco handlers de atención,
derivación y los dos jobs diarios. `app/OperadorTurno/` retirado.

El alta de empleados es por script: `npm run importar:empleados -- usuario1 usuario2`. La asignación
de boxes se hace a mano en la base hasta que SP4 traiga el ABM.

**SP3 — COMPLETO.** Dos pantallas de llamado, una por ala, en `/pantalla/norte` y `/pantalla/sur`.
Campanilla sintetizada, reloj y estado de conexión. `app/public-display/` retirado.

Cada TV arranca Chrome apuntado a su URL. **Hay que lanzarlo con
`--autoplay-policy=no-user-gesture-required`**, o la campanilla queda bloqueada: sin gesto del
usuario Chrome no deja sonar nada, y en una TV nadie hace clic. Si igual queda bloqueada, la pantalla
muestra un cartel para tocarla una vez.

La pantalla muestra número, nombre y box. **No muestra el trámite, a propósito:** un nombre junto a
un trámite médico en un pasillo es un dato de salud identificable.

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

**Cambio post-SP1 (2026-08-12): el kiosco ahora es responsive.** El spec (§7.2) definía el
diseño en píxeles fijos calibrados exclusivamente para 1920×1080. Se agregó
`app/kiosco/EscaladorKiosco.tsx`: envuelve el layout del kiosco (que sigue en píxeles fijos, sin
tocar) en un canvas de 1920×1080 y lo escala como unidad con `transform: scale` según el viewport
real. A 1920×1080 la escala es 1 (idéntico al diseño original); en cualquier otra resolución se ve
proporcionalmente igual, sin reflow y sin romper la regla de "nunca hace scroll". El iframe oculto
de impresión (`usarImpresion.ts`) se inyecta fuera del árbol de React, así que no lo afecta el
scale. También se rediseñó `app/page.tsx` (landing raíz, no es parte del kiosco) con el mismo
sistema visual institucional, responsive normal con Tailwind.

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

### Datos relevados de la base institucional (`ObraSocial`) — verificado 2026-08-12

> Una sesión anterior documentó tablas `[User]`, `[Employee]` y `[Role]` con `roleId` numérico.
> **Eso era de `paginaobrasocialprueba`, otra base, y no aplica.** El login de SP2 va contra
> `ObraSocial`, con los nombres y columnas de acá abajo.

**`[ObraSocial].[dbo].[Usuario]`** — 20.277 filas. Columnas que importan:

| Columna | Tipo | Para qué |
|---|---|---|
| `idUsuario` | `nvarchar(1000)` | PK. **No es int** |
| `nombreUsuario` | `nvarchar(50)` | Campo de login. **Único** en las 20.277 filas |
| `claveUsuario` | `nvarchar(300)` | Hash. **No se copia al turnero** |
| `anulado` | `bit` | Filtrar `= 0` |
| `idPersona` | `int` | FK a `Persona`. Nunca nulo |
| `esAfiliado` | `bit` | **El filtro que separa afiliados de empleados** |
| `debeCambiarClave` | `bit` nullable | Sólo 1 usuario lo tiene en 1 |

Ignorar: `refreshTokenUsuario`, `socketIdUsuario`, `idClinica`, `idPrestador`, `codObraSocial`,
`codOrganismoExterno`, `codigoFacturaPor`.

**El hash es bcrypt costo 10, uniforme.** Las 20.277 filas miden exactamente 60 caracteres y
arrancan con `$2b$10$`. **No hay algoritmos legacy mezclados**, así que `bcrypt.compare()` sirve para
todos sin casos especiales. (El CLAUDE.md anterior decía costo 12: era de la otra base.)

**Quiénes son empleados: los que no tienen ninguna de las 5 marcas de "es otra cosa".**

`[Usuario]` mezcla empleados con afiliados, clínicas, prestadores, otras obras sociales y organismos
externos. Cada tipo se marca en una columna distinta; empleado es **el que no tiene ninguna**:

```sql
WHERE esAfiliado = 0            -- bit NOT NULL: va con = 0, NUNCA con IS NULL
  AND idClinica IS NULL
  AND idPrestador IS NULL
  AND codObraSocial IS NULL
  AND codOrganismoExterno IS NULL
  AND anulado = 0
```

**→ 146 empleados activos** (153 sin filtrar por `anulado`).

Cuánto descarta cada marca sobre los 224 no-afiliados: 42 clínica, 20 organismo externo, 13
prestador, 5 otra obra social. Filtrar sólo por `esAfiliado = 0` deja entrar a esos 78.

Dos detalles de la forma de los datos:
- **`esAfiliado` es `bit NOT NULL`**, no admite null: se compara con `= 0`. Las otras cuatro sí son
  nullables y, cuando están vacías, están siempre en `NULL` (nunca cadena vacía), así que
  `IS NULL` alcanza y no hace falta `COALESCE`.
- Los afiliados entran con su número de documento como usuario (20.062 `nombreUsuario` son sólo
  dígitos); los internos usan usuario alfabético (`silviaflores`, `gonzalotello`, `cristinaaballay`).

**Quedan cuentas de prueba adentro del filtro**: `123456` (doc 1234567890) y `usuarioPrueba2`
(doc 12345678). No son personas reales — tenerlas en cuenta al importar.

Roles de esos 146: `Afiliaciones` 18, `AuditoriaMedica` 14, `Reciprocidad` 7, `Jefe/a de
Afiliaciones` 6, y una cola larga de 1–3. **La mayoría no tiene ningún rol cargado**, así que
`UsuarioRol` no sirve como filtro de quién puede operar un box.

**`[ObraSocial].[dbo].[Persona]`** — el JOIN por `idPersona` cierra perfecto: los 215 internos
activos tienen Persona con documento. Columnas útiles: `nombrePersona`, `apellidoPersona`,
`numeroDocPersona`, `tipoDocPersona` (`'DNI'`), `emailPersona`, `telefonoPersona`.

Ojo: **15 de los 215 no tienen `apellidoPersona`** — son cuentas institucionales, no personas
(`albardon` doc 11111117, `epse` doc 11111122, `centro` de santalucia). Para el turnero puede estar
bien que un box tenga cuenta genérica, pero es una decisión de diseño, no un dato.

**Roles: `Rol` + `UsuarioRol`, la clave es `codigoRol` (`nvarchar`), no un id numérico.**
`UsuarioRol(idUsuario, codigoRol, anulado)`. Los roles con más empleados internos activos:
`clinica` 35, `Afiliaciones` 23, `AuditoriaMedica` 15, `JefeAfiliaciones` 8, `Reciprocidad` 8,
`Prestador` 7, `Servicios` 6, `AreadeSistemas` 6, `enfermeria` 4, `farmacia` 4. Hay muchos roles
`Auditor_*` anulados. **No existen los roles ADMIN/USER/RRHH/SUPERVISOR** que mencionaba el
CLAUDE.md anterior.

**El login del turnero — flujo confirmado:**
1. Recibir `nombreUsuario` + clave del formulario
2. `SELECT idUsuario, claveUsuario, anulado, idPersona, esAfiliado FROM [ObraSocial].[dbo].[Usuario] WHERE nombreUsuario = @u`
3. Rechazar si no existe, `anulado = 1`, o `esAfiliado = 1`
4. `bcrypt.compare(clave, row.claveUsuario)` → si false, rechazar
5. Si válida → buscar/importar empleado del turnero por `idPersona` (o `numeroDocPersona`)
6. Crear `SesionOperador`

**Seguridad no negociable:** `claveUsuario` ni su hash se copian a la base del turnero. Se valida en
vivo en cada login contra `[ObraSocial].[dbo].[Usuario]`.

**Preguntas de diseño todavía sin respuesta** (para el brainstorming):
- ¿Qué dispositivo usa el operador — PC de escritorio o tablet?
- ¿Una persona puede cubrir más de un box a la vez?
- ¿El panel muestra la cola completa o sólo el siguiente turno?
- ¿Se restringe por `codigoRol` o alcanza con `esAfiliado = 0`? Los 215 internos activos incluyen
  gente de `clinica`, `enfermeria`, `farmacia` y `AreadeSistemas` que probablemente no atienda boxes.
- ¿Las cuentas institucionales sin apellido (`albardon`, `epse`, `centro`) pueden operar un box, o el
  operador tiene que ser siempre una persona identificable? Afecta la trazabilidad de `TurnoEvento`.

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

```bash
npm run importar:empleados -- silviaflores
```

`npm run dev` levanta el custom server con `tsx`, no `next dev`. Cambiar eso rompe Socket.io.

## Tres bases de datos

**No se usa Docker.** Todo vive en el SQL Server 2022 de la institución, al que la máquina de
desarrollo llega por red.

| Base | Para qué | Cadena de conexión | Quién la borra |
|---|---|---|---|
| `ObraSocial` | Afiliados, **sólo lectura** | Se lee por `$queryRaw` con nombre de tres partes | Nadie. **Nunca** se le corre una migración |
| `paginaobrasocialprueba` | Empleados y login, **sólo lectura** | Ídem (lo usará SP2) | Nadie. **Nunca** se le corre una migración |
| `Turnero` | Los turnos reales | `.env.local` | Nadie |
| `Turnero_Test` | Correr los tests | `.env.test.local` | **Los tests, en cada corrida** |

Los tests hacen `deleteMany()` antes de cada caso. `tests/setup.ts` aborta la suite si
`DATABASE_URL` no apunta a una base terminada en `_Test`: es lo único que separa un typo en el
`.env` de vaciar los turnos reales. **No la desactives.**

Cada migración nueva hay que aplicarla a las dos bases:

```bash
npm run db:test:migrate
```

### Afiliados: `[ObraSocial].[dbo].[Afiliados]` (conectada y verificada)

`AFILIADOS_BASE=ObraSocial` en `.env.local` activa `RepositorioSql`. Sin esa variable se usa
`RepositorioStub` (tres DNI de prueba) — ese es el modo de los tests, y `.env.test.local` **no**
debe definirla.

Semántica de las columnas, relevada sobre las 404.550 filas reales (no es obvia, no la adivines):

| Columna | Qué es |
|---|---|
| `Codigo` | **El documento de la propia persona.** `nchar(8)` con relleno de espacios. Es la columna por la que hay que buscar |
| `Doctit` | **El documento del TITULAR**, compartido por todo el grupo familiar. 86.863 valores se repiten, hasta 18 filas con el mismo. **No identifica a la persona** |
| `Nombre` | `nchar(40)`, formato `"APELLIDO Nombres"`. Es el único campo de nombre confiable (99,99% cargado) |
| `nombreAfiliado` / `apellidoAfiliado` | Sólo el 20% cargado. **No usar** |
| `Parentesco` | `'000'` titular, `'001'` cónyuge, `'002'` hijo, etc. |

Por eso `buscarPorDni` filtra `Codigo = @P1 OR Doctit = @P1` pero **ordena priorizando el match por
`Codigo`**: quien tipea su DNI tiene que verse a sí mismo, no al titular de su grupo. Después
prioriza `anulado = 0` y `Parentesco = '000'`, porque hay ~30.000 códigos duplicados (registros
repetidos de la misma persona, hasta 5 filas).

Hay índices sobre `Codigo` y `Doctit`: la consulta tarda ~5 ms, muy por debajo del timeout de 1500 ms.

Quedan ~6 filas basura en la base origen (`Codigo` 00000000/11111111/99999999, nombres tipo
"AFILIADO SIN DOCUMENTO"). No se filtran a propósito: son 6 de 404.550 y cualquier heurística
arriesgaría descartar DNIs legítimos. La búsqueda nunca bloquea el flujo del kiosco.

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
| SP2 | Panel de operador y motor de cola completo | **COMPLETO** |
| SP3 | Pantallas de TV y audio por ala | **COMPLETO** |
| SP4 | Panel de administración | Sin spec |
| SP5 | Dashboard de estadísticas | Sin spec |

SP2 a SP5 necesitan su propio ciclo de brainstorming → spec → plan. El modelo de datos de SP0 ya los
contempla.

## Notas técnicas para la implementación

**`Date.UTC()` es para `Turno.fecha`, no para `TurnoEvento.timestamp`.** El primero es `DATE` y SQL
Server lo convierte a medianoche UTC, así que hay que consultarlo con `Date.UTC()`. El segundo es
`DATETIME2` y guarda un instante real: ahí el corte del día va en hora local. Aplicar la regla de uno
al otro corre el corte tres horas.

## Pendientes externos

Están en §12 del spec:

1. ~~`DATABASE_URL` de la instancia institucional~~ → **Resuelto.** `10.25.1.144:1433`, usuario `prueba23`.
2. ~~Nombre y columnas del objeto de afiliados~~ → **Resuelto.** `[ObraSocial].[dbo].[Afiliados]`, conectada y verificada end-to-end en el kiosco. Ver "Afiliados" más arriba.
3. ~~Permiso `SELECT` cruzado para el login~~ → **Resuelto.** El login lee `[Usuario]` y `[Persona]` de `ObraSocial` y funciona con el usuario `prueba23`.
4. Modelo de la impresora térmica y confirmación de que es de 80mm
5. Estructura definitiva de trámites por box (el seed tiene la del pliego)
6. Host y puerto reales del servidor, para la `URLAllowlist` de Chrome

## Idioma

Código y nombres de archivo en español, como el resto del proyecto. Comentarios y commits en español.
