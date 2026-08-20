# SP6 — Usuarios: alta desde la obra social y asignación de roles

## 1. El problema

Hoy no hay forma de dar de alta a una persona en el Turnero desde la interfaz. El único
camino es correr `scripts/importarEmpleados.ts` a mano, y después entrar a la base con
SQL para cambiarle el rol. Lo mismo pasa con los boxes: `EmpleadoBox` sólo se lee en
`lib/auth/sesion.ts:32` para verificar que el operador esté habilitado en el box que
abre — nunca se escribe desde la aplicación, sólo desde `scripts/asignarBoxes.ts`.

El síntoma concreto: una credencial válida de la obra social entra al login y recibe
"Tu usuario es válido pero no estás habilitado en el turnero", sin que el administrador
tenga manera de habilitarla.

SP6 cierra ese hueco con una sola pantalla que cubre el ciclo de vida completo de una
persona en el sistema: importarla, darle rol, asignarle boxes y darla de baja.

## 2. Alcance

**Entra:** importación selectiva desde la obra social, cambio de rol, alta y baja
lógica, asignación de boxes.

**No entra:** creación de empleados que no existan en la obra social (el Turnero no es
la fuente de verdad de las personas), edición de nombres a mano (vienen de la obra
social), y borrado físico de empleados (rompería el historial de atenciones).

## 3. Ubicación y control de acceso

La pantalla vive en `/admin/usuarios`. Se llama "Usuarios" y no "Tablero" porque
`/tablero` ya es el dashboard de estadísticas de SP5.

El link aparece en el nav de `app/admin/layout.tsx` **sólo con `puedeEditarCatalogo`**,
es decir sólo para `admin`. Mismo tratamiento que "Alcance de métricas".

El control de acceso tiene tres capas, y ninguna confía en la anterior:

1. `app/admin/layout.tsx` ya rebota a `/operador/login` a quien no tenga
   `puedeVerCatalogo` — eso deja afuera a `operador` y a `director`.
2. `app/admin/usuarios/page.tsx` redirige a `/admin` si no tiene
   `puedeEditarCatalogo` — eso deja afuera a `supervisor`.
3. Cada mutación revalida `puedeEditarCatalogo(actor.rol)` antes de tocar la base. Un
   `supervisor` que arme el POST a mano recibe el mismo rechazo que en la pantalla.

## 4. Restricción de seguridad heredada

**Nunca se copia la contraseña ni su hash a la base del Turnero.** La consulta de
importación selecciona documento y nombre, nunca `claveUsuario`. La validación de
credenciales sigue siendo en vivo contra la obra social en cada login, como fijó SP2.
Esta restricción no se relaja para nada de SP6.

## 5. Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/admin/importacion.ts` *(nuevo)* | `listarImportables()` e `importarEmpleados()` — núcleo movido desde el script |
| `scripts/importarEmpleados.ts` *(modificar)* | Envoltorio CLI que llama al núcleo |
| `lib/admin/usuarios.ts` *(nuevo)* | `listarUsuarios()` y `guardarUsuario()` |
| `lib/admin/acciones.ts` *(modificar)* | `accionImportar` y `accionGuardarUsuario` |
| `app/admin/usuarios/page.tsx` *(nuevo)* | Server Component: guard y consulta |
| `app/admin/usuarios/TablaUsuarios.tsx` *(nuevo)* | Cliente: una fila editable por empleado |
| `app/admin/usuarios/PanelImportar.tsx` *(nuevo)* | Cliente: buscador y casillas |
| `app/admin/layout.tsx` *(modificar)* | El link nuevo |

### 5.1 Por qué se mueve el núcleo del script

`scripts/importarEmpleados.ts` ya implementa exactamente lo que necesita el botón:
consulta la obra social filtrando con `SQL_EMPLEADOS`, crea al que falta con rol
`operador`, y reactiva al que ya existía en vez de duplicarlo. Reescribir esa lógica en
`lib/` dejaría dos implementaciones que se desincronizan la primera vez que alguien
toque una.

