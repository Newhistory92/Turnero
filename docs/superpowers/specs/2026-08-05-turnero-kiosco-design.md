# Diseño: Turnero — Fundación de datos (SP0) + Kiosco v2 (SP1)

**Fecha:** 2026-08-05
**Estado:** aprobado, pendiente de plan de implementación
**Alcance de este documento:** SP0 y SP1 únicamente. SP2–SP5 se especifican por separado.

---

## 1. Contexto

El sistema actual (`Turnero/`) es un Next.js 15.2.4 con servidor propio, Socket.io y Supabase como almacén.
Cubre un flujo mínimo —kiosco por departamento, panel de operador, pantalla pública— con el catálogo de
servicios y boxes hardcodeado en `lib/types.ts`.

El pliego nuevo pide un sistema de gestión de filas para una institución con dos alas, dos pisos, ~15 trámites,
kioscos de autoservicio con impresión térmica, identificación por DNI, panel de administración sin código,
llamados segmentados por ala con TV y audio, y un tablero de estadísticas.

## 2. Descomposición en sub-proyectos

El pedido son seis subsistemas independientes. Se descompone así; cada uno tiene su propio ciclo
spec → plan → implementación.

| # | Sub-proyecto | Depende de |
|---|---|---|
| **SP0** | Fundación de datos: schema, catálogo configurable, diario de eventos | — |
| **SP1** | Kiosco v2: wizard, impresión, hardening, accesibilidad | SP0 |
| **SP2** | Operador + motor de cola: llamar, rellamar, ausente, finalizar | SP0 |
| **SP3** | Pantallas de llamado por ala + audio | SP0, SP2 |
| **SP4** | Panel de administración | SP0 |
| **SP5** | Dashboard de estadísticas | SP0, SP2 |

Con SP0 + SP1 + SP2 el sistema reemplaza al actual y es desplegable. SP3–SP5 se agregan encima sin
modificar lo anterior.

**Este documento cubre SP0 y SP1.**

## 3. Decisiones cerradas

| Tema | Decisión |
|---|---|
| Persistencia | **SQL Server 2022** vía Prisma. Supabase se retira (queda comentado en el arranque, no se borra la referencia hasta el corte definitivo) |
| Bases | **Dos.** La institucional (afiliados y empleados, **sólo lectura**) y la del turnero (nuestra, con migraciones), **en la misma instancia** |
| Acceso a afiliados | Tabla o vista directa, leída con `$queryRaw` y nombre de tres partes. **Un solo `PrismaClient`**, sin segundo datasource |
| Plataforma del kiosco | **Windows + Chrome en modo kiosco.** Se puede tocar el SO: políticas, autoarranque, watchdog |
| Identificación | **DNI obligatorio de tipear.** No obligatorio que exista en la base: si no se encuentra, el flujo sigue y el ticket lleva el DNI |
| Arquitectura de información | **Dos niveles**: categoría (4) → trámite (2 a 7). No una grilla de 15 |
| Asignación de box | **Al llamar**, no al imprimir. El ticket lleva ala, piso y área; el box lo anuncian TV y audio |
| Horarios | Viven **en el box y en el trámite**. Cerrado = deja de emitir tickets; los turnos en cola se siguen atendiendo hasta agotarse |
| Productividad | Se guarda todo y se clasifica **al consultar**, con umbral **por trámite**. Se elimina el filtro de 7 minutos al escribir |
| Enfoque de arquitectura | **Evolución dirigida** del servidor Socket.io actual. No reescritura, no motor en memoria |
| Orientación de pantalla | **Apaisada**, base 1920×1080 |
| Paleta | **Oficial de la institución** (ver §7.4) |

## 4. Diagnóstico del sistema actual

Hallazgos que este diseño corrige. Documentados para que no se reintroduzcan.

### Bugs que rompen funcionalidad

1. **La impresión del ticket está rota.** `app/turnero/[departamento]/page.tsx:96` llama
   `printTicket(turnoGenerado)` con un `string`, pero `Ticket Printer.tsx:4` espera un objeto `Turno`.
   `SERVICIOS[turno.servicio]` da `undefined` → TypeError.
2. **El número se calcula en el cliente.** `page.tsx:70-76` lo deriva del contador local y lo muestra e
   imprime sin esperar confirmación del servidor. Con dos kioscos, dos personas ven el mismo número.
3. **Race condition en el contador.** `server.ts:121-144` hace read-modify-write no atómico.
4. **Estadísticas sesgadas por diseño.** `OperadorTurno/page.tsx:104` sólo registra atenciones ≥7 minutos.
5. **El estado `atendido` nunca se setea** (el server va de `llamado` a `finalizado`), así que el contador
   de "Turnos Completados" siempre muestra 0.
