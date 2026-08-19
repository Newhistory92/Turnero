# Diseño: SP5 — Dashboard de estadísticas

**Fecha:** 2026-08-19
**Estado:** aprobado, pendiente de plan de implementación
**Depende de:** SP0 (modelo de datos), SP2 (motor de cola y eventos)
**Alcance de este documento:** SP5 únicamente.

---

## 1. Contexto

SP0–SP4a dejaron el sistema funcionando: el kiosco emite, el operador atiende, las pantallas
llaman y el admin configura el catálogo. Cada acción escribe una fila en `TurnoEvento` con el
timestamp del servidor. Ese diario existe desde el primer día y hasta ahora nadie lo lee.

SP5 lo lee. No agrega captura de datos: toda la información que el tablero necesita ya está en
la base. Lo que falta es la capa que la interpreta y las dos pantallas que la muestran.

El diagnóstico del sistema anterior (§4 del spec base) incluía *"estadísticas sesgadas por
diseño"* — el filtro de 7 minutos que borraba las atenciones cortas. SP0 lo eliminó al escribir.
SP5 es donde esa decisión rinde: se clasifica al consultar, con umbral por trámite, y las
anomalías se muestran en vez de desaparecer.

## 2. Decisiones cerradas

| Tema | Decisión |
|---|---|
| Pantallas | **Dos**: "Hoy" (operativa) e "Histórico" (revisión). Preguntas distintas, vistas distintas |
| Rol nuevo | **`director`**. `Empleado.rol` ya es `String`, no enum: **sin migración de datos** |
| Productividad por operador | Visible sólo para **`director` y `admin`**. El supervisor no la ve ni se le consulta |
| Alcance del supervisor | **Por trámite**, configurado desde el panel admin (`AlcanceMetrica`) |
| Alcance vacío | **No ve nada**, con aviso explícito. Denegar por defecto |
| Refresco de "Hoy" | **`router.refresh()` cada 45 s** desde un componente cliente. No toca Socket.io |
| Gráficos | **Recharts**, sólo en las pantallas que lo necesitan (Client Components aislados) |
| Exportación | **CSV**, con el mismo guard y el mismo alcance que la pantalla |
| Origen de los tiempos | **`TurnoEvento.timestamp`** (reloj del servidor). Nunca el cliente |
| Cálculo | **Al consultar**, sin tablas de agregación previa. Se revisa si el volumen lo exige |

## 3. Control de acceso

### 3.1 Roles

`lib/admin/acceso.ts` suma `director` al vocabulario y dos predicados:

```ts
export type Rol = "operador" | "supervisor" | "director" | "admin"

puedeVerTablero(rol)       → supervisor | director | admin
puedeVerProductividad(rol) → director | admin
```

`puedeVerCatalogo` y `puedeEditarCatalogo` no cambian: `director` **no** administra el catálogo.
Es un rol de lectura con más alcance, no un admin con otro nombre.

### 3.2 Alcance por trámite

Un supervisor ve las métricas de los trámites que tenga asignados. `director` y `admin` ven
todos. El alcance se resuelve una vez por request y se representa con un tipo explícito:

```ts
export type Alcance =
  | { tipo: "todos" }
  | { tipo: "limitado"; tramiteIds: string[] }

export async function alcanceDe(actor: Actor): Promise<Alcance>
```

Un `limitado` con array vacío es un supervisor sin configurar: **no ve nada**. El tipo obliga a
distinguirlo de `todos`; con un `string[] | null` la ausencia de configuración se confundiría con
acceso total, que es precisamente el error que no queremos cometer en silencio.

### 3.3 Dónde se aplica el filtro

**En `lib/estadisticas/consultas.ts`, y en ningún otro lado.** Toda función exportada de ese
módulo recibe `alcance: Alcance` como primer parámetro. No es una convención: es la firma, así
que omitirlo no compila.

El filtro se aplica igual en `app/tablero/exportar/route.ts`. El agujero clásico de este tipo de
tablero es que la pantalla filtra bien y el endpoint de exportación devuelve la base entera; la
ruta de CSV usa las mismas funciones de `consultas.ts` con el mismo alcance, sin consultas
propias.

### 3.4 Qué recorta el alcance

