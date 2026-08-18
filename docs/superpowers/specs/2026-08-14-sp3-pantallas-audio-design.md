# SP3 — Pantallas de llamado por ala y audio

**Fecha:** 2026-08-14
**Estado:** aprobado, listo para plan de implementación
**Depende de:** SP0 (modelo de datos, rooms) y SP2 (handlers de llamado), ambos completos

---

## 1. Alcance

Dos televisores, uno por ala, que muestran a quién se está llamando y a qué box tiene que ir.
Suena una campanilla en cada llamado nuevo.

**Fuera de alcance:** voz sintética, pantallas por piso, contenido institucional rotativo, panel de
administración de pantallas (SP4) y métricas de llamado (SP5).

---

## 2. Decisiones cerradas

| Decisión | Elección | Por qué |
|---|---|---|
| Cantidad de pantallas | Dos, una por ala | Room `ala:norte` / `ala:sur` ya existe y ya recibe los eventos |
| Identidad de cada TV | URL fija: `/pantalla/norte`, `/pantalla/sur` | Se configura una vez como página de inicio; nadie la cambia por accidente y no hay estado que se pierda |
| Sonido | Campanilla, sin voz | Un solo archivo, nada que pronunciar mal, nada que mantener |
| Contenido | Llamado actual + últimos llamados | Quien levanta la vista tarde igual encuentra su número |
| Dato personal en pantalla | Nombre completo; DNI sólo si no hay nombre | Ver §3 |
| Trámite en pantalla | **No se muestra** | Ver §3 |
| Turnos derivados | Se ven igual que cualquier llamado | Sin marca especial: un llamado es un llamado |
| Estado inactivo | Muestra el logo cuando no hay turno en estado `llamado` | Cuando el turno pasa a `atendiendo`, `finalizado`, etc., `actual` queda nulo y aparece el logo; sigue en `ultimos` |
| Obtención del estado | Re-snapshot completo en cada evento | Una sola proyección; cliente y servidor no pueden divergir |

---

## 3. Privacidad

La pantalla muestra **número, nombre completo y box**. Nada más.

**El trámite no viaja al cliente.** `SnapshotPantalla` no tiene campo de trámite, así que no puede
filtrarse por descuido. La razón: el catálogo incluye "Prótesis", "Tomografía" y "Programa Materno";
un nombre y un trámite médico juntos en un pasillo son un dato de salud identificable, la categoría
que la Ley 25.326 trata como sensible. Sin el trámite, la pantalla no vincula a una persona con
ninguna condición.

**Identificación:** `Turno.nombreAfiliado` si existe; si no, `Turno.dni`. Nunca los dos. Quien no
está en el padrón de afiliados no tiene nombre cargado, y el DNI es lo único que le permite
reconocerse.

**`ENTRAR_PANTALLA` no pide sesión.** Es una pantalla pública sin login, a diferencia de
`ENTRAR_BOX`, que sí exige `SesionOperador`. Por eso el snapshot de la TV expone estrictamente lo que
ya está a la vista de cualquiera que mire el televisor.

---

## 4. Arquitectura

### 4.1 Ruta

`app/pantalla/[ala]/page.tsx` es un Server Component. Resuelve el slug (`norte`, `sur`) contra las
alas de la base, devuelve 404 si no coincide, y renderiza el cliente pasándole el nombre real del
ala.

### 4.2 Socket

Un evento nuevo, `ENTRAR_PANTALLA { ala }`, **sin autenticación**. Une el socket a `roomAla(ala)` y
devuelve el snapshot por ack.

`server/rooms.ts` **se modifica** para que `TURNO_INICIADO`, `TURNO_AUSENTE` y `TURNO_DERIVADO`
también emitan a `roomAla(ctx.ala)`. Sin esto, la pantalla mantiene el número en grande cuando el
operador ya inició la atención o marcó al paciente como ausente.

### 4.3 Flujo

