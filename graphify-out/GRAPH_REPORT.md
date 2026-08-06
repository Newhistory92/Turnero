# Graph Report - .  (2026-08-05)

## Corpus Check
- Corpus is ~12,794 words - fits in a single context window. You may not need a graph.

## Summary
- 262 nodes · 430 edges · 27 communities (13 shown, 14 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.86)
- Token cost: 305,150 input · 130,779 output

## Community Hubs (Navigation)
- Kiosk Turno Selection UI
- Toast Notification System
- Socket.io + Supabase Backend
- Public Display & Turno State
- NPM Dependencies
- TypeScript Config
- shadcn UI Config
- Build Scripts & Dev Deps
- Turno API Routes & Operator Actions
- App Layout & Socket Hooks
- Badge/Select UI Components
- Config Cross-References
- OSP Gobierno Branding
- Next.js Config
- PostCSS Config
- Claude Settings
- Select Component
- Select Value
- Toast Provider
- Placeholder Image
- Placeholder Logo
- Placeholder Logo SVG
- Placeholder SVG
- Placeholder User Avatar
- Project README
- Tokensave Branch Metadata
- Tokensave Config

## God Nodes (most connected - your core abstractions)
1. `useSocket()` - 17 edges
2. `compilerOptions` - 16 edges
3. `supabase` - 12 edges
4. `loadStateFromSupabase()` - 12 edges
5. `SocketProvider()` - 11 edges
6. `DEPARTAMENTOS` - 11 edges
7. `Turno` - 9 edges
8. `DepartamentoPage` - 8 edges
9. `Button` - 8 edges
10. `Card` - 8 edges

## Surprising Connections (you probably didn't know these)
- `NextApiResponseServerIO` --semantically_similar_to--> `server.ts Entry Point (Next.js + Socket.io + Supabase)`  [INFERRED] [semantically similar]
  lib/next.ts → server.ts
- `loadStateFromSupabase()` --shares_data_with--> `turnos table schema`  [INFERRED]
  server.ts → docs/superpowers/specs/2026-06-09-socket-supabase-design.md
- `prisma client (PrismaClient singleton)` --semantically_similar_to--> `supabase`  [INFERRED] [semantically similar]
  app/config/primsma.ts → lib/supabase.ts
- `Diseno: Servidor Socket.io + Supabase - Turnero` --references--> `useSocket()`  [EXTRACTED]
  docs/superpowers/specs/2026-06-09-socket-supabase-design.md → lib/useSocket.ts
- `loadStateFromSupabase()` --shares_data_with--> `contadores table schema`  [INFERRED]
  server.ts → docs/superpowers/specs/2026-06-09-socket-supabase-design.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Socket.io Real-Time Turno Event Flow** — lib_turno_context_socketprovider, server_generar_turno_handler, server_llamar_turno_handler, server_finalizar_atencion_handler, server_registrar_atencion_handler, server_loadstatefromsupabase [INFERRED 0.85]
- **Toast Notification State Machine** — hooks_use_toast_toast, hooks_use_toast_usetoast, hooks_use_toast_reducer, hooks_use_toast_dispatch, hooks_use_toast_addtoremovequeue [EXTRACTED 0.95]
- **Dual Database Client Pattern (Prisma legacy vs Supabase current)** — app_config_primsma_prisma, lib_supabase_supabase, server_loadstatefromsupabase [INFERRED 0.75]
- **Components consuming shared realtime turno state via useSocket()** — app_operadorturno_page_employeepage, app_public_display_departamento_components_departamentoselector_departamentoselector, app_public_display_departamento_components_turnodisplay_turnodisplay, app_turnero_page_kioskpage, app_turnero_departamento_page_departamentopage, app_turnero_departamento_components_seleccionservicio_seleccionservicio, components_supabase_status_supabasestatus [INFERRED 0.85]
- **Shared shadcn-style UI primitive components (cva + cn pattern)** — components_ui_badge_badge, components_ui_button_button, components_ui_card_card, components_ui_select_select, components_ui_toast_toast [INFERRED 0.85]
- **Turno lifecycle: generado -> llamado -> atendido -> registrado, spanning client operator actions, in-memory socket state, and DB persistence** — app_operadorturno_page_llamarsiguienteturno, app_operadorturno_page_iniciaratencion, app_operadorturno_page_finalizaratencion, app_api_socket_route_updateglobalstate, app_api_socket_route_handlewebsocket, app_api_turnos_route_post, app_turnero_departamento_page_departamentopage [INFERRED 0.75]