6. **El botón "Iniciar Sesión" del operador no hace nada**: `onClick={() => empleado && setEmpleado(empleado)}`.
7. **Los errores se tragan.** Los cuatro handlers de `server.ts` terminan en `catch { console.error }` y el
   cliente nunca se entera.

### Problemas estructurales

8. **`window.open()` para imprimir** (`Ticket Printer.tsx:55`): rompe el fullscreen, lo bloquea el popup
   blocker, deja ventanas huérfanas. Es un candidato fuerte a ser la causa del "los usuarios cierran o
   minimizan el navegador" que reporta el pliego.
9. **Catálogo hardcodeado** en `lib/types.ts` como `as const`. Cambiar la asignación de un box exige recompilar.
10. **El modelo de datos no contempla** alas, pisos, DNI, empleados, permisos, horarios por box, ausentes ni abandonados.
11. **Sin ruteo por ala.** `STATE_UPDATE` es un broadcast global; `loadStateFromSupabase()` corre tres consultas
    completas por evento y se emite a todos.
12. **Dos fuentes de verdad**: `prisma/schema.prisma` apunta a SQL Server con un modelo desactualizado y
    sobrevive `app/config/primsma.ts` (con el typo incluido), mientras el servidor usa Supabase.
13. **Los contadores nunca se reinician.** `server.ts:127` hace `valor + 1` indefinidamente.
14. **Accesibilidad** contraria a lo que exige un kiosco: `text-sm`/`text-xs`, ticket en 8px, gris sobre
    gradientes, targets pequeños, emoji como icono (`SeleccionServicio.tsx:86`).
15. **Cero tests.** `package.json` no tiene script de test ni framework.

---

## 5. SP0 — Modelo de datos

Principio: **el box no pertenece a un área, el box tiene trámites asignados.** Es lo único que permite
cumplir "hoy Box 1 = Prótesis, mañana Box 1 = Bioquímica, sin tocar código".

### 5.1 Estructura física

| Modelo | Campos clave | Nota |
|---|---|---|
| `Sede` | `nombre`, `activa` | Una fila. Existe para "múltiples edificios" sin migración futura |
| `Ala` | `sedeId`, `nombre`, `orden` | Norte, Sur |
| `Piso` | `sedeId`, `nombre`, `nivel` | Planta Baja (0), Planta Alta (1) |
| `Box` | `alaId`, `pisoId`, `numero`, `nombre`, `activo`, `horaApertura`, `horaCierre`, `diasSemana` | **`unique(alaId, numero)`** — resuelve el "Box 1" ambiguo entre alas |

### 5.2 Catálogo de servicios (editable por admin)

| Modelo | Campos clave | Nota |
|---|---|---|
| `Categoria` | `nombre`, `icono`, `orden`, `activa` | Nivel 1 del kiosco: 4 tarjetas |
| `Tramite` | `categoriaId`, `nombre`, `subtitulo`, `icono`, `prefijo`, `destinoAlaId`, `destinoPisoId`, `horaApertura`, `horaCierre`, `diasSemana`, `duracionMinimaEsperada`, `orden`, `activo` | Nivel 2. ~15 filas |

Convenciones de campos, para que el panel de admin no tenga que adivinar:

- `icono` — nombre del icono de Lucide (`"CreditCard"`, `"Stethoscope"`). Se valida contra la lista al guardar.
- `diasSemana` — string de dígitos ISO, lunes=1 (`"12345"` = lunes a viernes).
- `horaApertura` / `horaCierre` — `HH:mm` en hora local de la institución.
- `duracionMinimaEsperada` — **minutos**. Es el umbral de clasificación de §6.7, no un límite ni una alarma.

**No hay campo `color`.** La paleta institucional (§7.4) es monocroma más un rojo de identidad; un color por
categoría no tendría dónde renderizarse y el ala se comunica por forma y tipografía, no por color (§7.3).
| `BoxTramite` | `boxId`, `tramiteId` | Muchos a muchos. **La tabla que hace todo configurable** |

**El destino (ala + piso) se guarda en el trámite, no se deriva de sus boxes.** Es redundante a propósito:
si un trámite se queda momentáneamente sin boxes abiertos, el ticket igual tiene que decir a dónde ir.
El panel de admin (SP4) avisa si el destino no coincide con los boxes asignados.

**El horario vive en el box y en el trámite.** La disponibilidad efectiva es la intersección: un trámite
emite ticket si está activo, dentro de su propio horario, y tiene al menos un box activo dentro del horario
del box. La ventana efectiva es lo que se muestra al usuario cuando está cerrado, así que nunca miente.

