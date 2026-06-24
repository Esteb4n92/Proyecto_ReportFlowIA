# Handoff — ReportFlow IA (antes "Excel Report Flow")

> Proyecto: app web (Next.js) standalone, separado de la landing de AIGILE.
> Ubicación: `C:\Users\esteb\Desktop\AIGILE\excel-report-flow`
> Repo git local (branch `master`), conectado a Supabase vía MCP. **No hacer push a GitHub sin preguntar primero.**

## Qué hace la app

1. Usuario sube un Excel + instrucciones opcionales para la IA
2. Se parsea el Excel y se manda a Claude para análisis + sugerencia de gráficos
3. Preview del reporte
4. Se envía por email a un aprobador con links de aprobar/rechazar (token único)
5. Dashboard con estado de aprobaciones en tiempo real

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4), gestor de paquetes **pnpm**
  - ⚠️ En Next.js 16 el archivo `middleware.ts` está **deprecado**: la convención es `proxy.ts` (función `proxy`). La protección de rutas vive en `src/proxy.ts`.
- Auth: **Supabase Auth** (email/password) + `@supabase/ssr` (sesión por cookies, SSR-friendly). Ver sección "Autenticación y seguridad".
- Claude API (`@anthropic-ai/sdk`, modelo `claude-haiku-4-5` — se bajó de Sonnet para ahorrar costo durante desarrollo; los datos se mandan como CSV compacto, muestra de 100 filas. Para la demo final cambiar a `claude-sonnet-4-6` en `src/lib/excel-flow/claude.ts`)
- Supabase (Postgres) — proyecto ref `kgbfqcperpskzgarsxvb`
- Resend (emails)
- `xlsx` (parsing de Excel en upload) · `exceljs` + `jszip` (export Excel con gráficos NATIVOS editables) · `@react-pdf/renderer` (export PDF sin navegador headless) · `react-markdown` + `remark-gfm` · `recharts`
- Motion (`motion/react`) + `@phosphor-icons/react` + Geist

