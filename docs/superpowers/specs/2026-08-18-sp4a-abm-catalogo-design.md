# SP4a — ABM de catálogo y control de acceso por rol

**Fecha:** 2026-08-18
**Estado:** aprobado, listo para plan de implementación
**Depende de:** SP0 (modelo de datos, rooms, caché de catálogo) y SP2 (login institucional, sesiones), ambos completos

---

## 1. Alcance

Un panel de administración que permite editar el catálogo desde la interfaz, en vez de escribir SQL a
mano contra la base de producción. Incluye el control de acceso por rol que hoy no existe.

Las siete entidades del catálogo: `Sede`, `Ala`, `Piso`, `Box`, `Categoria`, `Tramite` y la relación
`BoxTramite`.

**Fuera de alcance:** ABM de empleados y asignación de boxes (SP4b), panel del supervisor con
monitoreo en vivo y cadenas de derivación (SP4c), administración de dispositivos —kioscos y
pantallas— (SP4d) y dashboard de estadísticas (SP5).

### 1.1 Por qué SP4 se parte

SP4 nunca tuvo spec y fue acumulando todo lo que los specs anteriores fueron pateando: ABM de
catálogo, ABM de empleados, panel del supervisor y administración de dispositivos. Son cuatro
subsistemas independientes; cada uno recibe su propio ciclo de spec, plan e implementación.

El catálogo va primero porque es el que más dolor quita —hoy cambiar un trámite es editar SQL— y
porque la infraestructura que necesita ya existe sin usarse: `invalidarCatalogo()` no lo llama nadie
y `CATALOGO_ACTUALIZADO` está declarado en `server/rooms.ts`, ruteado a todos los clientes, sin que
nadie lo emita ni lo escuche.

---

## 2. Decisiones cerradas

| Decisión | Elección | Por qué |
|---|---|---|
| Entidades editables | Las siete del catálogo | El edificio cambia poco, pero cuando cambia no debería requerir SQL |
| Bajas | Lógica siempre; borrado real solo sin referencias | Permite corregir un alta recién cargada sin poder romper el histórico |
| Sesión del admin | `SesionOperador.boxId` nullable | Reutiliza cookie HMAC, latido y vencimiento sin duplicar nada |
| Roles | `operador`, `supervisor`, `admin` | `Empleado.rol` ya existe en el esquema y hoy no lo lee nadie |
| `supervisor` en SP4a | Solo lectura del catálogo | El rol significa algo desde el día uno, en vez de ser una etiqueta inerte hasta SP4c |
| Escritura | Server Actions | Son formularios, no eventos de turno: validación por campo y sin depender de JS |
| Propagación al kiosco | Inmediata si está ocioso, diferida si está en uso | Nadie pierde lo que estaba haciendo y el cambio entra en segundos |
| Concurrencia | Gana el último que guarda | Con uno o dos admins, el bloqueo optimista es costo sin beneficio |

---

## 3. Migración

Es el **primer sub-proyecto que toca `prisma/schema.prisma` desde SP0**. Tres cambios, una sola
migración.

| Cambio | Por qué |
|---|---|
| `SesionOperador.boxId` → `String?` | Una sesión sin box es una sesión de admin |
| `Ala.activa Boolean @default(true)` | Hoy no existe; sin ella no se puede dar de baja un ala |
| `Piso.activa Boolean @default(true)` | Ídem |

`Sede`, `Box`, `Categoria` y `Tramite` ya tienen su flag (`activa`/`activo`). `Ala` y `Piso` son las
dos únicas que no lo tienen, y sin él "ABM completo" no puede incluirlas sin recurrir al borrado
duro.

El default `true` hace la migración segura sobre datos existentes: todo lo que hay hoy queda activo.
Hacer `boxId` nullable no invalida ninguna fila: las sesiones existentes ya tienen box.

---

## 4. Control de acceso

### 4.1 Los roles

`Empleado.rol` es `VarChar(15)` y **ningún código lo lee todavía**. El script de importación crea a
todos como `"operador"`. SP4a es su primer consumidor, así que define el vocabulario:

| Rol | Puede |
|---|---|
| `operador` | Nada del panel. El guard lo rebota |
| `supervisor` | Ver todo el catálogo, en solo lectura |
| `admin` | Ver y editar todo el catálogo |

El chequeo va **siempre en el servidor**. Deshabilitar un botón no es control de acceso: los
formularios del supervisor se renderizan deshabilitados por claridad, pero lo que garantiza la regla
es que la mutación lo rechace.

**Bootstrap del primer admin:** se promueve con un `UPDATE` a mano sobre `Empleado.rol`, documentado
en `CLAUDE.md`. Desde SP4b se podrá hacer desde la interfaz.

### 4.2 El login no cambia de forma

Hoy es de dos pasos: `/api/auth/boxes` valida las credenciales **en vivo contra la base de la obra
social** y devuelve los boxes asignados; después `/api/auth/login` abre la sesión.

