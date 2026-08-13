# SP2 — Panel de operador y motor de cola

Diseño aprobado. Depende de SP0 (completo) y convive con SP1 (completo).

Este documento se apoya en el diseño general
(`2026-08-05-turnero-kiosco-design.md`) y sólo desarrolla lo que SP2 agrega. Donde el diseño general
ya decidió algo —derivación §6.7, rooms §6.3, matriz de fallos §9.1, retención de DNI— acá se cita,
no se vuelve a decidir.

---

## 1. Qué agrega SP2 y qué no toca

Tres piezas nuevas y una que se borra:

| Pieza | Dónde | Qué hace |
|---|---|---|
| Autenticación | `lib/auth/` | Valida contra la obra social, abre `SesionOperador`, cookie firmada |
| Handlers de comandos | `server/handlers/` | `rellamarTurno`, `marcarAusente`, `iniciarAtencion`, `finalizarAtencion`, `derivarTurno` |
| Panel del operador | `app/operador/` | La interfaz |
| Jobs diarios | `server/jobs/` | Abandonados y retención de DNI |
| ~~`app/OperadorTurno/`~~ | — | Se borra al final, como se hizo con `app/turnero/` en SP1 |

**No se toca:** `lib/queue/` (la máquina de estados y la FIFO están completas y testeadas),
`server/rooms.ts`, `generarTurno`, `llamarTurno`, ni nada del kiosco.

**Límite con SP4:** SP2 **no tiene pantallas de administración**. Cargar empleados y asignar boxes se
hace con un script. El ABM es de SP4.

### 1.1 Por qué no hay migración

SP0 se diseñó contemplando esto: `Empleado`, `EmpleadoBox`, `SesionOperador` y `TurnoEvento` ya están
en la base, y `estado.ts` ya modela las transiciones `rellamado`, `ausente`, `iniciado`, `finalizado`,
`derivado` y `abandonado`. **SP2 no necesita ninguna migración de Prisma.**

---

## 2. El modelo de cola es *pull*, no *push*

Es la propiedad de la que se derivan casi todas las decisiones de abajo, así que conviene dejarla
escrita.

Un turno en `esperando` **no tiene box**. `Turno.boxId` se escribe recién al llamarlo. La cola es un
banco compartido por trámite y cada box mira ese banco y toma el más viejo que puede atender
(`seleccion.ts`):

```ts
.filter((t) => t.estado === "esperando" && box.tramiteIds.includes(t.tramiteId))
```

Consecuencias:

- **Si un box no llama, no pasa nada.** Los turnos siguen esperando. No se pierden ni quedan
  retenidos por un box inactivo.
- **Otro box los consume**, si comparte el trámite vía `BoxTramite`.
- **Dos boxes pueden intentar el mismo a la vez.** Gana uno; el otro recibe `YA_LLAMADO` (§6.3).

**Por eso SP2 no tiene función de pausa.** Un mostrador vacío nunca llama, así que nunca manda gente
a un lugar donde no hay nadie: el problema que una pausa resolvería no existe en un modelo pull. Lo
único que compraría es distinguir "logueado pero ausente" de "logueado y trabajando" para reportes,
y ese dato depende de que la persona se acuerde de apretar el botón — si no lo aprieta, el dato es
peor que no tenerlo, porque parece confiable y no lo es. Si SP5 necesita tiempo operativo por box, se
deriva de los huecos entre eventos de `TurnoEvento`, que se registran solos.

---

## 3. Alta de empleados: script, no pantalla

Un empleado **no se crea solo al loguearse**. Tiene que existir previamente en `Empleado`, cargado
por el script `npm run importar:empleados`.

### 3.1 Quién es empleado en la base institucional

`[ObraSocial].[dbo].[Usuario]` mezcla empleados con afiliados, clínicas, prestadores, otras obras
sociales y organismos externos. Cada tipo se marca en una columna distinta; **empleado es el que no
tiene ninguna marca**:

```sql
SELECT u.nombreUsuario, p.numeroDocPersona, p.nombrePersona, p.apellidoPersona
FROM [ObraSocial].[dbo].[Usuario] u
JOIN [ObraSocial].[dbo].[Persona] p ON p.idPersona = u.idPersona
WHERE u.esAfiliado = 0          -- bit NOT NULL: va con = 0, nunca con IS NULL
  AND u.idClinica IS NULL
  AND u.idPrestador IS NULL
  AND u.codObraSocial IS NULL
  AND u.codOrganismoExterno IS NULL
  AND u.anulado = 0
```