**Cerrado = deja de emitir tickets, no deja de atender.** El chequeo de horario gatilla sólo la generación.
El panel del operador nunca se bloquea por horario: los turnos en cola se atienden hasta agotarse.

### 5.3 Operación

| Modelo | Campos clave | Nota |
|---|---|---|
| `Turno` | `numero`, `fecha`, `tramiteId`, `dni`, `nombreAfiliado?`, `estado`, `boxId?`, `requestId`, `derivadoDeId?`, `createdAt` | `estado`: `esperando · llamado · atendiendo · finalizado · derivado · ausente · abandonado` |

`fecha` y `createdAt` no son lo mismo y conviene no confundirlos: `fecha` es el **día hábil** (`DATE`), y es
lo que participa del `unique` del contador; `createdAt` es el **instante exacto** (`DATETIME2`) y es lo que se
imprime y se usa para medir. Si alguna vez la institución abre pasada la medianoche, `fecha` la define una
función de día hábil, no `CAST(createdAt AS DATE)`.
| `TurnoEvento` | `turnoId`, `tipo`, `boxId?`, `empleadoId?`, `timestamp` | **Append-only.** Nunca se edita ni se borra. De acá salen todas las métricas |
| `Contador` | `tramiteId`, `fecha`, `valor` | **`unique(tramiteId, fecha)`** → el reinicio diario sale gratis, sin cron |
| `Empleado` | `dniInstitucional`, `nombre`, `rol`, `activo` | Importado, nunca creado acá. `rol`: `operador · supervisor · administrador` |
| `EmpleadoBox` | `empleadoId`, `boxId` | Un empleado puede estar asignado a varios boxes |
| `SesionOperador` | `empleadoId`, `boxId`, `inicio`, `fin?`, `ultimoLatido` | Responde "operador actual" y "box actual" |
| `Kiosco` | `nombre`, `alaId?`, `version`, `ultimoLatido`, `ultimoErrorImpresion?` | Monitoreo de los dos tótems |

`Turno.createdAt` lo sella el **servidor** dentro de la transacción. Es la hora que se imprime, la que ve
la TV y la que usa el dashboard. Los relojes de los kioscos no se usan para nada.

`Turno.requestId` es la clave de idempotencia contra el doble toque (§9.2).

`Turno.dni` es dato personal: se conserva el turno y **el DNI se borra a los 90 días**, por un job diario.
El plazo es configurable por entorno (`RETENCION_DNI_DIAS`); 90 es el valor por defecto, no un requisito
legal verificado — si la institución tiene una política propia, manda esa.

### 5.4 Base institucional (sólo lectura)

No se modela en Prisma. Un módulo `AfiliadoRepository` con `$queryRaw` a
`[BaseInstitucional].[esquema].[tabla]`, con base, esquema, tabla y el mapeo de columnas (DNI, apellido,
nombre) en variables de entorno.

Interfaz de un método: `buscarPorDni(dni) → { nombre } | null`. Si falla o tarda más de 1,5 s devuelve
`null` y el kiosco sigue con el DNI.

**Requisito de infraestructura:** el login SQL de la aplicación necesita `SELECT` en la base institucional
además de permisos de escritura y migración en la del turnero.

### 5.5 Consecuencias

- Generación de turno = un `$transaction` con `UPDATE Contador ... OUTPUT INSERTED.valor` +
  `INSERT Turno` + `INSERT TurnoEvento`. Resuelve el número duplicado.
- `lib/types.ts` deja de ser fuente de verdad y queda sólo con tipos.
- `prisma/schema.prisma` se reescribe completo. El modelo `Turno` actual con `id Int` no sobrevive.
- `app/config/primsma.ts` se elimina.

---

## 6. SP0 — Dominio y servidor

### 6.1 El motor de cola sale de React

Hoy la lógica vive dentro de los componentes (`OperadorTurno/page.tsx:46-61` filtra colas y elige el
siguiente turno durante el render). Pasa a `lib/queue/`, tres módulos **puros** — sin Prisma, sin Socket.io:

- **`estado.ts`** — `transicion(turno, evento) → turno | ErrorTransicion`. Un solo lugar define qué
  transiciones son válidas.
- **`disponibilidad.ts`** — `estaDisponible(tramite, boxes, ahora) → { disponible, ventanaEfectiva, motivo }`.
- **`seleccion.ts`** — `siguienteTurno(cola, box) → turno | null`. FIFO estricta por antigüedad entre todos
  los trámites que atiende ese box. Sin prioridades.

### 6.2 Catálogo cacheado

`lib/catalogo/` lee alas, pisos, boxes, categorías, trámites y asignaciones una vez, cachea en memoria y
expone `invalidar()`. SP4 lo llama al guardar y emite `CATALOGO_ACTUALIZADO`.