`/api/auth/boxes` pasa a devolver también el `rol`. Si es `admin` o `supervisor`, la misma pantalla
ofrece **"Panel de administración"** junto a los boxes. Quien además atiende elige adónde va; quien
no tiene boxes asignados ve solo esa opción.

Una sola pantalla de login y un solo flujo. **La validación en vivo contra la obra social se mantiene
intacta: no se copian contraseñas ni hashes a la base del Turnero.**

`abrirSesion` acepta `boxId` nulo. Cuando no hay box, la exclusividad —`BOX_OCUPADO`— y la
verificación de `EmpleadoBox` no aplican, porque no hay recurso físico que ocupar.

### 4.3 El guard

`app/admin/layout.tsx`, Server Component: lee la cookie, resuelve la sesión, carga el `Empleado` y
verifica el rol. Cualquier cosa que no sea `admin` o `supervisor` va a `/operador/login`.

Al ser un layout cubre toda la rama `/admin/*` sin que haya que acordarse de repetirlo en cada
página nueva.

---

## 5. La escritura

### 5.1 Server Actions, no socket

El resto de la aplicación usa socket porque son eventos de turno que hay que difundir en el momento.
Esto son formularios: validación del lado del servidor, errores por campo y funcionamiento sin
JavaScript. Los Server Actions son la herramienta correcta.

Hay un obstáculo real: **`io` se pasa como argumento a `montarTurnero(io)`**, no vive en ningún lado
accesible desde una ruta HTTP. Se agrega `server/io.ts`, un singleton mínimo que el servidor registra
al arrancar y que cualquier código del servidor puede consumir. Es lo que desbloquea
`CATALOGO_ACTUALIZADO`.

### 5.2 El orden de cada mutación

1. Validar
2. Escribir
3. `invalidarCatalogo()`
4. Emitir `CATALOGO_ACTUALIZADO`
5. `revalidatePath`

Invalidar **antes** de emitir. Si se emitiera primero, un cliente rápido podría pedir el catálogo y
recibir el caché viejo, quedándose con datos vencidos hasta el próximo cambio.

---

## 6. Validaciones

### 6.1 El prefijo tiene que ser único

`Contador` es por `(tramiteId, fecha)` y el número del turno es prefijo + contador. **Dos trámites
con prefijo `P` generan dos `P01` distintos el mismo día** — dos personas con el mismo número
esperando el mismo llamado, y un operador que no puede saber a cuál está llamando.

El esquema no lo impide: `prefijo` es `VarChar(3)` sin `@unique`. El ABM tiene que garantizarlo entre
trámites activos.

**Se valida solo contra los activos, y también al reactivar.** Un trámite dado de baja conserva su
prefijo, porque sus turnos históricos lo llevan impreso; que ese prefijo quede libre para otro
trámite es correcto. Pero eso abre el caso inverso: reactivar un trámite cuyo prefijo se le asignó a
otro mientras estaba de baja. La reactivación es una escritura como cualquier otra y pasa por la
misma validación — si el prefijo está tomado, se rechaza y hay que cambiarlo antes de reactivar.

### 6.2 El resto

| Campo | Regla |
|---|---|
| `horaApertura`, `horaCierre` | Formato `HH:MM`; apertura estrictamente anterior al cierre |
| `diasSemana` | Subconjunto no vacío de `0`–`6`, sin repetidos |
| `icono` | Dentro de `NOMBRES_DE_ICONO`, de `lib/kiosco/iconos.ts` |
| `Box.numero` | Único por ala — la base ya lo garantiza con `@@unique([alaId, numero])` |

`diasSemana` se consume en `lib/queue/disponibilidad.ts` con `diasSemana.includes(dia)`, así que es un
conjunto de dígitos, no una máscara de bits.

### 6.3 El aviso del destino

El spec del kiosco dejó prometido que el panel avise cuando el destino de un trámite no coincide con
los boxes que lo atienden. Es una **advertencia, no un error**: la redundancia entre
`Tramite.destinoAla` y el ala de sus boxes es deliberada, porque el ticket tiene que decir adónde ir
aunque el trámite se quede momentáneamente sin boxes abiertos.

---

## 7. Las bajas

Desactivar es la operación normal y siempre está disponible. Lo desactivado desaparece del kiosco y
del panel del operador, pero los turnos históricos siguen resolviendo el nombre de su trámite y su
box.

El botón de **borrado definitivo aparece solo si la entidad no tiene ninguna referencia**:

| Entidad | Se puede borrar si no tiene |
|---|---|
| `Tramite` | Turnos ni contadores |
| `Box` | Turnos, eventos, sesiones ni asignaciones de empleado |
| `Categoria` | Trámites |
| `Ala` | Boxes ni trámites que la tengan como destino |
| `Piso` | Boxes ni trámites que lo tengan como destino |
| `Sede` | Alas ni pisos |