| Bloque | Con alcance limitado |
|---|---|
| Cola y volumen | Sólo los trámites asignados |
| Boxes (vista Hoy) | Sólo los que atienden al menos un trámite asignado |
| Ausentes y abandonos | Sólo los trámites asignados |
| Derivaciones | Las que **salen** de un trámite asignado, con el destino nombrado |
| Productividad | No se muestra a supervisores, con alcance o sin él |

La regla de derivaciones merece justificación: mostrar sólo los pares con ambos extremos en
alcance escondería justo la señal que sirve —a dónde se le escapan los turnos al área— y lo
único que revela es el nombre de un trámite del catálogo, que no es dato sensible.

## 4. Modelo de datos

### 4.1 Tabla nueva

```prisma
model AlcanceMetrica {
  empleadoId String
  tramiteId  String
  empleado   Empleado @relation(fields: [empleadoId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  tramite    Tramite  @relation(fields: [tramiteId], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@id([empleadoId, tramiteId])
}
```

Se llama `AlcanceMetrica` y no `EmpleadoTramite` porque esto último se confundiría con "trámites
que el empleado atiende", que es otra relación y no existe (los trámites se asignan al box, no a
la persona).

`onDelete: Cascade` en el empleado: si se borra, su alcance se va con él. En el trámite es
`NoAction`, consistente con el resto del esquema.

### 4.2 Índices

`TurnoEvento` es la tabla que más crece y la que más se consulta. Hoy tiene índices por `turnoId`
y `timestamp`. Se agregan dos:

```prisma
@@index([empleadoId, timestamp])
@@index([boxId, timestamp])
```

Sin el primero, la productividad hace scan completo. Sin el segundo, el estado de boxes de la
vista Hoy también. Es la única migración de esquema de SP5.

## 5. Arquitectura

Tres capas, siguiendo el patrón ya establecido por `lib/queue/`:

```
lib/estadisticas/*.ts          cálculo puro, sin Prisma — testeable sin base
lib/estadisticas/consultas.ts  única capa que toca Prisma; recibe y aplica el Alcance
app/tablero/**                 Server Components que componen y renderizan
```

### 5.1 Archivos

```
lib/estadisticas/
  tipos.ts          Alcance, RangoFechas, y los tipos de retorno de cada métrica
  rango.ts          parseo y validación de rangos desde searchParams
  duraciones.ts     espera, atención y clasificación de un turno desde sus eventos
  volumen.ts        agregados por trámite / día / hora
  productividad.ts  por empleado, con mediana por trámite
  derivaciones.ts   pares origen→destino y cadenas
  consultas.ts      Prisma + aplicación del alcance

app/tablero/
  layout.tsx           guard: puedeVerTablero, si no → /operador/login
  page.tsx             Hoy
  AutoRefresco.tsx     cliente: router.refresh() cada 45 s
  historico/page.tsx   Histórico
  exportar/route.ts    CSV
  _componentes/
    Tarjeta.tsx        KPI con valor grande y etiqueta
    BarraRanking.tsx   barra horizontal con ancho porcentual
    GraficoLinea.tsx   cliente, Recharts — serie temporal
    GraficoHoras.tsx   cliente, Recharts — distribución por hora
    SelectorRango.tsx  presets + dos campos de fecha
    TablaDatos.tsx     tabla con encabezados y estado vacío
    SinAlcance.tsx     aviso para el supervisor sin configurar

app/admin/alcance/
  page.tsx             asignación de trámites por supervisor
  FormularioAlcance.tsx
```

Los seis módulos de cálculo son funciones puras que reciben arrays y devuelven objetos. No
importan Prisma ni `next/*`. Ahí vive la mayor parte de la lógica y ahí va la mayor parte de los
tests.

### 5.2 Refresco de la vista Hoy

`AutoRefresco` es un componente cliente sin marcado propio: un `useEffect` con `setInterval` que
llama `router.refresh()` cada 45 s y limpia el intervalo al desmontar. El Server Component vuelve
a consultar y React reconcilia. Es el mismo mecanismo que el kiosco ya usa para el catálogo
vencido, y evita sumar emisión de eventos al servidor de sockets para un caso que tolera 45
segundos de retraso.

## 6. Definiciones de métricas

Todo tiempo se deriva de `TurnoEvento.timestamp`.