### 6.3 Rooms de Socket.io

| Room | Quién entra |
|---|---|
| `kiosco` | Los dos kioscos — para deshabilitar trámites en vivo |
| `ala:norte` · `ala:sur` | TVs y audio de cada ala |
| `piso:1:ala:norte` | Servicio Social en planta alta |
| `box:{id}` | El panel del operador de ese box |
| `admin` | Dashboards |

### 6.4 Eventos delta

`STATE_UPDATE` con el estado completo desaparece. En su lugar:

`TURNO_GENERADO` · `TURNO_LLAMADO` · `TURNO_RELLAMADO` · `TURNO_AUSENTE` · `TURNO_INICIADO` ·
`TURNO_FINALIZADO` · `CATALOGO_ACTUALIZADO` · `ERROR`

Cada uno se emite sólo a las rooms que le importan. Al conectar, un cliente recibe un `SNAPSHOT` acotado
a lo suyo.

### 6.5 Estructura del servidor

`server.ts` queda como arranque. Cada comando va a `server/handlers/`, todos con la misma forma:
**validar → transacción Prisma → escribir `TurnoEvento` → emitir a las rooms**. El evento se escribe
dentro de la transacción.

### 6.6 Ausentes, rellamado y abandonados

El operador tiene **Rellamar** (mismo turno otra vez, cada rellamado queda como evento) y
**Marcar ausente** (sale de la cola activa, queda en la lista de ausentes del box).

Un **job diario** marca `abandonado` todo lo que quedó en `esperando`. Corre a una hora configurable
(`HORA_CIERRE_DIARIO`, por defecto 23:00), no al cerrar el último box — porque "cerrado" sólo detiene la
emisión de tickets y los turnos en cola se siguen atendiendo después del horario (§5.2).

### 6.7 Derivación entre áreas

El operador puede derivar a un afiliado a otro trámite del catálogo sin que vuelva a hacer la fila del
tótem. **No se imprime nada**: la persona conserva el ticket que ya tiene.

**El número no cambia.** Un `P01` derivado a Bioquímica sigue siendo `P01` en la pantalla de
Bioquímica, con una marca visual de derivado. Es lo que hace válido el papel que la persona tiene en
la mano, que es el motivo entero de no imprimir. Como consecuencia, **la derivación no toca el
contador del trámite destino**: si lo incrementara, la serie `B` saltearía números.

**La posición en la cola sale sola.** El turno derivado conserva su `createdAt` original, así que la
FIFO de `seleccion.ts` lo ubica delante de todos los que llegaron después, sin lógica de prioridad ni
reglas nuevas. Y es justo: esa persona está en el edificio desde que sacó el primer turno.

**Modelo.** La derivación crea un **turno nuevo**, no muta el original:

| Turno | Qué pasa |
|---|---|
| Origen | Pasa a estado `derivado` (terminal, distinto de `finalizado`) y se le escribe el evento `derivado` con el trámite destino |
| Nuevo | Se crea en `esperando`, con el **mismo `numero`, `fecha` y `createdAt`**, el `tramiteId` destino, y `derivadoDeId` apuntando al origen |

Dos filas en vez de una mutación, porque así las estadísticas quedan limpias: el origen cuenta como
atención del box A —con su tiempo real, medido de `iniciado` a `derivado`— y el destino cuenta como
entrada a la cola del área nueva. Mutando el `tramiteId` se perdería el trabajo del primer box.

**El aviso es verbal.** La pantalla del operador muestra ala, piso y área destino en grande para que
los lea en voz alta. Sin papel y sin hardware adicional.

**Derivación en cadena** (A → B → C) está permitida; `derivadoDeId` la encadena. El panel del
supervisor marca las cadenas de tres o más, porque suelen indicar que nadie sabe de quién es el trámite.

**El dato que esto regala.** Cada derivación es un evento con origen y destino. La tasa de derivación
por par de trámites es el mejor diagnóstico disponible de la arquitectura de información del kiosco:
si un tercio de los turnos de "Otros Procesos Médicos" termina derivado a "Prótesis", el problema no
está en los operadores sino en cómo pregunta el paso ③. Va al dashboard de SP5.

**Alcance:** el modelo y la máquina de estados van en **SP0**; el handler y la interfaz del operador
van en **SP2**; la marca de derivado en las pantallas, en **SP3**; la métrica, en **SP5**.

### 6.8 Productividad

Se elimina el filtro de 7 minutos al escribir. Se guarda todo y se clasifica al consultar:

- **Umbral por trámite** (`Tramite.duracionMinimaEsperada`), no global.
- Tres categorías: **válidas** (sobre el umbral de su trámite), **breves** (bajo el umbral, se cuentan
  aparte), **anomalías** (menos de ~30 s).