Da **146 empleados activos**. Filtrar sólo por `esAfiliado = 0` dejaría entrar 78 más (42 clínica,
20 organismo externo, 13 prestador, 5 otra obra social).

### 3.2 Qué hace el script

Toma una **lista explícita de `nombreUsuario`** (archivo o argumentos) y no importa los 146 a ciegas:
entre ellos hay gente de `clinica`, `enfermeria` y `AreadeSistemas` que no atiende boxes, más dos
cuentas de prueba (`123456`, `usuarioPrueba2`).

Por cada uno escribe `Empleado` con `dniInstitucional = numeroDocPersona` —la llave entre los dos
sistemas—, `nombre`, y `rol` (`operador` por defecto). Opcionalmente asigna boxes en `EmpleadoBox`.

Es idempotente: volver a correrlo actualiza el nombre y no duplica.

**El script nunca lee `claveUsuario`.**

---

## 4. Login y sesión

### 4.1 Flujo

La pantalla pide **usuario, clave y box**. El box sale de los `EmpleadoBox` de la persona; si tiene
uno solo, va preseleccionado.

1. `SELECT idUsuario, claveUsuario, anulado, esAfiliado, idPersona FROM [ObraSocial].[dbo].[Usuario] WHERE nombreUsuario = @u`
2. Rechazar si no existe, `anulado = 1`, o `esAfiliado = 1`
3. `bcrypt.compare(clave, row.claveUsuario)` — si falla, rechazar
4. Traer `numeroDocPersona` de `Persona`; buscar `Empleado` por `dniInstitucional`
5. Si no existe el `Empleado` → rechazar: *"Tu usuario es válido pero no estás habilitado en el turnero"*
6. Verificar que el box elegido esté en sus `EmpleadoBox`
7. Crear `SesionOperador`; devolver cookie `httpOnly` firmada con el id de sesión

Los pasos 1–3 devuelven **el mismo mensaje genérico** ante cualquier fallo, para no confirmar qué
usuarios existen. El paso 5 sí es específico: ahí la credencial ya se validó, y el mensaje le sirve a
una persona legítima para saber que tiene que pedir el alta.

### 4.2 El hash

**bcrypt costo 10, uniforme.** Las 20.277 filas de `Usuario` miden exactamente 60 caracteres y
arrancan con `$2b$10$`. No hay algoritmos legacy mezclados, así que `bcrypt.compare()` sirve para
todos sin casos especiales.

Se usa **`bcryptjs`**, no `bcrypt`: el nativo necesita node-gyp y herramientas de compilación, que en
Windows es dolor recurrente. A costo 10 y ~146 logins diarios, la diferencia de velocidad no se
percibe.

### 4.3 Restricción de seguridad

**La clave (ni su hash) se copia, cachea o loguea en el turnero.** Se valida en vivo contra
`[ObraSocial].[dbo].[Usuario]` en cada login y se descarta. Copiar el hash lo desincronizaría cuando
la persona la cambie, y dejaría entrar a alguien dado de baja.

La conexión a `ObraSocial` es de **sólo lectura**: se accede por nombre de tres partes con
`$queryRaw`, nunca se le corre una migración.

### 4.4 La sesión es la fila de `SesionOperador`

No hay JWT. La cookie lleva sólo el id de sesión y la fila en la base es la fuente de verdad, porque
`SesionOperador` ya responde *"quién está en el Box 3 ahora mismo"* — que es un requisito del
producto, no un subproducto de la autenticación. Un JWT stateless sería un segundo mecanismo en
paralelo que no reemplaza al primero, y perdería lo que más importa: poder revocar.

El socket autentica leyendo la misma cookie en el handshake y se une a `box:{id}`.

### 4.5 Box ocupado

Si el box tiene sesión abierta con latido reciente → rechazar: *"Box 3 tiene sesión abierta por
Silvia Flores"*.

Si el latido está vencido (más de `MINUTOS_SESION_VENCIDA`, por defecto 15) → cerrar la vieja y abrir
la nueva. Resuelve solo el caso de quien cerró el navegador sin desloguearse, sin depender de una
pantalla de supervisor que en SP2 no existe.

### 4.6 Reconexión y cierre

Un refresh o un corte de red **recuperan el turno en curso**: llega en el `SNAPSHOT`, porque la
sesión vive en la base y no en memoria del cliente (§9.4 del diseño general).

**Cerrar sesión con un turno en `atendiendo`** pide resolverlo primero —finalizar o derivar—, porque
dejarlo colgado ensucia las estadísticas de SP5. Para quien no cierra sesión y se va, el job diario
levanta los `atendiendo` huérfanos (§7.1).