La verificación se hace **en el servidor en el momento de borrar**, no solo al decidir si se pinta el
botón. Entre que la página se renderizó y que alguien apretó pueden haber entrado turnos.

---

## 8. Propagación del cambio

`CATALOGO_ACTUALIZADO` va a todos los clientes; cada uno decide qué hacer.

**Kiosco.** Si está en la pantalla inicial con el DNI vacío, recarga el catálogo al instante. Si hay
alguien en medio del wizard, marca el catálogo como vencido y lo aplica en `reiniciar()`, que ya se
dispara tanto al terminar como al saltar el temporizador de inactividad. El estado vive en el
`Wizard`, que ya tiene `paso.nombre` y `reiniciar()`; no hace falta maquinaria nueva.

Recargar de golpe le borraría a la persona lo que estaba haciendo y la devolvería al inicio sin
explicación.

**Panel del operador.** Recarga la lista de trámites del diálogo de derivación. No hay nada a medio
hacer que se pueda perder.

**Pantalla de TV.** Lo ignora. Su snapshot no toca el catálogo: el nombre del box sale de la consulta
de turnos.

### 8.1 Dos límites que conviene tener escritos

**El caché es un singleton en memoria del proceso.** `invalidarCatalogo()` solo funciona con un único
servidor Node. Hoy es así. El día que se escale horizontalmente, la invalidación deja de propagarse a
los otros procesos y hay que mover el caché afuera.

**Gana el último que guarda.** Dos admins editando la misma entidad a la vez pisan el trabajo del
otro sin aviso. Para uno o dos administradores, el bloqueo optimista sería costo sin beneficio.

---

## 9. Errores y degradación

| Qué falla | Qué pasa |
|---|---|
| La validación rechaza | No se escribe, no se invalida, no se emite. El formulario muestra el error por campo |
| Falla el guardado | Ídem: el catálogo queda como estaba |
| Se pierde el evento | El catálogo ya está guardado y el caché invalidado. El próximo `GET /api/catalogo` trae los datos nuevos |
| Un `supervisor` intenta escribir | La mutación lo rechaza en el servidor |

**El evento acelera la propagación; no es de lo que depende la correctitud.** Como el caché del
servidor se invalida antes de emitir, cualquier cliente que vuelva a pedir el catálogo obtiene los
datos nuevos aunque el socket se haya caído. Un kiosco desconectado se pone al día solo en cuanto
reconecta y vuelve a consultar.

---

## 10. Pruebas

**Unitarias** — las validaciones son funciones puras y se prueban sin base ni navegador:

- Unicidad del prefijo entre trámites activos, incluido el caso de reactivar uno cuyo prefijo se
  reasignó mientras estaba de baja
- Formato de horarios y apertura anterior al cierre
- `diasSemana` como subconjunto válido de `0`–`6`
- Icono dentro de `NOMBRES_DE_ICONO`
- La regla de si una entidad se puede borrar, dado su conteo de referencias

**Integración** contra `Turnero_Test`:

- La baja lógica saca el trámite del catálogo pero no del histórico
- El borrado real se rechaza cuando hay referencias, y procede cuando no las hay
- Guardar invalida el caché: dos llamadas a `obtenerCatalogo()` con una escritura en el medio
  devuelven datos distintos
- `abrirSesion` con `boxId` nulo crea sesión sin verificar `EmpleadoBox` ni exclusividad

**La prueba que más importa:**

> **Una escritura hecha por un `supervisor` tiene que ser rechazada por el servidor.** Un test que
> solo verifique que el botón se ve deshabilitado no prueba nada: pasaría igual con la autorización
> completamente rota.

**E2E** — el admin cambia el nombre de un trámite y el kiosco lo refleja.

---

## 11. Archivos

```
app/admin/layout.tsx                guard de rol, navegación
app/admin/page.tsx                  índice del panel
app/admin/catalogo/[entidad]/       listado y formulario por entidad
lib/admin/acceso.ts                 resolver sesión + rol, exigir rol
lib/admin/validaciones.ts           funciones puras de validación
lib/admin/referencias.ts            si una entidad se puede borrar
lib/admin/acciones.ts               Server Actions de las mutaciones
server/io.ts                        singleton de io para emitir desde HTTP
```

**Se modifica:**

- `prisma/schema.prisma` — la migración de §3
- `app/api/auth/boxes/route.ts` — devolver el rol
- `app/api/auth/login/route.ts` — permitir sesión sin box
- `lib/auth/sesion.ts` — `boxId` opcional en `abrirSesion`
- `app/operador/login/page.tsx` — opción "Panel de administración"
- `app/kiosco/Wizard.tsx` — catálogo diferido
- `server/index.ts` — registrar `io` en el singleton
- `CLAUDE.md` — cómo se promueve el primer admin