- Las anomalías se le **muestran al supervisor**. El filtro anterior las borraba, que es exactamente el
  dato que delataría un vaciado de cola.
- Productividad = varias métricas: turnos atendidos, tiempo total en atención, y tiempo promedio comparado
  contra la **mediana de ese mismo trámite**.

Los tiempos se derivan de los timestamps del servidor en `TurnoEvento`, no de `Date.now()` en el cliente.

---

## 7. SP1 — El kiosco

### 7.1 Flujo

```
① DNI            →  ② CATEGORÍA      →  ③ TRÁMITE        →  ④ TU TURNO
teclado numérico    4 tarjetas          2 a 7 tarjetas      número + destino
en pantalla         en una fila         de la categoría     + impresión
```

① ② ③ son acciones del usuario. ④ es el resultado y se auto-cierra a los 15 s.

### 7.2 Pantallas (1920×1080 apaisado)

**① DNI — pantalla partida.** Izquierda: los dígitos en grande, agrupados (`20.123.456`), en fuente
tabular, y debajo el resultado de la búsqueda. Derecha: teclado numérico propio de 12 teclas de
**200×140px**.

Teclado en pantalla, **no el del sistema operativo**: Chrome en modo kiosco sobre Windows no levanta el
teclado táctil de forma confiable y taparía media pantalla.

La búsqueda del afiliado sale con debounce a los 7 dígitos. Si vuelve con nombre, aparece
"Bienvenido, Juan Pérez" a la izquierda mientras la mano sigue en el teclado. **Nunca bloquea `Continuar`.**

**② Categoría — una fila de 4 tarjetas** de 440×560px (4×440 + 3×32 de separación + márgenes = 1920).
Una fila horizontal se barre de un vistazo; una grilla 2×2 obliga a un recorrido en Z.

**③ Trámite** — mismas tarjetas. Una fila si son ≤4, dos filas si son 5–7, máximo 4 por fila.
**Nunca hay scroll.** Trámite cerrado = tarjeta **visible pero deshabilitada**, en gris, con
`Cerrado · Atiende 08:00 a 13:00` usando la ventana efectiva real.

**④ Resultado — partido.** Izquierda: el número a 220px en rojo OSP, debajo el nombre y el trámite.
Derecha: la banda de destino, el estado de impresión y la cuenta regresiva.

### 7.3 Identidad del ala

**No por color.** Las impresoras térmicas estándar imprimen en blanco y negro, así que un código cromático
no sobrevive al ticket. El ala se comunica con **banda rellena, tipografía grande y flecha direccional**:

```
┌──────────────────────────────┐
│  ███ ALA NORTE ███  ↑        │
│  Planta Baja                 │
│  Auditoría Médica            │
└──────────────────────────────┘
```

Idéntico en pantalla y en papel. Funciona también para daltónicos.

### 7.4 Paleta institucional

```css
--gris-20: #f5f5f5;          /* fondo */
--gris-principal: #413e43;   /* texto y acciones */
--gris-70: #c7c7c7;          /* bordes */
--gris-80: #6f7b7e;          /* iconos, deshabilitado */
--color-gainsboro-100: #d9d9d9;
--blanco: #fff;
--color-black: #000;
--osp: #d31d16;              /* identidad */
```

Contrastes verificados:

| Par | Ratio | Uso |
|---|---|---|
| `--gris-principal` sobre blanco | **10.5:1** | Todo el texto. AAA |
| Blanco sobre `--osp` | **5.3:1** | AA normal, AAA en tamaño grande |
| `--osp` sobre `--gris-20` | **4.9:1** | AA |
| `--gris-80` sobre blanco | **4.4:1** | ⚠️ No llega a 4.5. **Prohibido para texto** |
| `--gris-70` / gainsboro sobre blanco | 1.7:1 / 1.4:1 | Bordes y separadores únicamente |

**`--gris-80` no se usa para texto**, ni siquiera en ≥24px donde técnicamente calificaría como texto grande.
Va para iconos, bordes y estados deshabilitados. Los subtítulos usan `--gris-principal`, diferenciados por
tamaño y peso.

**Reparto del rojo.** Es el único color cromático de la paleta, así que no puede significar dos cosas:

- `--osp` = **identidad y número de turno**. Logo, franja del header, el número gigante de ④.
- **Acciones primarias** = `--gris-principal` relleno (10.5:1).
- **Errores** = rojo + icono + texto. Nunca color solo.

Tipografía: **Figtree** (títulos) + **Noto Sans** (cuerpo).

### 7.5 Escala tipográfica

Los mínimos web (16px, targets de 44px) son para un teléfono a 30 cm. Acá es una pantalla a un metro, con
alguien parado y posiblemente sin anteojos.