### Sistema de diseño (rediseño jun 2026, desde design file de claude.ai/design)
- **Marca: "ReportFlow IA"** (wordmark con "IA" en gradiente sky→violet), logo en `public/logo-icon.png`
- Fondo **negro** + neutros **navy** (escala slate overrideada en `globals.css`: 900=#0a1233, 800=#1a2450, etc.)
- Acento **azul** (#3b82f6) con toques violeta; **verde reservado para éxito** (badges, checks)
- Series de gráficos con colores del logo: azul #3b82f6, verde #7ec936, naranja #ff8a1e, navy #475590
- Fondo animado compartido: `src/components/excel-flow/background-fx.tsx` (grid de puntos + blobs a la deriva, CSS en `globals.css`, respeta `prefers-reduced-motion`)
- **Copy en español neutro/colombiano** ("Sube", "Arrastra", "haz clic") — el usuario es colombiano, NO usar voseo argentino
- El bundle del design file quedó extraído en `%TEMP%\design-pkg\excel-report-flow\` (prototipos HTML/JSX de referencia)

## Variables de entorno (`.env.local`)

Todas configuradas y verificadas:
- `ANTHROPIC_API_KEY` ✅ (probada con curl, funciona)
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` ✅
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` ✅
  - El **anon key** ahora también lo usan los clientes de Supabase Auth/SSR (`createBrowserClient`/`createServerClient`). El **service role key** es solo server-side (API routes + scripts).
- `NEXT_PUBLIC_BASE_URL=http://localhost:3000`
- `SUPABASE_ACCESS_TOKEN` (opcional, **no commitear**): Personal Access Token (`sb_pat_…`) de https://supabase.com/dashboard/account/tokens. Solo lo usa `scripts/apply-migration.mjs` para aplicar migraciones vía Management API cuando no hay MCP/CLI disponible. No es necesario en runtime.

## Base de datos (Supabase)

Tablas ya creadas:
- `reports`: id, filename, raw_data (jsonb), instructions, analysis, charts_config (jsonb), **key_insights (jsonb)**, **sender_email (text)**, status, created_at
  - status: `pending | analyzing | ready | sent | approved | rejected`
  - `sender_email`: correo del admin que envió el reporte a aprobación; se usa para notificarle cuando un aprobador responde. Migración: `supabase/migrations/0003_add_sender_email.sql` (aplicada).
  - `key_insights`: array de `{label, value, description}` que devuelve Claude directamente (alimenta las tarjetas del dashboard sin regex). Migración: `supabase/migrations/0001_add_key_insights.sql`. `persistAnalysis()` degrada con gracia si la columna no existe.
- `approvals`: id, report_id, approver_email, token, status, comment, responded_at, created_at
  - índices en `approvals(token)` y `approvals(report_id)`
- `profiles`: id (FK a `auth.users`, on delete cascade), role (`admin` | `user`, default `user`, con CHECK), created_at
  - **RLS activa**: policy `profiles_select_own` → cada usuario solo lee su propia fila (`TO authenticated USING (auth.uid() = id)`). No hay policies de INSERT/UPDATE para clientes (un usuario **no** puede auto-promoverse a admin).
  - Trigger `on_auth_user_created` en `auth.users` → función `handle_new_user()` (SECURITY DEFINER, `search_path=''`) crea el profile con `role='user'` al registrarse un usuario.
  - Migración: `supabase/migrations/0002_profiles_and_roles.sql`.

> Nota: el cliente anon de Supabase (`src/lib/excel-flow/supabase.ts`) probablemente no tiene policy de SELECT sobre `reports` (RLS). Por eso la página de reporte ya no consulta Supabase directo desde el browser (ver "Hecho" más abajo). Si en Fase 5 se usa Realtime desde el cliente, revisar/crear policies de RLS en ese momento.

## Autenticación y seguridad

> Implementado en la sesión de auth (jun 2026). Login real con Supabase Auth + roles + protección de todas las rutas de la app.

### Cómo funciona
- **Login** (`/login`): formulario email/password (client component) que usa `createSupabaseBrowserClient()` → `supabase.auth.signInWithPassword()`. La sesión se guarda en cookies (vía `@supabase/ssr`), legibles por el server. No hay formulario público de registro: las cuentas se crean manualmente.
- **Proxy de protección** (`src/proxy.ts`, antes "middleware"): corre sobre `/excel-flow/:path*` y `/api/excel-flow/:path*`. Flujo:
  1. Refresca la sesión y llama `supabase.auth.getUser()`.
  2. **Sin sesión** → páginas redirigen a `/login?redirect=<ruta>`; APIs devuelven **401**.
  3. **Con sesión pero `role != 'admin'`** → páginas redirigen a `/restricted`; APIs devuelven **403**. No hay loop (`/restricted` y `/login` no están en el matcher).
  4. **Con sesión admin** → pasa. El rol se lee de `public.profiles` como el propio usuario (RLS), siempre fresco.
- **Pantalla de acceso restringido** (`/restricted`): para cuentas autenticadas que no son admin. No expone nada de la app; solo mensaje + botón de cerrar sesión.
- **Logout**: componente `LogoutButton` (`src/components/excel-flow/logout-button.tsx`) → `supabase.auth.signOut()` + redirect a `/login`. Está en el header de `/excel-flow`, en el header de `report/[id]` (variante `compact`) y en `/restricted`.

### Roles
- `admin`: acceso completo. **Única cuenta admin: `estebanvillawolk@gmail.com`** (creada vía `scripts/create-admin.mjs`, que la registra en Supabase Auth y setea `profiles.role='admin'`).
- `user`: cuenta válida a nivel de esquema/lógica (el trigger las crea con este rol por defecto), pero **bloqueada por completo por ahora** → cae en `/restricted`. Soporte pensado para personas naturales a futuro.

### Archivos clave
- `src/lib/excel-flow/supabase-browser.ts` — `createBrowserClient` (client components).
- `src/lib/excel-flow/supabase-server.ts` — `createServerClient` ligado a cookies (server components / route handlers).
- `src/proxy.ts` — protección de rutas + chequeo de rol.
- `src/app/login/page.tsx`, `src/app/restricted/page.tsx`, `src/components/excel-flow/logout-button.tsx`.
- `supabase/migrations/0002_profiles_and_roles.sql` — tabla `profiles` + RLS + trigger. **Ya aplicada** en el proyecto.
- `scripts/apply-migration.mjs` — aplica un `.sql` vía Management API (necesita `SUPABASE_ACCESS_TOKEN`).
- `scripts/create-admin.mjs` — crea/reutiliza un usuario y lo deja `role='admin'`.
- `scripts/setup-auth.mjs` — orquestador: migración (si hay PAT) + admin + verificación en un comando.
- `scripts/verify-auth.mjs` — verifica el flujo admin (login, RLS, 200 en `/excel-flow`, 401 sin sesión) forjando la cookie de `@supabase/ssr`.
- `scripts/verify-nonadmin.mjs` — verifica el gateo de un user no-admin (→ `/restricted`, API 403) con un usuario temporal que luego borra.

> El **PAT** se usó una sola vez (provisto inline) y **no quedó persistido** en disco. Para volver a correr migraciones: `$env:SUPABASE_ACCESS_TOKEN='sb_pat_…'; node scripts/apply-migration.mjs <archivo.sql>`, o usar el MCP de Supabase (ver abajo).

### Qué falta para habilitar cuentas 'user' en el futuro
- Decidir qué puede ver/hacer un `user` (¿solo sus propios reportes? ¿dashboard de solo lectura?).
- Ajustar el proxy: permitir `role='user'` en las rutas correspondientes (hoy exige `admin`).
- Si los `user` van a leer datos directo desde el cliente (no solo vía API con service role), agregar **policies de RLS** en `reports`/`approvals` por dueño (`auth.uid()`), y vincular reportes a un `owner_id`.
- (Opcional) Exponer un flujo de registro/invitación en la UI.

## Estado actual del código

### Hecho (sesión 23 jun 2026 — App shell "command center" + chrome del upload + hardening)

> Rediseño de la app autenticada a layout tipo command center. **En el working tree, sin commitear** (a la espera de confirmación). Build/tsc limpios y todas las rutas verificadas en `pnpm dev`.

**App shell con sidebar** (`/excel-flow/dashboard` y `/excel-flow/report/[id]`):
- `src/app/excel-flow/layout.tsx` (server) — lee el email del admin con `createSupabaseServerClient()` y monta `<AppShell>`. La protección sigue en `src/proxy.ts` (no se tocó).
- `src/components/excel-flow/app-shell.tsx` (client) — orquesta: `BackgroundFX` único, estado del drawer, título de la topbar derivado de `usePathname`. **Branch por pathname**: `/excel-flow` exacto usa chrome ligero; el resto usa el sidebar.
- `app-sidebar.tsx` — sidebar fija (drawer en móvil, hamburguesa + backdrop) con logo + "ReportFlow IA · Intelligence Center", nav real ("Nuevo análisis" → `/excel-flow`, "Reportes" → `/dashboard`, activo por ruta) y, abajo, email + `LogoutButton`. Sin Team/Files/Settings.
- `app-topbar.tsx` — título de sección (prop) + hamburguesa (móvil) + chip de email. Sin campana ni engranaje.

**Chrome ligero del upload** (`/excel-flow` exacto, SIN sidebar):
- `UploadChrome` (dentro de `app-shell.tsx`): top bar con logo/wordmark + botón "Reportes" arriba a la derecha; cuenta (email + `LogoutButton`) fija discreta abajo a la izquierda.
- `src/app/excel-flow/page.tsx` — **layout de dos columnas restaurado** (hero izquierda con `Words`/`Reveal` + `FLOW_STEPS`; panel derecha con dropzone, textarea+chips, botón "Analizar con IA" con 4 fases, `Magnetic` + tilt 3D). Acepta `.xlsx/.xls/.csv/.json`. La página es **una sola pantalla sin scroll** (`UploadChrome` es `h-[100dvh] overflow-hidden`, main `overflow-hidden`).

**Componentes compartidos extraídos** (antes duplicados en el reporte): `status-badge.tsx` (`StatusBadge` con prop `pulse` + `STATUS_LABEL`/`STATUS_STYLE`) y `download-menu.tsx` (`DownloadMenu`). Reusados por el reporte y las cards del historial.

**Historial rediseñado** (`dashboard/page.tsx` server + `dashboard-client.tsx` client): resumen de actividad con **conteos reales** (total / aprobados=`approved` / en aprobación=`sent`), tabs **Todos/Aprobados/Pendientes** (por status, con conteos), buscador por filename (cliente), grid de cards con badge real + fecha + filas + progreso de aprobación, acciones "Ver" + "Descargar" (gateada por status). Sin métricas inventadas, sin borrar, sin "cargar más".

**Encabezado de contenido del reporte** (`report/[id]/page.tsx`): breadcrumb (Reportes › archivo) + **botón Volver** (`ArrowLeft`, `aria-label="Volver"` → `/dashboard`) + título=filename + `ID` corto + "Actualizado hace…" (tiempo relativo REAL con `Intl.RelativeTimeFormat` desde `created_at`) + acciones gateadas. Jerarquía de `InsightCard`: título legible (label, sin uppercase, line-clamp) → dato (value, acento, secundario) → descripción. Toda la lógica intacta (polling, gating, refine, exports).

**Hardening de seguridad (DB)**: migración `0004_revoke_security_definer_execute.sql` **aplicada vía MCP** — `revoke execute` sobre `handle_new_user()` y `rls_auto_enable()` para `public/anon/authenticated`. Los security advisors quedaron en verde salvo *"Leaked Password Protection"* (toggle manual en el panel de Supabase, **pendiente del usuario**) — y rotar la contraseña del admin. El lint INFO "RLS enabled, no policy" en `reports`/`approvals` es **intencional y seguro** (deny-all a anon/authenticated; la app accede solo con service-role server-side). NO agregar policies permisivas.

**Verificación**: `pnpm exec tsc --noEmit` limpio (ignorando el ruido de `.next/dev/types`); todas las rutas autenticadas (upload, dashboard, reporte, enviar) → 200; exports Excel/PDF → 200; públicas de aprobación (página + PDF por token) → 200; gateo OK (login 200, upload→307, API→401).

### Hecho (sesión 20 jun 2026 — Fase 5 Dashboard + cierre de pendientes de Fase 4)

> ⚠️ **EN EL WORKING TREE SIN COMMITEAR** (a la espera de confirmación del usuario). Con esto **Fases 1-5 están completas**; solo queda Fase 6 (pulido + portafolio + deploy).

**Pendiente #1 — PDF en la página pública de aprobación (HECHO):**
- `src/app/api/approve/[token]/pdf/route.ts` (**nuevo, PÚBLICO**): GET que valida el token, busca el reporte y renderiza el PDF reusando `pdf-report.tsx`. Vive **fuera del matcher del proxy** (igual que el resto de `/api/approve/**`), así que el aprobador sin sesión puede usarlo.
- `src/app/approve/[token]/page.tsx`: botón **"Descargar PDF"** en el header del reporte (anchor a `/api/approve/[token]/pdf`).

**Pendiente #2 — Notificar al admin cuando aprueban/rechazan (HECHO):**
- Migración `supabase/migrations/0003_add_sender_email.sql` (**aplicada vía MCP**): `alter table reports add column sender_email text`. Agregado `sender_email` al tipo `Report`.
- `src/app/api/excel-flow/send-report/route.ts`: lee el correo del admin de la sesión (`createSupabaseServerClient().auth.getUser()`) y lo guarda en `reports.sender_email` al enviar.
- `src/lib/excel-flow/email.ts`: nueva `sendApprovalResultEmail()` (Resend, HTML branded con resultado aprobado/rechazado + comentario + correo del aprobador + link al reporte).
- `src/app/api/approve/[token]/route.ts`: tras registrar la respuesta y recomputar el estado, busca `reports.sender_email` y dispara la notificación. **No bloquea**: si el correo falla, la decisión ya quedó guardada.
- ⚠️ En demo sin dominio, esta notificación SÍ llega porque va a `estebanvillawolk@gmail.com` (el correo de la cuenta de Resend, única excepción del modo prueba).

**Pendiente #3 — Mostrar links tras enviar: DESCARTADO** por decisión del usuario (no le gustó exponer tokens en pantalla; prefiere terminar y conseguir dominio).

**Fase 5 — Dashboard "Reportes anteriores" (HECHO):**
- `src/app/excel-flow/dashboard/page.tsx` (**nuevo**): server component con `supabaseAdmin`. Lista reportes (más reciente primero, límite 100) con badge de estado, fecha, filas, hallazgos y **progreso de aprobaciones** (`X/Y aprobó` o `N rechazó`, computado de una sola consulta a `approvals` con `.in()`). Empty state con CTA. Protegido automáticamente por el proxy (`/excel-flow/**`). El botón "Reportes anteriores" del header de `/excel-flow` ya no da 404.

**Multi-aprobador**: ya funcionaba desde Fase 4 (varios correos separados por coma → un token por correo). El reporte pasa a `approved` solo si todos aprueban; si alguno rechaza → `rejected`.

**Verificación**: `pnpm build` limpio (TypeScript incluido); aparecen las rutas `/api/approve/[token]/pdf` y `/excel-flow/dashboard`.

**Pendiente menor**: cambiar el modelo a `claude-sonnet-4-6` en `src/lib/excel-flow/claude.ts` para la demo final (mejor calidad; costo ~$0.01→$0.05-0.10 por análisis). NO hecho aún.

### Hecho (sesión 18 jun 2026 — fixes críticos de análisis + Fase 4 envío/aprobación)

> ⚠️ **TODO ESTO ESTÁ EN EL WORKING TREE SIN COMMITEAR** (el usuario pidió no commitear ni pushear todavía). `git status` muestra los archivos modificados/nuevos.

**Fix crítico — el reporte se quedaba en "Analizando…" para siempre:**
- Causa raíz: con Excel anchos (~100 filas × ~25 columnas) el JSON de Claude superaba `max_tokens:4096` y se truncaba → `JSON.parse` fallaba → el status volvía a 'pending' → polling infinito en la UI. El array de puntos del scatter (un `{x,y}` por fila) era el mayor gasto de tokens.
- `src/lib/excel-flow/claude.ts`: `runClaude()` (helper compartido) con `max_tokens:8192`, **timeout duro de 45s** (AbortController, `maxRetries:0`), log del texto crudo si el parse falla, aviso si `stop_reason==='max_tokens'`. Reducción de volumen de salida (baja tiempo y costo): muestra `data.slice(0,60)` (antes 100); el prompt pide **≤40 puntos por scatter, ≤3-4 gráficos, ≤4 insights, análisis conciso ~200-300 palabras**. Red de seguridad `capScatterPoints()` recorta scatters a 40 por muestreo uniforme (haiku a veces ignora el límite).
- `src/app/api/excel-flow/analyze/route.ts`: idempotente (solo corre en 'pending'); el reintento manda `force:true` y recupera reportes colgados en 'analyzing'; resetea a 'pending' si falla.
- `src/app/excel-flow/report/[id]/page.tsx`: dispara el análisis al montar, polling con tope ~60s, botón "Reintentar" (manda `force`), y **gateo**: el menú Descargar y "Enviar a aprobación" solo aparecen con status ∈ ready|sent|approved|rejected.

**`key_insights` — la columna NO existía en la DB (causa real de insights=0):**
- `persistAnalysis` descartaba los insights al guardar (su degradación por columna ausente). Se **aplicó la migración `0001_add_key_insights.sql` vía MCP** (`add column key_insights jsonb`). Ahora los insights estructurados se persisten. Verificado end-to-end con `base_datos_planes_turisticos_colombia.xlsx` (200×25): llega a 'ready', sin truncar, 4 insights + 4 gráficos.
- Se afinó `looksLikeMetadata`: ahora escanea **solo label+value** (no `description`), para no descartar hallazgos legítimos cuya descripción menciona "registro/columna/informe".

**Soporte de `.json` en el upload** (ya estaba en el working tree, verificado): `src/lib/excel-flow/json-parser.ts` (arreglo de objetos · `{data:[...]}`/`{results:[...]}` · primitivos · objeto único), dispatch por extensión en `upload/route.ts`, dropzone acepta `.json`.

**Fase 4 — Envío + aprobación (COMPLETA, verificada end-to-end):**
- `src/lib/excel-flow/email.ts` — `sendApprovalEmail()` (Resend), HTML branded, link a `/approve/[token]`, no lanza (devuelve `{ok,error}`).
- `src/app/api/excel-flow/send-report/route.ts` (admin) — valida reporte listo + correos, crea una fila `approvals` por correo con token único (`crypto.randomBytes(24).toString('base64url')`), `report.status='sent'`, envía los emails, devuelve `{sent, failed}`.
- `src/app/excel-flow/report/[id]/send/page.tsx` — formulario de correos (separados por coma) + mensaje opcional, estados de éxito/error.
- `src/app/api/approve/[token]/route.ts` (**PÚBLICO**, fuera de `/api/excel-flow` a propósito) — valida token, registra approve/reject + comentario, recomputa `report.status` (**alguno rechaza → rejected; todos aprueban → approved; si queda pendiente → sent**). 409 si ya respondió, 404 si token inválido.
- `src/app/approve/[token]/page.tsx` (**PÚBLICO**, fuera de `/excel-flow`) — server component: resumen del reporte (insights + gráficos) + `ApprovalActions`. Maneja token inválido / ya respondido.
- `src/components/excel-flow/approval-actions.tsx` — botones Aprobar/Rechazar + comentario + confirmación.
- **DECISIÓN clave de arquitectura**: las rutas públicas (`/approve/**` y `/api/approve/**`) viven **FUERA del matcher de `proxy.ts`**, así no exigen sesión admin (el aprobador es externo). No se tocó `proxy.ts`. Se borró el dir vacío `api/excel-flow/approve`.
- Verificado: send protegido (401 sin sesión); 2 aprobadores → sent → approved; reject de uno → rejected; token reusado → 409; email inválido → 400; página pública con token válido → 200 con resumen.

### Hecho (sesión auth jun 2026 — login Supabase Auth + roles + protección de rutas)
- **Login + roles**: página `/login`, clientes browser/server de `@supabase/ssr`, tabla `profiles` con RLS + trigger (`0002_profiles_and_roles.sql`), pantalla `/restricted`, `LogoutButton` en los headers.
- **Protección de rutas** (`src/proxy.ts`): `/excel-flow/**` y `/api/excel-flow/**` exigen sesión admin. Migrado de `middleware.ts` a la convención `proxy.ts` de Next 16.
- **Cuenta admin**: `estebanvillawolk@gmail.com` creada con `scripts/create-admin.mjs`.
- Dependencia nueva: `@supabase/ssr`.
- **Migración aplicada** (Management API con un PAT) y **cuenta admin creada** (`estebanvillawolk@gmail.com`, user id `b31bfe3b-1655-406a-af61-af768cb58221`).
- **Verificado end-to-end con `pnpm dev`** (scripts `scripts/verify-auth.mjs` y `scripts/verify-nonadmin.mjs`):
  - Sin sesión: `/excel-flow` → 307 a `/login?redirect=…`, `/api/excel-flow/*` → **401** ✅
  - Sesión **admin**: `/excel-flow` → **200**, `/api/excel-flow/*` pasa el proxy ✅; RLS deja leer el propio `role='admin'` ✅
  - Sesión **no-admin**: `/excel-flow` → 307 a `/restricted`, `/api/excel-flow/*` → **403** ✅; el trigger crea el profile con `role='user'` ✅

### Hecho (Fase 1 + 2, verificada end-to-end ✅)
- `src/app/excel-flow/page.tsx` — pantalla de upload, rediseñada (Motion, Phosphor, dark zinc/emerald, Geist), incluye textarea de instrucciones opcionales
- `src/app/page.tsx` — redirect `/` → `/excel-flow`
- `src/lib/excel-flow/types.ts` — tipos `Report`, `Approval`, `ChartConfig`
- `src/lib/excel-flow/supabase.ts` — cliente público `supabase` (anon key), seguro para Client Components
- `src/lib/excel-flow/supabase-admin.ts` — cliente `supabaseAdmin` (service role key), **solo para uso server-side** (API routes). Está separado del cliente anon para que su evaluación no rompa componentes cliente (antes tiraba `supabaseKey is required` al importarse desde `report/[id]/page.tsx`).
- `src/lib/excel-flow/excel-parser.ts` — `parseExcelFile()` con `xlsx`, devuelve JSON
- `src/lib/excel-flow/claude.ts` — `analyzeExcelData(data, instructions)`, llama a Claude y devuelve `{ analysis, charts_config }`
- `src/app/api/excel-flow/upload/route.ts` — POST, parsea Excel, inserta en `reports` (status `pending`), devuelve `reportId`
- `src/app/api/excel-flow/analyze/route.ts` — POST, toma `reportId`, llama a Claude, guarda `analysis`/`charts_config`, status → `ready`
- `src/app/api/excel-flow/report/[id]/route.ts` — **nuevo**: GET, devuelve el reporte usando `supabaseAdmin` (evita problemas de RLS con el cliente anon)
- `src/app/excel-flow/report/[id]/page.tsx` — página mínima: dispara el análisis, hace polling cada 2s contra `/api/excel-flow/report/[id]` (ya no usa el cliente Supabase directo), muestra el resultado en texto plano (sin gráficos todavía)

**Verificación Fase 2**: subido un Excel real desde `/excel-flow`, redirige a `/excel-flow/report/[id]`, el polling muestra "Analizando..." y luego el análisis. Funciona end-to-end. ✅

### Hecho (Fase 3, verificada con build + curl contra dev ✅)
- `src/app/excel-flow/report/[id]/page.tsx` — rediseñada: top bar con brand + badge de estado, header con filename/fecha, análisis renderizado con `react-markdown` (componentes custom, estilo dark), gráficos, skeleton de carga y estado "Analizando" animado
- `src/components/excel-flow/report-charts.tsx` — gráficos Recharts (bar/line/pie/area) desde `charts_config`, estilados dark zinc + paleta emerald/sky/amber
- `src/app/api/excel-flow/export/[id]/route.ts` — GET, genera workbook con `xlsx`: sheet "Datos" (raw_data) + sheet "Análisis" (texto del análisis), descarga como `<nombre>-reporte.xlsx`. Verificado: workbook válido con ambas sheets.
- Botones de acción en la página: "Descargar Excel" (export) y "Enviar a aprobación" (link a `/excel-flow/report/[id]/send`, página pendiente de Fase 4)
- Dependencias nuevas: `react-markdown`, `recharts`
- **Optimización de costos Claude** (`src/lib/excel-flow/claude.ts`): datos como CSV compacto (no JSON pretty-printed), muestra de 100 filas, modelo `claude-haiku-4-5`. Costo estimado ~$0.01-0.02 por análisis (antes ~$0.10-0.25).

### Hecho (sesión 11 jun 2026 — rediseño + exports, verificado con build + curl contra dev ✅)
- **Rediseño completo desde design file** (Upload Page + Report Dashboard de claude.ai/design):
  - `src/app/excel-flow/page.tsx` — portada 2 columnas: hero "Analiza tus datos con IA" + 3 pasos del flujo a la izquierda; panel de carga a la derecha (dropzone 3 estados, textarea con chips, botón con 4 fases animadas mientras sube). Acepta `.csv` además de `.xlsx/.xls`.
  - `src/app/excel-flow/report/[id]/page.tsx` — dashboard real: header sticky (volver + archivo + badge con punto pulsante + metadata + menú **Descargar** con opciones PDF/Excel + Enviar a aprobación), 4 KPI cards con count-up (filas/columnas/gráficos/hallazgos, computadas del reporte), bento de gráficos, análisis colapsable con fade + "Ver análisis completo" (tablas markdown via remark-gfm).
  - `src/components/excel-flow/report-charts.tsx` — bento grid (1: full / 2: 2+1 / 3+: 2+1+full), paleta del logo, donut con leyenda lateral.
- **Export PDF**: `src/lib/excel-flow/pdf-report.tsx` + `src/app/api/excel-flow/export-pdf/[id]/route.ts` — `@react-pdf/renderer` (elegido sobre puppeteer+chromium: JS puro ~2MB vs ~50MB+, serverless-friendly; gráficos re-dibujados con primitivas SVG). Replica el dashboard: marca, badge de estado, hallazgos clave, gráficos bar/line/area/pie, análisis completo, paginado con footer.
- **Export Excel mejorado** (`src/app/api/excel-flow/export/[id]/route.ts`): sheet **"Resumen"** primera (título + hallazgos clave en tabla + una tabla por gráfico con labels/datasets) + "Datos" + "Análisis". Helper compartido `src/lib/excel-flow/report-summary.ts` (parsea markdown → bloques / extrae hallazgos; lo usan Excel y PDF).
- Archivos exportados: `<nombre>-ReportFlowIA.xlsx` / `.pdf`.
- `claude.ts`: prompt en español neutro + pide `subtitle` por gráfico (`ChartConfig.subtitle?` agregado a types).
- Verificado: build ✅, upload page renderiza ✅, PDF válido 4 páginas ✅, Excel con 3 sheets y Resumen correcto ✅ (reporte real `5d185d38…`).

### Hecho (sesión 11 jun 2026 — insights estructurados + refine con IA + gráficos nativos Excel + favicon + animaciones)
- **Hallazgos clave estructurados** (`key_insights`): Claude los devuelve como `{label, value, description}` (ya no se extraen del markdown con regex). `claude.ts` tiene prompt con reglas estrictas anti-trivialidad + `sanitizeInsights()` que descarta "metadata" (filas/columnas/nombre de archivo/etc.). Nueva columna `key_insights jsonb` + migración `0001_add_key_insights.sql`. `persistAnalysis()` (helper nuevo) guarda y degrada con gracia si la migración no se aplicó. `resolveKeyInsights()` en `report-summary.ts` usa el campo estructurado con fallback al parser de markdown.
- **Refine con IA** (`/api/excel-flow/refine/[id]` + `refineReport()` en `claude.ts`): el usuario pide ajustes en lenguaje natural ("agrega gráfico de tendencia", "enfócate en outliers") y Claude reescribe análisis + gráficos + insights (sobreescribe, no acumula). UI: `RefineSection` (colapsable, con sugerencias y Cmd/Ctrl+Enter) en la página del reporte; actualiza el estado sin recargar.
- **Export Excel con gráficos NATIVOS editables**: migró de `xlsx` a `exceljs` para el export + inyección manual de OOXML (`xlsx-native-charts.ts` vía `jszip`) — los gráficos quedan ligados a las celdas, así que se actualizan al editar los datos en Excel. 3 hojas: **Resumen** (hallazgos clave) / **Gráficos** (tabla + gráfico nativo por chart) / **Datos** (raw). Si la inyección falla, devuelve el workbook con datos igual.
- **Fix favicon**: se eliminó `src/app/favicon.ico` (era el **default de create-next-app**, tapaba el logo en la pestaña). Ahora Next genera `<link rel="icon">` desde `src/app/icon.png` (el logo). Ojo: el navegador cachea el favicon — hace falta hard refresh (Ctrl+Shift+R). Pendiente menor: `icon.png` pesa 384 KB (540×540); idealmente un 64px, pero sharp solo tiene binario de Linux instalado.
- **Animaciones de texto en la página de upload** (`excel-flow/page.tsx`): componentes nuevos `Words` (reveal con máscara palabra por palabra, stagger) y `Reveal` (reveal de bloque, para el gradiente "con IA" continuo). Aplicados al titular del hero + stagger individual en los 3 pasos del flujo. Mismo `EASE` cúbico (Linear/Emil Kowalski).
- **Fix bug**: la página del reporte usaba el tipo `Icon` de Phosphor sin importarlo (estaba enmascarado porque los errores de `.next/dev/types` abortaban el chequeo semántico de tsc en Windows). Agregado `import { type Icon }`.
- Verificado: `tsc --noEmit` limpio (ignorando el ruido conocido de `.next/dev/types` por rutas `[id]` en Windows).

### Pendiente

**Fases 1-5: ✅ COMPLETAS** + rediseño "command center" hecho (ver bloque "Hecho 23 jun" arriba). Lo que sigue es Fase 6 (deploy).

**Fase 6 — Deploy + portfolio** (🔄 SIGUIENTE)
- **Deploy en Vercel** (resuelve de paso el `localhost` de los links de aprobación). Setear las env vars en Vercel y `NEXT_PUBLIC_BASE_URL` = URL del deploy.
- `.env.example` documentado.
- **Dominio verificado en Resend** — ver abajo, es lo que destraba "enviar a más correos".
- Agregar el proyecto como card en la landing de AIGILE; preparar un Excel de demo con datos realistas.
- (Menor) Cambiar el modelo a `claude-sonnet-4-6` en `src/lib/excel-flow/claude.ts` para la demo final.
- (Menor, seguridad) Activar "Leaked Password Protection" en el panel de Supabase Auth + **rotar la contraseña del admin** (se compartió por chat).

**⚠️ "Enviar a más correos" (limitación de Resend, NO es bug):** en modo prueba, sin dominio verificado, Resend **solo entrega al correo de la cuenta** (`estebanvillawolk@gmail.com`); a cualquier otro destinatario responde **403** y el correo no sale (las filas de `approvals` y los tokens SÍ se crean). **Fix (1 línea, sin código):** verificar un dominio en resend.com/domains y cambiar `RESEND_FROM_EMAIL` en las env vars a un remitente de ese dominio (ej. `ReportFlow IA <no-reply@tudominio.com>`). Con eso los correos llegan a cualquier aprobador.

**Mejoras opcionales del dashboard (Fase 5+)**: Realtime para refresco en vivo + detalle por aprobador (quién está pendiente). Si se usa el cliente anon desde el browser para Realtime, revisar/crear policies de RLS en `reports`/`approvals`.

## Notas operativas — correos y links de aprobación (Fase 4)

- **Resend en modo prueba**: sin dominio verificado, Resend **SOLO entrega al correo de la cuenta** (`estebanvillawolk@gmail.com`); a cualquier otro responde **403** y el correo no sale (las filas de `approvals` y los tokens se crean igual). Para producción: verificar un dominio en resend.com/domains y cambiar `RESEND_FROM_EMAIL` (1 línea en `.env.local`), sin tocar código.
- **Link de aprobación con `localhost`**: `NEXT_PUBLIC_BASE_URL=http://localhost:3000`, así que los links `/approve/[token]` **solo abren en la PC del dev server**. En celular u otro equipo dan "no se pudo conectar" (localhost = el propio dispositivo). Para demo en cualquier dispositivo: levantar un túnel (`cloudflared tunnel --url http://localhost:3000` o `ngrok http 3000`) y poner esa URL pública en `NEXT_PUBLIC_BASE_URL` (reiniciar el dev server). Para producción real: desplegar (ej. Vercel) y usar la URL del deploy.

## Notas / reglas importantes

- El usuario prefiere que se le **pregunte antes de cualquier acción de git push / GitHub**
- Dev server: usar `pnpm dev` (el proyecto migró de npm a pnpm). Si dice que el puerto 3000 está ocupado, probablemente ya hay un servidor corriendo en otra terminal — usar ese.
- Diseño: seguir skill `design-taste-frontend` (estilo Linear / Emil Kowalski), paleta zinc + acento emerald, fuente Geist, iconos Phosphor, animaciones con Motion.
- Iconos Phosphor: ojo con nombres que no existen (ej. `ArrowUpTray` no existe, es `TrayArrowUp`). Verificar contra `node_modules/@phosphor-icons/react/dist/index.es.js` si da error de export.
- pnpm: si `pnpm dev`/`pnpm install` falla con `ERR_PNPM_IGNORED_BUILDS`, revisar `pnpm-workspace.yaml` → `allowBuilds` (debe tener `sharp: true` y `unrs-resolver: true`). Si pnpm avisa que movió paquetes "instalados por otro package manager", correr `pnpm install --force` (no debería volver a pasar, pero por las dudas).

## MCP de Supabase

- Quedó un `.mcp.json` (scope proyecto) apuntando al MCP HTTP de Supabase: `https://mcp.supabase.com/mcp?project_ref=kgbfqcperpskzgarsxvb`.
- **Se activa al reiniciar Claude Code** (las herramientas MCP se cargan al iniciar la sesión) y pedirá un login OAuth de Supabase la primera vez. A partir de ahí, las migraciones se pueden aplicar con las tools del MCP sin PAT ni scripts.

## Estado al cierre de la sesión de auth (jun 2026)

**Hecho y verificado:** todo el sistema de auth (login, roles, proxy de protección, logout, migración aplicada, admin creado) — ver secciones "Autenticación y seguridad" y "Hecho (sesión auth…)".

**Cómo probar el login (para la próxima sesión):**
1. `pnpm dev` → abrir http://localhost:3000/excel-flow → debe redirigir a `/login`.
2. Entrar con `estebanvillawolk@gmail.com` (la contraseña se entregó por chat; cambiarla tras el primer login). Debe entrar normal a `/excel-flow`.
3. Re-verificación automática: `node scripts/verify-auth.mjs estebanvillawolk@gmail.com '<password>'` y `node scripts/verify-nonadmin.mjs`.

**Pendiente (en orden sugerido):**
- **Fase 6 — Pulido + portfolio + deploy** (siguiente): ver bloque "Fase 6" arriba. Incluye deploy en Vercel (resuelve el `localhost` de los links) y dominio verificado en Resend (lo comprará el usuario después).
- **Habilitar cuentas `user`** a futuro: ver "Qué falta para habilitar cuentas 'user'" en la sección de auth.
- (Menor) Cambiar el modelo Claude a `claude-sonnet-4-6` para la demo final.

## Último commit

`feat: autenticación con Supabase Auth + roles + protección de rutas (proxy)` — sesión de auth jun 2026 (login, profiles+RLS+trigger, proxy, logout, admin creado, verificación end-to-end).

> Commiteado en `master`. **No se hizo push** (pendiente confirmación del usuario para push a GitHub).