1. La TV abre `/pantalla/norte` y conecta el socket.
2. Emite `ENTRAR_PANTALLA { ala: "Norte" }` y recibe `SnapshotPantalla`.
3. Ante cualquier `TURNO_LLAMADO`, `TURNO_RELLAMADO`, `TURNO_INICIADO`, `TURNO_AUSENTE` o
   `TURNO_DERIVADO` que llegue al room, vuelve a emitir `ENTRAR_PANTALLA` y reemplaza el snapshot.
4. Si el `eventoId` del llamado actual cambió respecto del render anterior, suena la campanilla y el
   número destella.

El re-snapshot cuesta una consulta por llamado por pantalla. Con dos televisores y unos pocos
llamados por minuto es despreciable, y elimina la clase de bug en que la proyección del cliente se
desincroniza de la del servidor.

---

## 5. Modelo de datos

Nada de esto requiere migración. Todo sale de tablas que SP0 ya creó.

### 5.1 Tipos

```ts
export interface LlamadoPantalla {
  eventoId: string               // TurnoEvento.id — identidad del llamado, no del turno
  numero: string                 // "P01"
  boxNombre: string              // "Box 3"
  identificacion: string | null  // nombreAfiliado, o dni si no hay nombre, o null
  llamadoEn: string              // ISO
}

export interface SnapshotPantalla {
  ala: string
  actual: LlamadoPantalla | null
  ultimos: LlamadoPantalla[]     // exactamente los 4 anteriores al actual
}
```

`SnapshotPantalla` **no tiene campo de trámite**, por §3.

`identificacion` es nullable porque `Turno.nombreAfiliado` y `Turno.dni` lo son los dos. Si ninguno
está cargado, la pantalla muestra el número y el box, y omite la línea del nombre sin dejar hueco.

`ultimos` lleva **4 llamados**. Es lo que entra cómodo en la columna a tamaño legible desde lejos;
más entradas obligarían a achicar la tipografía justo en la información de repesca.

### 5.2 La consulta

`armarSnapshotPantalla(ala)` lee `TurnoEvento`, no `Turno`: el turno no guarda cuándo lo llamaron, y
ese es el orden que la pantalla necesita.

- `tipo` en `("llamado", "rellamado")` — los valores exactos de `TipoEvento` en `lib/queue/tipos.ts`
- `box.alaId` igual al ala pedida
- `timestamp` dentro del día de hoy
- orden `timestamp` descendente, tomando 5 (el actual más los 4 anteriores)

El primero es `actual`; el resto, `ultimos`. Aprovecha el índice `@@index([timestamp])` que ya existe.

Esta forma resuelve sola tres cosas:

- **Un rellamado vuelve a subir el turno al tope**, que es exactamente lo que se busca al rellamar.
- **`actual` existe solo cuando el turno está en estado `llamado`**. Si el operador inicia, marca
  ausente o finaliza, `actual` se pone nulo y el turno baja a `ultimos`. La pantalla muestra el logo
  de espera hasta el próximo llamado; el evento de ese turno sigue visible en la lista lateral.
- **`eventoId` como identidad** hace que rellamar el mismo número cuente como llamado nuevo, y por lo
  tanto suene la campanilla.

### 5.3 Trampa de fechas

SP2 estableció usar `Date.UTC()` para filtrar por `Turno.fecha`, que es una columna `DATE` y SQL
Server convierte implícitamente a medianoche UTC.

**Acá la regla es la opuesta.** `TurnoEvento.timestamp` es `DATETIME2`: guarda un instante real, sin
conversión implícita. Filtrar el día con `Date.UTC()` correría el corte tres horas y mostraría
llamados de ayer entre las 21:00 y la medianoche. El corte del día se calcula en hora local.

Son reglas opuestas para columnas de tipo distinto y conviene tenerlo presente al implementar.

---

## 6. La pantalla

Orientación apaisada, base 1920×1080, leída a varios metros.

### 6.1 Estructura