### 6.1 Espera y atención

- **Espera** = evento `generado` del turno → primer evento `llamado` de ese turno.
- **Atención** = evento `iniciado` → evento terminal (`finalizado` o `derivado`).

La espera usa el `generado` **del propio turno**, no su `createdAt`. Importa para los derivados:
`derivarTurno` copia el `createdAt` del original al turno nuevo —para que la posición FIFO
respete la llegada real de la persona— pero le escribe un `generado` fechado al momento de
derivar. Medir desde `createdAt` le cargaría al segundo box la espera del primero.

La atención puede ser `null`: la máquina de estados permite `derivado` desde `llamado`, sin pasar
por `iniciado`. Ese turno cuenta como derivación pero no aporta tiempo de atención.

Un turno en `esperando` que nunca fue llamado tiene espera abierta: se mide contra el momento de
la consulta y se marca como en curso.

### 6.2 Clasificación de atenciones

Según §6.8 del spec base, con umbral por trámite (`Tramite.duracionMinimaEsperada`, en minutos):

| Categoría | Criterio |
|---|---|
| **Anomalía** | menos de 30 segundos |
| **Breve** | 30 s o más, pero bajo el umbral del trámite |
| **Válida** | umbral del trámite o más |

Las anomalías **se muestran**. El filtro que SP0 eliminó las borraba, que es exactamente el dato
que delataría un vaciado de cola.

La mediana de comparación se calcula **sólo sobre las válidas del mismo trámite**. Una mediana
global castigaría a quien atiende los trámites largos por el solo hecho de atenderlos.

### 6.3 Personas contra atenciones

Una persona derivada deja **dos filas** en `Turno`: el origen en estado `derivado` y el destino
nuevo con `derivadoDeId` apuntando al primero. Contar filas crudas infla el volumen.

Se separan dos magnitudes, con etiquetas distintas en pantalla:

- **Personas** = turnos con `derivadoDeId IS NULL` — cuánta gente entró al edificio
- **Atenciones** = todas las filas — cuánto trabajo hicieron los boxes

Sin la distinción, un día con muchas derivaciones se lee como un día de mucha demanda.

### 6.4 Derivaciones

El par origen→destino sale de la relación, no del `detalle`: el turno destino conoce su
`tramiteId` y su `derivadoDeId`, así que el par se arma con un join y no parseando el string
`destino:<id>` que `derivarTurno` deja en el evento. El `detalle` queda como respaldo de
auditoría, no como fuente de la métrica.

Las **cadenas** se reconstruyen siguiendo `derivadoDeId` hacia atrás. Las de tres o más se
listan aparte: suelen indicar que nadie sabe de quién es el trámite, que es el diagnóstico que
§6.7 del spec base le encarga a esta pantalla.

### 6.5 Ausentes y abandonos

- **Ausente**: fue llamado y no respondió (evento `ausente`). Puede volver a la cola y ser
  llamado otra vez, así que se cuentan **eventos**, no turnos: un turno puede aportar dos.
- **Abandonado**: estado terminal `abandonado`, que escribe el job de cierre. Nunca fue llamado
  o nunca volvió.

Se muestran por trámite y por hora. Una tasa de ausentes que sube a determinada hora suele
significar que la espera pasó el punto en que la gente se va a hacer otra cosa.

## 7. Vista Hoy

Tres bloques, en este orden:

**Cola por trámite.** Cuántos `esperando` y hace cuánto espera el más antiguo. Ordenada por
espera descendente: lo que más urge, arriba.

**Estado de boxes.** Sesiones abiertas (`SesionOperador` con `fin IS NULL`) cruzadas con el turno
activo de cada box. Tres estados: **atendiendo** (turno en `llamado` o `atendiendo`), **ocioso**
(sesión abierta, sin turno) y **cerrado** (sin sesión). Con el nombre del operador. Es el bloque
que permite decir "abrí otro box en Prótesis".

**Totales del día.** Personas, atenciones, ausentes, abandonados y espera promedio. El promedio
se calcula **sólo sobre los turnos ya llamados hoy**: incluir las esperas abiertas de quienes
siguen en la cola mezclaría un tiempo final con uno que todavía está corriendo.

## 8. Vista Histórico