El núcleo se mueve a `lib/admin/importacion.ts`. `scripts/importarEmpleados.ts` pasa a
importar de ahí y queda sólo con el parseo de argumentos y los mensajes de consola. El
comando `npm run importar:empleados` sigue funcionando igual.

## 6. La importación

### 6.1 `listarImportables()`

Devuelve los empleados de la obra social junto con la marca de si ya están en el
Turnero:

```ts
interface Importable {
  nombreUsuario: string
  documento: string
  nombre: string        // "Apellido, Nombre"
  yaEsta: boolean       // existe un Empleado con ese dniInstitucional
}
```

La consulta filtra con `u.anulado = 0 AND ${SQL_EMPLEADOS}` — la misma condición que ya
usan el login y el script, que descarta afiliados, clínicas, prestadores, otras obras
sociales y organismos externos. Al momento de escribir este spec eso da 147 filas.

`yaEsta` se resuelve en el proceso, cruzando los documentos traídos contra un
`findMany` de `Empleado`. No se hace un JOIN entre bases porque son bases distintas del
mismo servidor y el cruce en memoria sobre 147 filas es trivial.

### 6.2 El panel

El botón "Importar" despliega un panel con la lista completa, un campo de búsqueda y una
casilla por fila.

El filtrado ocurre en el cliente sobre las 147 filas ya cargadas: no se consulta al
servidor por cada tecla. Filtra por nombre y por nombre de usuario, sin distinguir
mayúsculas ni acentos.

Las filas con `yaEsta: true` se muestran marcadas y deshabilitadas. Comunican "esta
persona ya está" sin necesidad de una segunda lista, y hacen imposible reimportarla por
accidente.

### 6.3 `importarEmpleados(usuarios: string[])`

Recibe nombres de usuario. Para cada uno que la consulta encuentre:

- Si no existe un `Empleado` con ese `dniInstitucional`: lo crea con rol `operador` y
  `activo: true`.
- Si existe: actualiza el nombre y lo pone `activo: true`. **No le toca el rol** — un
  supervisor que fue dado de baja y se reimporta vuelve como supervisor, no degradado a
  operador.

Devuelve `{ creados, actualizados, noEncontrados }`. `noEncontrados` lista los nombres de
usuario que la consulta no devolvió, que en la práctica sólo puede pasar si alguien fue
anulado entre que se cargó la pantalla y se confirmó la importación.

Los nuevos entran sin boxes asignados. Un operador sin boxes puede autenticarse pero el
login no le ofrece ningún destino, así que el paso siguiente —asignarle el box— es
obligatorio para que pueda trabajar.

## 7. La tabla de usuarios

### 7.1 `listarUsuarios()`

```ts
interface UsuarioFila {
  id: string
  dniInstitucional: string
  nombre: string
  rol: Rol
  activo: boolean
  boxIds: string[]
}
```

Ordenados por nombre. Incluye a los inactivos: dar de baja no es esconder, y si no
aparecieran no habría manera de reactivarlos desde la pantalla.

### 7.2 Las filas

Columnas: nombre, DNI, rol (desplegable con los cuatro roles), activo (casilla) y boxes
(casillas con todos los boxes activos).

Cada fila es su propio formulario con su propio botón de guardar, siguiendo el patrón de
`FormularioAlcance` de SP5. Un guardado por fila mantiene el estado de error acotado a
la persona que estabas editando.

Las filas de empleados inactivos se muestran atenuadas, para que se distingan de un
vistazo sin necesidad de una columna de estado aparte.

### 7.3 Tu propia fila

Aparece en la lista con el desplegable de rol y la casilla de activo **deshabilitados**,
y una marca "Sos vos" que explica por qué. Las casillas de boxes quedan editables:
cambiarte los boxes no te puede dejar afuera del panel.

Esto hace estructuralmente imposible el auto-bloqueo. Para cambiar tu propio rol tiene
que hacerlo otro admin — y si sos el único admin, primero promovés a alguien y después
esa persona te modifica.

## 8. `guardarUsuario(actor, datos)`

```ts
interface DatosUsuario {
  empleadoId: string
  rol: string
  activo: boolean
  boxIds: string[]
}
```