```
┌──────────────────────────────────────────────────────────┐
│ [logo OSP]        ALA NORTE        ● En línea    14:32   │
├───────────────────────────────────┬──────────────────────┤
│                                   │  ANTERIORES          │
│   P01                             │  T04          Box 1  │
│   González, María                 │  C12          Box 2  │
│   ┌─────────┐                     │  P02          Box 3  │
│   │  Box 3  │                     │  R07          Box 1  │
│   └─────────┘                     │                      │
└───────────────────────────────────┴──────────────────────┘
```

El box va en la pastilla destacada porque es el único dato que la persona todavía no tiene: el número
ya lo trae impreso en el ticket.

### 6.2 Tamaños

Tipografía en unidades relativas al viewport. **No se usa `EscaladorKiosco`**: ese existe porque el
kiosco tiene un layout en píxeles fijos calibrados, y acá son dos columnas de texto que fluyen solas.
Evita acoplar la pantalla al kiosco.

### 6.3 Paleta

Fondo azul marino en degradé diagonal, de `#101c3d` a `#24407e`. La diagonal y las paradas dentro de
la misma familia existen para cortar el bandeo: un degradé estirado a 1920px en un panel de 8 bits
tiende a mostrar franjas, y en diagonal dejan de leerse como tales.

**Todo el texto va en blanco.** Nada de grises azulados: a esa distancia se apagan y se pierden. La
jerarquía se sostiene con tamaño, peso y espaciado, no con color. Las etiquetas chicas
("ANTERIORES", "ALA NORTE") quedan blancas pero más chicas y con más tracking, para no competir.

**Pastilla del box:** rojo institucional en su variante clara (`#f2564e`) con texto oscuro encima. El
`--osp` original (`#d31d16`) da 3.6:1 sobre el fondo, por debajo del mínimo; la variante clara llega
a 5.4:1, que es lo que la regla de dark mode pide —variantes tonales más claras, no colores
invertidos. Es el único color saturado de la pantalla, así que la mirada va directo al box.

El rojo sobre azul vibra cuando es tipografía fina. Acá es un bloque sólido con texto oscuro encima,
que es el caso en que no ocurre.

### 6.4 Logo

`/OSP_Gobierno.webp`, el mismo asset que ya usan el kiosco, el ticket y la landing.

Es un lockup **San Juan Gobierno + OSP** con tipografía negra, hecho para fondo blanco. Sobre el azul
va en una **placa blanca con aire propio**: el asset queda intacto, sin recolorear.

### 6.5 Reloj y estado de conexión

**El reloj usa cifras tabulares.** Sin `tabular-nums` el ancho del `1` difiere del `8` y el reloj se
corre unos píxeles a cada cambio de minuto. En una pantalla fija que la gente mira largo rato, ese
temblor se nota.

**El estado nunca se comunica sólo por color.** Punto verde con la palabra "En línea"; al caerse,
ámbar con "Sin conexión". Un daltónico y una TV mal calibrada ven lo mismo, y nadie puede acercarse a
inspeccionar.

**El reloj no alcanza como señal de vida.** Corre en el cliente, así que sigue andando aunque haga
media hora que no llega nada. El indicador de conexión es el único que distingue "no llamaron a
nadie" de "esto está congelado". Por eso van los dos.

---

## 7. El sonido

Suena cuando cambia el `eventoId` del llamado actual respecto del render anterior. Esa única regla da
tres comportamientos correctos:

- No suena en la carga inicial.
- No suena al reconectar, si nadie llamó mientras tanto.
- **Sí** suena cuando el operador rellama el mismo número, porque es un evento nuevo aunque el turno
  sea el mismo.

El número además destella al entrar. El destello respeta `prefers-reduced-motion`: si el sistema lo
pide, el número cambia sin animación.

### 7.1 La campanilla se sintetiza, no se sirve

Dos tonos descendentes generados con la Web Audio API, no un archivo. No hay binario que versionar,
que se pueda romper en el deploy ni que devuelva 404 dejando la pantalla muda sin aviso. Un aviso de
dos tonos es exactamente lo que hace falta y son diez líneas de código.