## Communities (27 total, 14 thin omitted)

### Community 0 - "Kiosk Turno Selection UI"
Cohesion: 0.14
Nodes (25): ClockDisplay, colorMapDepartamentos, iconMapDepartamentos, DepartamentoKey, SeleccionServicio, ServicioKey, printTicket, Props (+17 more)

### Community 1 - "Toast Notification System"
Cohesion: 0.09
Nodes (25): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+17 more)

### Community 2 - "Socket.io + Supabase Backend"
Cohesion: 0.16
Nodes (22): prisma client (PrismaClient singleton), Socket.io + Supabase Implementation Plan, superpowers:subagent-driven-development (required sub-skill), contadores table schema, Diseno: Servidor Socket.io + Supabase - Turnero, empleados table schema, registros_atencion table schema, turnos table schema (+14 more)

### Community 3 - "Public Display & Turno State"
Cohesion: 0.17
Nodes (16): CurrentTurnoBanner, TurnoCard, ClockDisplay, colorMapDepartamentos, IconComponents, TurnoDisplay, TurnoList, initialState (+8 more)

### Community 4 - "NPM Dependencies"
Cohesion: 0.08
Nodes (23): NextApiResponseServerIO, dependencies, autoprefixer, class-variance-authority, clsx, cmdk, framer-motion, @hookform/resolvers (+15 more)

### Community 5 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 6 - "shadcn UI Config"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 7 - "Build Scripts & Dev Deps"
Cohesion: 0.11
Nodes (17): devDependencies, postcss, prisma, tailwindcss, tsx, @types/node, @types/react, @types/react-dom (+9 more)

### Community 8 - "Turno API Routes & Operator Actions"
Cohesion: 0.18
Nodes (14): broadcastToAllClients, clients, GET (socket route), globalTurnoState, handleWebSocket, updateGlobalState, GET (turnos route), POST (turnos route) (+6 more)

### Community 9 - "App Layout & Socket Hooks"
Cohesion: 0.16
Nodes (12): inter, metadata, RootLayout(), HomePage(), ClockDisplay, DepartamentoSelector, PublicDisplayPage, KioskPage (+4 more)

### Community 10 - "Badge/Select UI Components"
Cohesion: 0.19
Nodes (11): Badge, BadgeProps, badgeVariants, SelectContent, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton (+3 more)

### Community 11 - "Config Cross-References"
Cohesion: 0.50
Nodes (3): shadcn/ui Components Config, config, TypeScript Config

### Community 12 - "OSP Gobierno Branding"
Cohesion: 1.00
Nodes (3): OSP Gobierno San Juan Logo Banner, OSP - Obra Social Provincia (San Juan provincial health insurance), San Juan Gobierno (provincial government logo/brand)

## Ambiguous Edges - Review These
- `globalTurnoState` → `POST (turnos route)`  [AMBIGUOUS]
  app/api/socket/route.ts · relation: conceptually_related_to
- `useSocket()` → `useSocket()`  [AMBIGUOUS]
  lib/useSocket.ts · relation: semantically_similar_to

## Knowledge Gaps
- **131 isolated node(s):** `clients`, `GET (socket route)`, `inter`, `metadata`, `ClockDisplay` (+126 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `globalTurnoState` and `POST (turnos route)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `useSocket()` and `useSocket()`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `dependencies` connect `NPM Dependencies` to `Toast Notification System`, `Build Scripts & Dev Deps`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **Why does `react` connect `Toast Notification System` to `NPM Dependencies`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `loadStateFromSupabase()` (e.g. with `SocketProvider()` and `RegistroAtencion`) actually correct?**
  _`loadStateFromSupabase()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `clients`, `GET (socket route)`, `inter` to the rest of the system?**
  _131 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Kiosk Turno Selection UI` be split into smaller, more focused modules?**
  _Cohesion score 0.14453781512605043 - nodes in this community are weakly interconnected._