Validaciones, en orden:

1. `puedeEditarCatalogo(actor.rol)` — si no, error en campo `rol` con "No tenés permiso".
2. El empleado existe — si no, error genérico.
3. **Si `empleadoId === actor.id`**, se descartan `rol` y `activo` sin mirarlos y se
   guardan sólo los boxes. No es un error: la pantalla ya los mostró deshabilitados, así
   que un envío con esos campos alterados viene de alguien que manipuló el formulario.
   Se guarda lo legítimo y se ignora lo demás.
4. `esRol(rol)` — sólo se evalúa cuando el paso 3 no aplicó. Un rol fuera del
   vocabulario se rechaza antes de escribir.

El orden importa: validar el rol antes del guard de auto-edición haría que editarte tus
propios boxes fallara si el formulario manipulado trajera además un rol inválido, cuando
lo correcto es descartar ese rol y guardar los boxes.

Los boxes se guardan con el mismo patrón que `guardarAlcance` de SP5: `deleteMany` de
las asignaciones del empleado y `createMany` de las nuevas, dentro de una transacción.
`EmpleadoBox` no tiene más campos que las dos claves, así que reemplazar es equivalente
a diferenciar y más simple de leer.

Quitar todos los boxes deja al empleado sin destino en el login. Es un estado válido y
esperado para supervisores, directores y admins, que no atienden en un box.

## 9. Errores

Se reusa `EstadoFormulario` y `ErrorCampo` que ya existen. Los mensajes:

| Situación | Mensaje |
|---|---|
| Sesión vencida | "Tu sesión venció. Volvé a entrar" |
| Sin permiso | "No tenés permiso para editar usuarios" |
| Rol inválido | "Ese rol no existe" |
| Empleado inexistente | "Ese empleado ya no existe" |
| Importación sin selección | "Elegí al menos una persona" |
| La obra social no responde | "No se pudo consultar la base de la obra social" |

El último es el que más importa: si la base de la obra social está caída, la pantalla
tiene que decirlo con claridad en vez de mostrar una lista vacía que se lea como "no hay
nadie para importar".

## 10. Revalidación

`accionGuardarUsuario` y `accionImportar` revalidan `/admin/usuarios`, igual que
`accionGuardarAlcance` revalida `/admin/alcance`.

No se revalida `/kiosco` —los usuarios no son parte del catálogo que lee el tótem— ni
`/admin` con alcance `layout`. Esto último podría parecer necesario porque el nav
depende del rol, pero el rol que decide qué links ve una persona es el suyo propio, y
esa fila es justamente la que no se puede editar (§7.3). Un cambio de rol ajeno se ve
reflejado en el nav de esa persona en su siguiente pedido, sin revalidación.

## 11. Pruebas

**Unitarias** — validación de rol contra el vocabulario, y el guard de auto-edición
(que con `empleadoId === actor.id` los cambios de rol y activo se descartan y los boxes
se conservan).

**Integración** — importar crea con rol `operador`; importar a alguien que ya existe lo
reactiva sin cambiarle el rol; `listarImportables` marca `yaEsta` correctamente;
`guardarUsuario` cambia rol, activo y boxes; rechaza a un `supervisor`; y descarta los
cambios de rol sobre la propia fila del actor.

**E2E** — `/admin/usuarios` rebota a `/operador/login` sin sesión.

La cobertura E2E se limita al camino anónimo por la misma razón que en SP5: probar el
camino feliz requiere credenciales institucionales reales, que no existen en el entorno
de pruebas.

## 12. Qué queda afuera

- **Auditoría de cambios de rol.** No se registra quién cambió el rol de quién ni
  cuándo. Si más adelante hace falta, el lugar natural es una tabla nueva, no un campo
  en `Empleado`.
- **Importación masiva de los 147.** Se descartó a propósito: llenaría la tabla de
  gente que no usa el turnero y volvería inútil la propia pantalla.
- **Re-sincronización de nombres.** Los nombres se actualizan al reimportar a alguien
  que ya existe. Un botón dedicado para refrescar todos los nombres no se justifica
  hasta que aparezca el caso.