### 7.2 El autoplay, que es lo que rompe esto en producción

Chrome bloquea el audio hasta que haya un gesto del usuario, y en una TV nadie hace clic nunca.

**Solución al instalar:** lanzar el navegador con `--autoplay-policy=no-user-gesture-required`.

**Red de contención:** si el `play()` es rechazado, la pantalla muestra un cartel discreto de "tocar
para activar el sonido" que desaparece con el primer toque. Así una TV mal configurada se nota y se
arregla, en vez de quedar muda en silencio.

---

## 8. Errores y degradación

| Qué falla | Qué hace la pantalla |
|---|---|
| Se cae el socket | Conserva el último llamado. Indicador en ámbar, "Sin conexión". socket.io reintenta solo |
| Vuelve el socket | Re-snapshot. No suena campanilla si el tope no cambió |
| Se cae SQL Server | El ack falla; la pantalla no cambia nada |
| No hay turno actualmente en estado `llamado` | Logo institucional centrado (con animación de espera) |

**La pantalla nunca se vacía ni muestra un error a pantalla completa.** En un pasillo, una TV en
blanco parece rota; una TV con un dato viejo sigue sirviendo a quien está esperando. El indicador de
conexión alcanza para que el personal detecte el problema.

---

## 9. Retiro del legacy

`app/public-display/` se elimina completo. Es de la era Supabase, importa `DEPARTAMENTOS` de
`lib/types` y arrastra errores de TypeScript preexistentes que `npx tsc --noEmit` viene reportando.

Mismo movimiento que SP2 hizo con `app/OperadorTurno/`. Antes de borrar, verificar que nada lo
enlace.

---

## 10. Pruebas

**Unitarias** — dos funciones puras cargan casi todo el peso, y se prueban sin base ni navegador:

- La proyección de eventos a `SnapshotPantalla`: dado un conjunto de eventos, qué sale como `actual`
  y qué como `ultimos`. Incluye el caso del rellamado que vuelve a subir al tope.
- `debeSonar(anterior, actual)`: no suena en la carga inicial, no suena si el tope no cambió, sí
  suena ante un `eventoId` nuevo.

**Integración** — `armarSnapshotPantalla` contra `Turnero_Test`, incluyendo el corte del día en hora
local de §5.3.

**E2E** — el que importa es el de aislamiento: se llama un turno en el Norte y se afirma que aparece
en `/pantalla/norte` **y que no aparece en `/pantalla/sur`**. La aserción negativa es la que prueba el
ruteo por ala; la positiva sola pasaría igual si el servidor emitiera a todos.

---

## 11. Archivos

```
app/pantalla/[ala]/page.tsx           Server Component, resuelve el ala, 404 si no existe
app/pantalla/[ala]/PantallaAla.tsx    orquesta
app/pantalla/usarSocketPantalla.ts    conecta, ENTRAR_PANTALLA, re-snapshot
app/pantalla/usarCampanilla.ts        audio + debeSonar
app/pantalla/LlamadoActual.tsx        número, nombre, pastilla del box
app/pantalla/UltimosLlamados.tsx      columna lateral
app/pantalla/EncabezadoPantalla.tsx   logo, ala, reloj, estado
server/snapshotPantalla.ts            armarSnapshotPantalla(ala)
```

Sin archivo de audio: la campanilla se sintetiza (§7.1).

**Se modifica:**
- `server/index.ts`, para registrar `ENTRAR_PANTALLA`.
- `server/rooms.ts`:
  - Se exporta la función `slug` que ya existía (URL de la pantalla y nombre del room normalizan igual).
  - Se agregan `TURNO_INICIADO`, `TURNO_AUSENTE` y `TURNO_DERIVADO` al room del ala, para que la
    pantalla actualice cuando el operador inicia atención, marca ausente o deriva.

**Se elimina:** `app/public-display/`.
**No se toca:** `prisma/schema.prisma`. SP3 no requiere migración.