| Elemento | Tamaño | Nota |
|---|---|---|
| Número de turno | 220px / 700 | |
| Pregunta del paso | 56px / 600 | |
| Título de tarjeta | 36px / 600 | |
| Subtítulo | 24px / 400 | Mínimo absoluto de la interfaz |
| Alto mínimo de tarjeta | **180px** | Cuatro veces el mínimo web. En apaisado quedan ~340px |
| Separación entre targets | **24px** | |

### 7.6 Elementos permanentes

Logo institucional y reloj arriba. Indicador de paso (`● ● ○`). **Volver** grande abajo a la izquierda en
② y ③. **Empezar de nuevo** — la salida de emergencia, que hoy no existe.

### 7.7 Inactividad

A los 45 s sin tocar: cartel "¿Sigue ahí?" con 15 s de cuenta regresiva y botón `Sí, continuar`. Si nadie
responde, vuelve al inicio y **borra el DNI tipeado**. Esto último es privacidad, no UX.

### 7.8 El ticket (80mm térmico)

Logo · **Número gigante** · Nombre o DNI · Trámite · **Ala + Piso + Área** con el ala destacada ·
Fecha y hora del **servidor** · Código corto al pie (últimos caracteres del id, gancho para el QR futuro).

**Sin box**, porque el box se anuncia al llamar.
**Sin `window.open`**: se imprime con `--kiosk-printing` de Chrome, en un iframe oculto con `@media print`.
Sin ventana, sin diálogo, sin romper el fullscreen.

### 7.9 Arquitectura React

El shell (logo, catálogo, textos, estructura) va como **Server Component** — el catálogo no cambia entre
toques. Sólo son cliente las islas con estado o tiempo real: el teclado numérico, la grilla de trámites
(que escucha `CATALOGO_ACTUALIZADO` para deshabilitar en vivo) y la pantalla de resultado.

Nada de un context global que reemplace todo el estado y re-renderice el árbol completo, como hace hoy
`turno-context.tsx:82`.

Iconos: Lucide, trazo uniforme. **Sin emojis.**

---

## 8. SP1 — Hardening del kiosco

Cuatro capas. La app es la **última**, no la primera — hoy es la única, y por eso el problema existe.

### 8.1 Capa 1 — Windows: usuario dedicado con shell propio

Usuario local `kiosco` con inicio de sesión automático. Se reemplaza su shell
(`HKCU\...\Winlogon\Shell`) por un script en vez de `explorer.exe`.

Sin Explorer no hay escritorio, ni barra de tareas, ni menú Inicio: **no hay a dónde minimizar**.

El script es el watchdog:

```powershell
while ($true) {
  Start-Process chrome.exe -ArgumentList $flags -Wait
  Start-Sleep -Seconds 2
}
```

Complementos: `DisableTaskMgr` por política, autorun de USB deshabilitado.

### 8.2 Capa 2 — Políticas de Chrome (`HKLM\SOFTWARE\Policies\Google\Chrome`)

| Política | Valor |
|---|---|
| `URLBlocklist` | `["*"]` |
| `URLAllowlist` | `["http://servidor:3000"]` |
| `DeveloperToolsAvailability` | `2` |
| `IncognitoModeAvailability` | `1` |
| `BrowserSignin` | `0` |
| `PrintingEnabled` + `DefaultPrinterSelection` | impresora térmica |
| `RestoreOnStartup` | `4` + URL del kiosco |
| `PasswordManagerEnabled`, `TranslateEnabled`, `BookmarkBarEnabled` | `false` |

La lista blanca es la defensa real: aunque alguien llegue a una barra de direcciones, no hay a dónde ir.

### 8.3 Capa 3 — Flags de arranque

```
--kiosk --kiosk-printing --noerrdialogs --disable-pinch
--overscroll-history-navigation=0 --disable-session-crashed-bubble
--no-first-run --disable-infobars
--user-data-dir=C:\kiosco\perfil
http://servidor:3000/kiosco?id=kiosco-1
```

`--kiosk-printing` reemplaza al `window.open()`.
`--overscroll-history-navigation=0` mata el gesto de deslizar para volver, que en táctil se dispara solo.
`--disable-session-crashed-bubble` evita el cartel de "Chrome no se cerró correctamente" tras un corte de luz.

### 8.4 Capa 4 — La aplicación, **detrás de un flag**

```
NEXT_PUBLIC_KIOSCO_HARDENING=off   # desarrollo, por defecto
NEXT_PUBLIC_KIOSCO_HARDENING=on    # el tótem
```

Con `?hardening=1` se prende puntualmente sin tocar el `.env`.
**No va comentado:** el código comentado no compila, no se type-checkea y nadie lo prueba.