---

## 5. El panel

### 5.1 Estados y acciones

Un solo turno activo por vez. **Los botones disponibles se derivan de `estado.ts`**: la UI no
reimplementa las reglas, las proyecta. Si mañana cambia una transición, cambia en un solo lugar.

| Estado | Muestra | Acciones |
|---|---|---|
| *(ninguno)* | La cola | **Llamar siguiente** |
| `llamado` | Número, nombre, trámite | **Iniciar atención** · Rellamar · Marcar ausente · Derivar |
| `atendiendo` | Ídem + cronómetro | **Finalizar** · Derivar |

### 5.2 Disposición

Dos columnas, aprovechando el monitor de escritorio.

**Izquierda — el turno.** Número en grande (mismo tratamiento tipográfico que el kiosco), nombre del
afiliado si lo hay, trámite, y los botones. Sin turno activo, sólo el botón de llamar.

**Derecha — la cola.** Arriba, el contador con **desglose por trámite**, siempre visible:

> **14 esperando** — 6 Carnet · 5 Recepción de Expedientes · 3 Aportes

El desglose es **por trámite, no por categoría**. `Afiliaciones` es una categoría; sus trámites son
`Aportes`, `Carnet` y `Recepción de Expedientes`. Un operador de Afiliaciones necesita saber cuántos
son para carnet y cuántos para expedientes, no un total de su área. Si un box atendiera trámites de
más de una categoría, se agrupan bajo el nombre de la categoría.

Abajo, la **lista nominal desplegable**, colapsada por defecto: número, trámite y hace cuánto espera
cada uno.

Separada, la sección de **ausentes del box**, con su propio botón de llamar. Es la única vía que
saltea la FIFO, y está permitida porque `estado.ts` ya modela `ausente → llamado`.

### 5.3 Por qué la lista no permite elegir

Se ve la cola completa pero **el botón siempre llama al primero**. Ver "hay 14 esperando, el más
viejo desde hace 40 minutos" cambia cómo se trabaja el día y es información que hoy no existe. Pero
poder saltear, además de injusto, ensucia las estadísticas de espera de SP5 y elimina la única
garantía que el sistema le da al afiliado.

### 5.4 Atajos de teclado

El camino feliz completo es una tecla: **Enter** ejecuta la acción principal del estado actual
—llamar → iniciar → finalizar—. Las secundarias van por letra: `R` rellamar, `A` ausente, `D`
derivar.

**Ausente y derivar no van en Enter** y piden confirmación: no se pueden deshacer y no deben
dispararse por un Enter de más.

Los atajos se desactivan mientras haya un campo de texto enfocado (el buscador de derivación).

### 5.5 Derivación

Buscador del catálogo → se elige trámite destino → al confirmar, la pantalla muestra **ala, piso y
área destino en grande** para leérselo en voz alta al afiliado.

**No se imprime nada** y **el número no cambia**: la persona conserva el ticket que ya tiene, que es
el motivo entero de no imprimir. El handler crea un turno nuevo con el mismo `numero`, `fecha` y
`createdAt`, `tramiteId` destino y `derivadoDeId` al origen; el origen pasa a `derivado`. Dos filas,
no una mutación (§6.7 del diseño general).

**El contador del trámite destino no se toca**: si se incrementara, la serie del destino saltearía
números.

### 5.6 Datos

Al conectar, `SNAPSHOT` con la cola del box y el turno en curso si lo hay. Después, sólo deltas por
las rooms que ya define `rooms.ts`. Nada de reenviar el estado completo.

---

## 6. Handlers

Todos con la misma forma que los de SP0: **validar → transacción Prisma → escribir `TurnoEvento` →
emitir a las rooms**. El evento se escribe dentro de la transacción.

| Handler | Transición | Nota |
|---|---|---|
| `rellamarTurno` | `llamado → llamado` | Cada rellamado queda como evento propio |
| `marcarAusente` | `llamado → ausente` | Sale de la cola activa, entra a la de ausentes del box |
| `iniciarAtencion` | `llamado → atendiendo` | Arranca el cronómetro real de la atención |
| `finalizarAtencion` | `atendiendo → finalizado` | **Sin umbral de duración** — el hallazgo 4 del diseño general era registrar sólo atenciones ≥7 min |
| `derivarTurno` | `llamado`/`atendiendo` `→ derivado` | Crea la fila destino en la misma transacción |

Todos verifican que el turno pertenezca al box de la sesión, salvo `llamarTurno`, que es justamente
el que lo asigna.