Encabezada por el `SelectorRango`: presets de hoy / semana / mes más dos campos de fecha para
cualquier período. El rango viaja en la URL como `?desde=&hasta=`, así que la vista es
compartible y el botón de exportar hereda el mismo rango sin estado adicional.

Secciones: **volumen** (por trámite, serie diaria en línea, distribución por hora para la hora
pico), **espera** (promedio y mediana por trámite), **derivaciones** (ranking de pares y cadenas
de 3+), **ausentes y abandonos**, y **productividad** sólo si el rol la habilita.

La distribución por hora agrupa por la hora del evento `generado` de las **personas**
(`derivadoDeId IS NULL`), no de todas las filas: la hora pico es cuándo llega la gente al
edificio, y un derivado no es una llegada nueva.

## 9. Exportación CSV

`GET /tablero/exportar?desde=&hasta=` devuelve una fila por turno del rango, dentro del alcance
del actor: número, fecha, trámite, box, operador, espera, atención, clasificación, estado final y
si fue derivado.

La productividad no se exporta a quien no puede verla: las columnas de operador y atención se
omiten si `puedeVerProductividad` es falso. Un CSV sin restricción sería la puerta de atrás del
control de acceso de §3.

Se sirve con `Content-Type: text/csv` y `Content-Disposition: attachment` con el rango en el
nombre del archivo. Separador coma, comillas dobles escapadas duplicando, y BOM UTF-8 al inicio
para que Excel en Windows no rompa los acentos.

## 10. Panel admin: asignación de alcance

Nueva entrada `/admin/alcance` en la navegación del panel, visible sólo con
`puedeEditarCatalogo` (es decir, `admin`).

Lista los empleados con rol `supervisor` y, por cada uno, las casillas de los trámites que tiene
asignados. Reutiliza `CampoCasillas` y el patrón de Server Action con `useActionState` que ya
usan los formularios de catálogo — misma validación, mismos avisos, misma marca de sólo lectura.

Los supervisores sin ningún trámite asignado se marcan en la lista. Es el estado que hace que su
tablero aparezca vacío, y quien lo puede resolver es exactamente quien está mirando esta pantalla.

## 11. Errores y bordes

| Situación | Comportamiento |
|---|---|
| Rango inválido, invertido o no parseable | Se corrige al preset "mes" y se avisa. No explota ni devuelve vacío en silencio |
| Rango sin datos | Cada bloque muestra su estado vacío propio. Nunca un cero, que se leería como "hubo cero" |
| Supervisor sin alcance | Pantalla `SinAlcance` con instrucción de pedírselo a un administrador |
| Promedio o mediana sin muestras | `null` en el cálculo, guión en pantalla. Nunca `NaN` ni `0` |
| Turno esperando desde ayer | Cuenta en la cola con su espera real, sin recortar al día |
| Atención sin `iniciado` | Cuenta como derivación, no aporta tiempo de atención |
| Empleado borrado con eventos | Los eventos conservan `empleadoId`; la fila se muestra como "(empleado dado de baja)" |

## 12. Testing

**Unitarios** (el grueso): cada módulo de `lib/estadisticas` con arrays construidos a mano.
Cubren en particular la espera de un turno derivado, la atención `null`, las tres categorías de
clasificación en sus bordes exactos (29 s, 30 s, umbral−1, umbral), la mediana por trámite, la
distinción personas/atenciones y las cadenas de derivación de largo 1, 2 y 3.

**Integración**: `consultas.ts` contra base, verificando que un `Alcance` limitado no devuelva
filas fuera de alcance — el caso que importa es el negativo.

**E2E**: el guard de `/tablero` por rol; que la sección de productividad no llegue al HTML de un
supervisor (no que esté oculta: que no esté); y que `/tablero/exportar` respete el alcance,
incluido el pedido directo a la URL sin pasar por la pantalla.

## 13. Fuera de alcance

- Tablas de agregación previa o materialización. Se calcula al consultar; se revisa cuando el
  volumen real lo pida y no antes.
- Alertas automáticas por umbral en la vista Hoy.
- Comparación de dos períodos lado a lado.
- Envío programado de informes.
- Métricas de kioscos (latidos, errores de impresión). El modelo las contempla; su lectura no
  pertenece a este tablero.