Contenido de la capa:

- Fullscreen API como refuerzo, re-solicitado al primer toque si se perdió.
- `contextmenu` bloqueado, `user-select: none`, `touch-action: manipulation`.
- `keydown` que descarta `F5`, `F11`, `F12`, `Ctrl+W/N/T/P/R`. Capa débil (depende del foco) pero gratis.
- Timeout de inactividad de §7.7.
- **Service Worker con página de respaldo**: si el servidor no responde, en vez del dinosaurio de Chrome se
  muestra una pantalla propia a pantalla completa. Reintento cada 5 s. **Sólo se registra con build de
  producción y el flag en `on`** — nunca en desarrollo.

### 8.5 Latido

El kiosco arranca con `?id=kiosco-1` y manda un latido cada 30 s con su id, versión y último error de
impresión. En el panel de admin los dos kioscos se ven en verde o rojo.

Hoy la única forma de enterarse de que un kiosco murió es que alguien vaya a mirarlo.

### 8.6 Limitación conocida

**El navegador no puede saber si la impresora se quedó sin papel.** `--kiosk-printing` imprime a ciegas.

Mitigación incorporada al diseño: el turno se registra en la base **antes** de imprimir, y el número queda
en pantalla 15 s con *"Si no salió el ticket, anote su número"*. La persona nunca pierde el turno.

Detección real requiere un agente local hablando ESC/POS a la impresora. Queda como mejora futura,
**fuera del alcance de SP1**.

---

## 9. Errores y degradación

> **Regla 1. El kiosco nunca muestra ni imprime un número que no esté guardado en la base.**
> **Regla 2. Cuando algo falla, se degrada a la vista. Nunca en silencio.**

Ambas se violan hoy (§4, hallazgos 2 y 7).

### 9.1 Matriz de fallos

| Qué falla | Kiosco | Operador | TV / Audio |
|---|---|---|---|
| SQL Server no responde | No genera. Pantalla completa *"Sistema momentáneamente no disponible — diríjase a Mesa de Entradas"*. **Ningún número en pantalla** | Banner rojo, acciones deshabilitadas | Mantiene el último llamado |
| Socket cortado, servidor vivo | Reconexión con backoff. A los 10 s, botones deshabilitados con motivo visible | Banner "Sin conexión" | Indicador discreto, sigue mostrando lo último |
| Servidor caído entero | Página de respaldo del Service Worker, reintento cada 5 s | Igual | Pantalla institucional estática |
| Búsqueda de afiliado falla o tarda | **Nada visible.** Timeout duro a 1,5 s, sigue con el DNI | — | — |
| Impresora sin papel | Número 15 s + *"anote su número"*. El turno ya está guardado | Puede reimprimir | — |
| Corte de luz durante la generación | Transacción atómica: o quedan turno + contador + evento, o no queda nada | | |

### 9.2 Doble toque

El cliente genera un `requestId` al entrar al paso ③ y lo manda con el comando. El servidor lo usa como
clave única: si llega repetido, devuelve **el mismo turno**. Más el botón deshabilitado al primer toque.

### 9.3 Dos operadores llaman el mismo turno

Ocurre cuando dos boxes comparten trámite. La transición va condicionada:

```sql
UPDATE Turno SET estado='llamado', boxId=@box WHERE id=@id AND estado='esperando'
```

Cero filas afectadas → *"Ese turno ya fue llamado por el Box 3"* y se ofrece el siguiente.

### 9.4 Operador que se va con un turno abierto

`SesionOperador` tiene latido. Al reconectar, el operador **recupera su turno en curso**. Si no vuelve,
un job lo marca para revisión del supervisor en vez de dejarlo colgado en `atendiendo`.

### 9.5 Errores tipados

Cada handler deja de tragarse la excepción: responde un `ERROR` con `codigo`, `mensaje` (para el usuario)
y `detalle` (para el log) al cliente que originó el comando, lo escribe en `TurnoEvento` cuando corresponde,
y lo cuenta para el panel. Si el mismo `codigo` se repite **5 veces en un minuto** desde el mismo kiosco, ese
kiosco se marca en rojo en el panel de admin.

---

## 10. Testing

Hoy no hay un solo test ni framework instalado. Parte de SP0 es montarlo.

**Stack:** Vitest (unitarios e integración) + Playwright (E2E).

### 10.1 Unitarios — sin base ni sockets

Los tres módulos de `lib/queue/` son puros para esto:

- **`estado.ts`** — tabla completa de transiciones válidas e inválidas.
- **`disponibilidad.ts`** — la regla combinada. Caso clave: box 08–12, trámite 08–13, a las 12:30 no se
  emite y la ventana mostrada es `08:00–12:00`. Más los bordes: minuto de apertura, de cierre, día no habilitado.