### 6.1 Errores tipados, nunca mudos

Cada handler responde `{ ok: false, codigo, mensaje, detalle }` en vez de tragarse la excepción
(§9.5). `mensaje` es para el operador; `detalle` para el log.

El caso concreto es dos boxes que comparten trámite: si el otro ganó la carrera, `llamarTurno`
devuelve `YA_LLAMADO` con el box que se lo llevó, y el panel muestra *"Ese turno ya fue llamado por
el Box 3"* y ofrece el siguiente.

Degradación a la vista, según la matriz de §9.1: socket cortado → banner "Sin conexión" y botones
deshabilitados con motivo visible; SQL Server caído → banner rojo y acciones deshabilitadas.

---

## 7. Jobs diarios

En `server/jobs/`, disparados por el custom server. **Ambos idempotentes**: correrlos dos veces no
cambia nada.

Ambos corren a `HORA_CIERRE_DIARIO` (23:00 por defecto).

| Job | Qué hace |
|---|---|
| Abandonados | Todo lo que quedó en `esperando` pasa a `abandonado`. Ver el tratamiento de los `atendiendo` huérfanos abajo |
| Retención de DNI | Borra `Turno.dni` de turnos con más de `RETENCION_DNI_DIAS` (90). El turno queda, el dato personal no |

Corre a hora fija y **no al cerrar el último box**, porque "cerrado" sólo detiene la emisión de
tickets: los turnos en cola se siguen atendiendo después del horario (§5.2).

### 7.1 Los `atendiendo` huérfanos

Son los turnos que quedaron abiertos porque el operador se fue sin finalizarlos. El diseño general
(§9.4) pide marcarlos para revisión "en vez de dejarlo colgado en `atendiendo`".

`estado.ts` no tiene ninguna transición fuera de `atendiendo` salvo `finalizado` y `derivado`, y
agregar un estado nuevo obligaría a una migración que este sub-proyecto no necesita para nada más.
La resolución, entonces:

**El job los pasa a `finalizado` y escribe un `TurnoEvento` de tipo `revision`** con el motivo en
`detalle`. Quedan cerrados, no colgados, y el evento los deja identificables.

La contrapartida es que engrosan el conteo de atendidos. Se acepta porque el evento permite
excluirlos: **SP5 debe descartar de las métricas de duración los turnos que tengan un evento
`revision`**, cuyo tiempo medido no corresponde a una atención real.

---

## 8. Testing

**Unitarios** sobre lo puro. `estado.ts` y `seleccion.ts` ya están cubiertos por SP0; se suma el
armado del desglose por trámite.

**Integración** contra `Turnero_Test` para cada handler nuevo, más los dos casos que son la razón de
ser de este diseño:

- **Dos boxes llamando el mismo turno** — uno gana, el otro recibe `YA_LLAMADO` con el box correcto.
- **Derivación** — deja dos filas, el mismo `numero`, y el contador del trámite destino intacto.

**Login** con hashes bcrypt generados en el test, sin tocar la obra social. Casos: clave correcta,
clave incorrecta, usuario anulado, `esAfiliado = 1`, usuario válido sin `Empleado`, box no asignado,
box ocupado con latido fresco, box ocupado con latido vencido.

**Jobs**, incluyendo que sean idempotentes: correrlos dos veces deja el mismo resultado. Para
abandonados, que no toque los `finalizado` ni los `atendiendo` vivos; para huérfanos, que cierre y
escriba el evento `revision`; para retención, que borre el DNI y **no** borre el turno.

**E2E** de Playwright sobre el camino completo: login → llamar → iniciar → finalizar.

---

## 9. Variables de entorno nuevas

| Variable | Por defecto | Para qué |
|---|---|---|
| `SESION_SECRETO` | *(sin default)* | Firma de la cookie. Obligatoria |
| `MINUTOS_SESION_VENCIDA` | `15` | Cuándo se puede tomar un box con sesión colgada |
| `HORA_CIERRE_DIARIO` | `23:00` | Job de abandonados |
| `RETENCION_DNI_DIAS` | `90` | Job de retención |

---

## 10. Fuera de alcance

- **Pantallas de administración** (alta de empleados, asignación de boxes, ABM de catálogo) → SP4
- **Panel del supervisor**, incluido el marcado de cadenas de derivación de 3+ → SP4
- **Pantallas de TV y audio por ala** → SP3. SP2 emite los eventos que SP3 va a consumir
- **Dashboard de estadísticas** → SP5
- **Función de pausa** — descartada, ver §2
