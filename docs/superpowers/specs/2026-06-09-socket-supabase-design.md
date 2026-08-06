# Diseño: Servidor Socket.io + Supabase — Turnero

**Fecha:** 2026-06-09  
**Estado:** Aprobado

---

## Objetivo

Crear un servidor Node.js (`server.ts`) que integre Next.js, Socket.io y Supabase, reemplazando el estado en memoria del `app/api/socket/route.ts` actual por persistencia real en Supabase, y mostrando el estado de conexión a la base de datos en la UI.

---

## Arquitectura

Un único proceso Node.js arranca tanto Next.js como Socket.io sobre el mismo servidor HTTP:

```
[Browser/Cliente]
      │  socket.io-client → ws://localhost:3000
      ▼
[server.ts :3000]
  ├── Next.js handler (HTTP / páginas)
  ├── Socket.io server
  └── Supabase Client (service_role key)
          │
          ▼
  [Supabase PostgreSQL — zpleuaekkxohguuwxoxt]
```

- El cliente (`lib/useSocket.ts`) apunta a `ws://localhost:3000` (o la IP del servidor en producción).
- Al iniciar, el servidor verifica la conexión a Supabase y emite el evento `SUPABASE_STATUS` a todos los clientes.
- Los clientes muestran un indicador visual (conectado / desconectado).

---

## Tablas Supabase

### `turnos`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `text` PK | ID único del turno |
| `numero` | `text` | Número visible (ej: A01) |
| `servicio` | `text` | Tipo de servicio |
| `departamento` | `text` | Departamento |
| `timestamp` | `timestamptz` | Momento de creación |
| `estado` | `text` | esperando / llamado / atendido / finalizado |
| `box_asignado` | `text` | Box asignado al llamar |
| `tiempo_llamado` | `timestamptz` | Momento en que fue llamado |
| `tiempo_atencion` | `integer` | Duración de atención en segundos |

### `contadores`
| Columna | Tipo | Descripción |
|---|---|---|
| `servicio` | `text` PK | Nombre del servicio |
| `valor` | `integer` | Contador actual |

Servicios: `auditoria`, `planes`, `social`, `personalizada`, `emision_carnet`, `atencion_personalizada_afiliaciones`, `control_aportes`, `inicio_expediente`.

### `empleados`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` PK | ID del empleado |
| `nombre` | `text` | Nombre completo |
| `box_id` | `text` | Box asignado (box1..box10) |

### `registros_atencion`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` PK | ID del registro |
| `numero_turno` | `text` | Número del turno atendido |
| `servicio` | `text` | Servicio |
| `departamento` | `text` | Departamento |
| `box_asignado` | `text` | Box donde se atendió |
| `empleado_id` | `uuid` FK → empleados | Empleado que atendió |
| `tiempo_atencion` | `integer` | Duración en segundos |
| `fecha` | `timestamptz` | Fecha y hora del registro |

> Turnos atendidos por empleado = `COUNT(*) FROM registros_atencion GROUP BY empleado_id` — se calcula en tiempo real, no se almacena como campo separado.

---

## Archivos a crear / modificar

| Archivo | Acción | Descripción |
|---|---|---|
| `server.ts` | CREAR | Servidor Node.js: Next.js + Socket.io + Supabase |
| `lib/supabase.ts` | CREAR | Cliente Supabase con service_role key |
| `lib/useSocket.ts` | MODIFICAR | Apuntar a `localhost:3000` en lugar de `10.25.1.77:3001` |
| `.env.local` | CREAR | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `package.json` | MODIFICAR | Script `dev` usa `ts-node server.ts` |
| UI (componente existente) | MODIFICAR | Mostrar indicador de estado Supabase |

---

## Eventos Socket.io

### Servidor → Cliente
| Evento | Descripción |
|---|---|
| `SUPABASE_STATUS` | `{ connected: boolean }` — estado de conexión a Supabase |
| `ESTADO_SINCRONIZADO` | Estado completo al conectar un cliente |
| `TURNO_GENERADO` | Nuevo turno creado y persistido |
| `TURNO_LLAMADO` | Turno llamado a un box |
| `TURNO_FINALIZADO` | Turno marcado como atendido |
| `ATENCION_REGISTRADA` | Registro de atención guardado |

### Cliente → Servidor
| Evento | Descripción |
|---|---|
| `TURNO_GENERADO` | Solicitud de nuevo turno |
| `TURNO_LLAMADO` | Operador llama al siguiente turno |
| `TURNO_FINALIZADO` | Operador finaliza atención |
| `ATENCION_REGISTRADA` | Registro de atención completada |

---

## Indicador visual de conexión

Un componente pequeño (badge/dot) visible en el layout principal:
- 🟢 Verde — Supabase conectado
- 🔴 Rojo — Supabase desconectado

Se actualiza en tiempo real vía el evento `SUPABASE_STATUS`.

---

## Variables de entorno

```env
SUPABASE_URL=https://zpleuaekkxohguuwxoxt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

---

## Dependencias adicionales

- `@supabase/supabase-js` — cliente oficial de Supabase
- `ts-node` — para ejecutar `server.ts` directamente
- `tsx` — alternativa más rápida a ts-node (recomendado)