- **`seleccion.ts`** — FIFO estricta con colas mezcladas.

### 10.2 Integración — exigen SQL Server real

Van contra una base `Turnero_Test` **en la misma instancia de SQL Server 2022** que usa producción.
**No sirven contra SQLite**, porque lo que se prueba es el comportamiento del motor: el
`MERGE ... WITH (HOLDLOCK) ... OUTPUT` que resuelve el número duplicado es sintaxis exclusiva de SQL
Server, y contra otro motor el test pasaría sin probar nada.

Base separada, no la de producción: los tests borran datos en cada corrida. Una guarda en el arranque
de la suite aborta todo si la cadena de conexión no apunta a una base terminada en `_Test`.

1. **Concurrencia del contador.** 50 `GENERAR_TURNO` simultáneos → **50 números distintos**. Es el test
   central: sin él, el bug del §4.3 vuelve.
2. **Idempotencia.** Mismo `requestId` dos veces → un solo turno.
3. **Llamado concurrente.** Dos operadores, uno gana, el otro recibe el error tipado.

### 10.3 Aislamiento por ala

Requisito verificable del pliego. Dos clientes socket, uno en `ala:sur` y otro en `ala:norte`; se dispara
un llamado en el Norte y **se afirma que el cliente Sur no recibió nada**. La aserción importante es la negativa.

### 10.4 E2E del kiosco

Playwright a **1920×1080**, hardening apagado. Camino feliz completo, más: DNI inexistente (sigue igual),
trámite cerrado (visible, deshabilitado, horario correcto), `Volver` en cada paso, `Empezar de nuevo`, y el
timeout de inactividad **borrando el DNI**.

`axe` sobre las cuatro pantallas, más una aserción explícita de contraste sobre los tokens — para que meter
`--gris-80` en un texto haga fallar el test, y no que lo descubra un afiliado con visión reducida.

### 10.5 Verificación manual (no automatizable)

**Impresión, con la térmica física:** ticket sin diálogo ni ventana; entra en 80mm sin cortar el ala; la
hora impresa coincide con la del servidor; legible a un metro; si se acaba el papel, el turno igual quedó
registrado.

**Hardening, en el tótem con el flag en `on`:** `Alt+F4` y `Ctrl+W` no cierran nada; matando Chrome vuelve
en ~2 s; no hay barra de tareas ni escritorio detrás; tras un corte de luz arranca directo en el kiosco sin
cartel de sesión interrumpida; otra URL no sale; el latido aparece en verde en el panel.

### 10.6 Criterio de cierre

Ninguna etapa se declara terminada sin la salida del comando pegada.
`superpowers:verification-before-completion` al cierre de cada etapa del plan.

---

## 11. Fuera de alcance

**De este documento:** SP2 (operador y motor de cola completo), SP3 (TV y audio por ala), SP4 (panel de
administración), SP5 (dashboard). El modelo de datos de §5 los contempla, pero su UI y su lógica se
especifican aparte.

**Del proyecto por ahora:** QR en el ticket, notificaciones por SMS o WhatsApp, turnos online, seguimiento
desde el celular, guía por voz, multi-idioma, múltiples edificios. La arquitectura los admite —`Sede`,
el código corto del ticket, `Turno.dni`— pero no se implementan.

**Detección de papel por ESC/POS:** requiere un agente local. Anotado en §8.6.

## 12. Pendientes externos

Bloquean partes de la implementación, no el plan:

1. **`DATABASE_URL`** — cadena de conexión al SQL Server 2022. Hoy `.env.local` sólo tiene las claves de Supabase.
2. **Nombre y columnas del objeto de afiliados** en la base institucional. Mientras tanto, la consulta es
   configurable por entorno (§5.4) y `AfiliadoRepository` tiene una implementación stub.
3. **Permisos SQL**: `SELECT` en la base institucional para el login de la aplicación.
4. **Modelo de la impresora térmica** y confirmación de que es de 80mm.
5. **Estructura real y definitiva de trámites por box**, para el seed inicial.
6. **Host y puerto definitivos del servidor.** `http://servidor:3000` es un ejemplo en §8.2 y §8.3; la
   `URLAllowlist` de Chrome tiene que llevar la URL real o el kiosco no carga nada.
7. **Cómo validar credenciales de empleado** contra la base de la obra social (stored procedure, API,
   o lectura del hash y con qué algoritmo), qué es el "usuario", y qué tabla y columnas tienen los
   empleados. Bloquea el diseño de SP2, no de SP0 ni SP1. Ver la sección "SP2" de `CLAUDE.md`.
