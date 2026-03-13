# GÜERJAUS TBT — Contexto del Proyecto

> **Última actualización**: sesión Claude Code — marzo 2026
> Este fichero se mantiene actualizado con cada cambio de alcance significativo.

## Qué es esto

App web de dinámica de teambuilding para el equipo de almacén de **FactorLibre** (~14 personas, perfiles funcionales/consultores + técnicos/devs). El objetivo es mejorar comunicación y coordinación entre ambos perfiles. Nombre oficial de la marca: **GÜERJAUS TBT** — *El 'Throwback Thursday' de Almacén*.

Desarrollada con Claude (claude.ai) y continuada con Claude Code.

---

## Stack técnico

- **Backend**: Node.js + Express + WebSockets (`ws`)
- **Frontend**: HTML/CSS/JS vanilla en un único archivo (`public/index.html`)
- **Persistencia**: `data.json` — todo el estado se guarda en disco tras cada cambio relevante
- **Sin build step**: se ejecuta directamente con `node server.js`
- **Puerto**: 3000 por defecto, configurable con `PORT=xxxx`

### Arrancar el servidor
```bash
npm install       # solo la primera vez
node server.js    # arrancar
```

### Estructura de ficheros
```
almacen-app/
├── server.js             # Toda la lógica de backend + WebSocket
├── public/
│   └── index.html        # Toda la UI (HTML + CSS + JS en un único fichero)
├── data.json             # Persistencia en disco (auto-generado)
├── casos_template.json   # Plantilla de importación de casos (5 casos de prueba incluidos)
├── package.json
└── CONTEXT.md            # Este fichero
```

### Persistencia en Railway (producción)

El filesystem de Railway es efímero. Para que `data.json` sobreviva a redeploys:

1. Crear un **Railway Volume** montado en `/data`
2. Añadir variable de entorno `DATA_DIR=/data`
3. El servidor usa: `const DATA_FILE = path.join(process.env.DATA_DIR || __dirname, 'data.json')`
4. Al arrancar imprime: `[PERSISTENCIA] DATA_DIR=... → DATA_FILE=...`

---

## Credenciales reales (admins)

| Nombre | Email | Contraseña |
|--------|-------|-----------|
| Lucas Andreu | lucas.andreu@factorlibre.com | lucas12345 |
| Adriana Saiz | adriana.saiz@factorlibre.com | adriana12345 |
| Álvaro Gómez | alvaro.gomez@factorlibre.com | alvaro12345 |

Los equipos se crean desde el panel de admin (pestaña Usuarios → sub-pestaña Equipos).

---

## Modelo de usuarios

### `users.people[]` — personas individuales
```js
{ id, name, email, password, role: 'admin'|'user', createdAt }
```
Cada persona tiene sus propias credenciales. Una persona puede ser admin o miembro de equipo.

### `users.teams[]` — equipos compuestos de personas
```js
{ id, teamName, memberIds: [personId, ...], color: '#hex', createdAt }
```
- Una persona solo puede pertenecer a **un equipo**
- `color`: color de acento del equipo, seleccionable en la ficha de creación/edición (paleta de 8 colores). Se aplica como variable CSS `--accent` en la vista del equipo

---

## Roles y acceso

### Admin
- Login: email + contraseña (sin código de sala)
- Panel completo: **6 pestañas** — Sesiones, Casos, Control, Usuarios, Config, Log
- Botón **← Salir** en la parte inferior del sidebar para cerrar sesión

### Equipo (user)
- Login: email + contraseña + **código de sesión** (dropdown con sesiones activas)
- Si no hay sesión activa → ve pantalla de espera (`WAITING`), entra automáticamente cuando el admin inicia la dinámica
- Cualquier miembro del equipo puede hacer login; todos van a la misma vista de equipo
- Solo puede haber **un dispositivo activo por equipo** durante una sesión RUNNING
- Botón **← Salir** visible en el header de todas las sub-vistas de equipo

### Proyector
- Login: solo **código de sesión** (dropdown), sin credenciales
- Si no hay sesión activa → espera y entra automáticamente
- **Obligatorio** que esté conectado para poder iniciar la dinámica
- Botón **← Salir** en el header de todas las pantallas del proyector

---

## Arquitectura de la app

### Vistas (`public/index.html`, renderizado por JS vanilla)
- `HOME` — pantalla de acceso con selector de sesión para equipos y proyector
- `WAITING` — pantalla de espera cuando no hay sesión activa (botón "← Volver al inicio")
- `ADMIN` — panel de gestión (6 pestañas)
- `TEAM` — vista de equipo (móvil/tablet)
- `PROJECTOR` — vista proyector (pantalla grande)

### Temas visuales por vista
Aplicados cambiando la variable CSS `--accent` en `:root` al hacer `render()`:
- **Admin**: naranja `#f5a623` (por defecto)
- **Proyector**: azul `#3b82f6`
- **Equipo**: color elegido por el admin al crear el equipo (de una paleta de 8 colores)

### Leaderboard — resaltado de equipo
- En **vistas de equipo**: solo la fila del propio equipo resaltada con `border-color: var(--accent)` y fondo `rgba(r,g,b,0.12)` calculado desde el hex del equipo
- Borde dorado `pos-1` (primer puesto) solo aparece en vistas de **admin/proyector**, nunca en la vista de equipo
- CSS variable `--my-team-bg` calculada dinámicamente en `render()` desde el hex del color del equipo

### Estado global del frontend
Todo el estado vive en el objeto `S` en `index.html`. Sin framework, re-renders manuales con `render()` + funciones de actualización parcial (`updateTimerUI`, `refreshLeaderboards`, `syncPauseBtn`, `refreshDisconnectBanner`).

Campos relevantes de `S`:
```js
{ view, ws, session, team, admin, role, roomCode,
  timerRemaining, timerEnd, paused,
  adminTab, adminSubTab, editingCase,
  leaderboard, lastResults,
  answered, selectedAnswer, skipDone, skippedByTeam, answeredCount,
  users, allSessions, awaitingReconnect,
  waitingMsg, teamColor,
  loginError        // mensaje de error persistente en el formulario de login
}
```

`session` (dentro de `S`) incluye `projectorConnected: boolean` para saber si el proyector está conectado.

### Función `logout()`
1. Envía mensaje WS `LOGOUT` al servidor (notificación explícita antes de cerrar)
2. Cierra el WebSocket
3. Borra credentials (`sessionStorage`) y estado (`localStorage`)
4. Resetea `S` y vuelve a HOME
Disponible en todas las vistas.

### Persistencia de sesión del usuario
- **`sessionStorage`**: credenciales `{email, pass, room}` — se borran al cerrar la pestaña
- **`localStorage`**: snapshot del estado `S` — permite restaurar la UI al refrescar
- **Reconexión automática**: backoff exponencial (1s → 30s máx) con overlay visual
- **Heartbeat PING/PONG**: cada 25s para mantener la conexión viva ante proxies con idle timeout

### Detección de cierre/desconexión del navegador
Sistema de tres capas para detectar desconexiones incluyendo cierre de pestaña/navegador:

1. **`beforeunload`**: muestra diálogo de confirmación al usuario si hay sesión RUNNING
2. **`pagehide` + `navigator.sendBeacon('/api/beacon-disconnect')`**: notificación HTTP inmediata al cerrar/navegar (solo si `!e.persisted`)
3. **WebSocket heartbeat** (`ws.ping()` / `pong` + `ws._isAlive`): el servidor marca clientes muertos y los termina cada 30s como fallback

El endpoint `/api/beacon-disconnect` maneja dos casos:
- **Caso A**: WS aún vivo → lo termina con `_closeReason='beacon'`, `ws.on('close')` procesa el resto
- **Caso B**: WS ya cerrado → actualiza sesión directamente (pausa timer, añade a `awaitingReconnect`)

### Panel de control — botón "matar conexión" (✕)
El admin puede forzar la desconexión de cualquier cliente desde la pestaña Control:
- Aparece un botón **✕** junto a cada cliente activo (equipo o proyector)
- Envía `ADMIN_KICK_CLIENT` al servidor → termina ese WS con `_closeReason='admin_kick'`
- `ws.on('close')` procesa la desconexión normalmente (pausa timer si procede)

### REST endpoints
- `GET /api/health` — healthcheck
- `GET /api/sessions/public` — sesiones no finalizadas `[{roomCode, status}]` (para el dropdown de login)
- `POST /api/beacon-disconnect` — notificación HTTP de cierre de pestaña (sendBeacon)

---

## Flujo completo de una sesión

### Antes de empezar
1. Admin crea **personas** (pestaña Usuarios → Personas) con email + contraseña
2. Admin crea **equipos** (pestaña Usuarios → Equipos) asignando personas y eligiendo color
3. Admin crea una **sesión** (pestaña Sesiones → Nueva sesión) → obtiene código de sala
4. Admin añade casos (pestaña Casos → importar JSON o crear manualmente)
5. Equipos acceden con email/pass + código de sala → entran al lobby
6. Proyector accede con código de sala → muestra pantalla de espera con equipos conectados
7. Admin verifica que el proyector esté conectado (punto verde en Control)
8. Admin pulsa **Iniciar dinámica** → todos entran automáticamente
   - **El proyector debe estar conectado** — el botón está deshabilitado si no lo está

### Durante la dinámica (por cada caso)
```
STAGE_1 (timer+5s) → STAGE_1_DEBATE (timer) →
STAGE_2 (timer) → STAGE_2_DEBATE (timer, BOTÓN ADELANTAR) →
STAGE_3 (timer) → STAGE_3_DEBATE (timer) →
STAGE_4 (quiz, 2 min fijos) →
RESULTS (timer) → [siguiente caso o FIN]
```

> **Nota sobre STAGE_1**: al inicio de cada caso, equipos y proyector ven una cuenta atrás de 5 segundos antes de mostrar el contenido. El timer del servidor arranca con +5 segundos extra para que al terminar el overlay quede el tiempo completo configurado.

### Contenido por etapa
| Etapa | Qué ve el proyector / equipos |
|-------|-------------------------------|
| STAGE_1 | Contexto inicial breve (insuficiente para resolver) |
| STAGE_1_DEBATE | Mismo contexto + aviso de debate interno |
| STAGE_2 | Contexto inicial + contexto ampliado (~70% info) |
| STAGE_2_DEBATE | Todo lo anterior + **botón de adelantar** visible en equipos |
| STAGE_3 | Todo el contexto + pista clave sutil |
| STAGE_3_DEBATE | Mismo que STAGE_3 + aviso debate final |
| STAGE_4 | Las 4 opciones de respuesta (quiz), timer 2 min |
| RESULTS | Respuesta correcta + puntos ganados/perdidos por equipo |

---

## Mecánica del botón "Adelantar"

- Aparece **solo** durante `STAGE_2_DEBATE`
- El **primer equipo** en pulsarlo salta directamente a `STAGE_4` (todos los equipos van)
- Si adelanta y **acierta**: `+30%` sobre los puntos base del caso
- Si adelanta y **falla**: `-50%` de los puntos base del caso
- Una vez comienza `STAGE_3` ya no se puede adelantar

---

## Sistema de puntuación

- Cada caso tiene **puntos base** configurables (defecto: 100)
- Respuesta correcta sin adelantar → puntos base
- Adelantar + acertar → puntos base × 1.3
- Adelantar + fallar → puntos base × -0.5
- No responder → 0 pts
- Clasificación visible en tiempo real en todas las vistas

> **Importante — indexación de respuestas**: `correctAnswerIndex` es **0-based** (A=0, B=1, C=2, D=3). Si el JSON tiene `"correctAnswerIndex": 1`, la respuesta correcta es la **B**, no la A. El editor de casos muestra las letras A/B/C/D junto a cada opción para evitar confusiones. La lista de casos también muestra `Correcta: B` directamente.

---

## Timers — valores por defecto configurables

| Etapa | Defecto |
|-------|---------|
| STAGE_1 | 60 seg (el servidor añade 5s extra por la cuenta atrás, el equipo ve 60s al terminarla) |
| STAGE_1_DEBATE | 120 seg |
| STAGE_2 | 90 seg |
| STAGE_2_DEBATE | 300 seg |
| STAGE_3 | 60 seg |
| STAGE_3_DEBATE | 180 seg |
| STAGE_4 | 120 seg (fijo, no configurable) |
| RESULTS | 20 seg |

El admin puede **pausar/reanudar** el timer desde el panel de Control.

### Comportamiento ante desconexiones y reinicios
- Si un cliente de `requiredParticipants` se desconecta durante la dinámica → **timer se pausa automáticamente** (`pausedByDisconnect = true`)
- `requiredParticipants`: snapshot de quién estaba conectado en el momento de pulsar "Iniciar dinámica" (admin + proyector + equipos que entraron al lobby). Los que se conecten después no bloquean.
- Al reconectarse → `awaitingReconnect` se vacía; si queda vacío y el timer estaba pausado por desconexión, se reanuda automáticamente
- El admin puede forzar la reanudación aunque haya desconectados (`ADMIN_TOGGLE_PAUSE`)
- Si el **servidor se reinicia** y el timer había expirado → sesión queda **PAUSADA** (no auto-avanza); admin decide saltar o reanudar
- Si el servidor se reinicia y quedaba tiempo → el timer se reanuda con los segundos restantes
- El servidor tiene `uncaughtException` y `unhandledRejection` handlers: los errores no matan el proceso, se loguean por consola

---

## Gestión de sesiones

- Solo puede haber **una sesión en estado RUNNING** a la vez
- El admin puede **terminar cualquier sesión** (botón 🗑 Terminar en pestaña Sesiones) — previa confirmación
- Al terminar una sesión: todos los participantes vuelven a HOME; el estado del frontend (leaderboard, respuestas, puntuación) se limpia completamente
- Al crear una nueva sesión o al hacer login de equipo: el estado de sesión anterior se limpia en el cliente
- Las sesiones FINISHED permanecen en `data.json` hasta que se eliminen

---

## Importación de casos en JSON

Los casos se importan en bloque desde **Casos → 📥 Importar JSON**.

Formato (`casos_template.json` como plantilla):
```json
{
  "cases": [
    {
      "title": "Título del caso",
      "points": 100,
      "stage1": "Contexto inicial (breve)",
      "stage2": "Contexto ampliado (~70% info)",
      "stage3": "Pista clave sutil",
      "answers": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctAnswerIndex": 1
    }
  ]
}
```

`correctAnswerIndex` es 0-based: 0=A, 1=B, 2=C, 3=D.

---

## Event Log (pestaña 🪵 Log)

Cada sesión mantiene un log de hasta 500 eventos guardados en `data.json`. Visible en la pestaña **Log** del panel admin (orden cronológico inverso, coloreado por tipo).

| Evento | Qué muestra |
|--------|-------------|
| `SESSION_STARTED` | Inicio de dinámica (nº equipos y casos) |
| `SESSION_PARTICIPANTS_SNAPSHOT` | Lista de participantes capturados como `requiredParticipants` al iniciar |
| `STAGE_CHANGE` | Transición de etapa |
| `TEAM_SKIP` | Equipo que adelantó |
| `TEAM_ANSWER` | Equipo · letra elegida · texto · ✓/✗ · respuesta correcta |
| `CASE_RESOLVED` | `[Correcta: B]` · resultados de todos los equipos con letra y puntos |
| `NEXT_CASE` | Avance al siguiente caso |
| `SESSION_FINISHED` | Fin de dinámica con clasificación final |
| `TIMER_PAUSED` | Segundos restantes, si fue por desconexión |
| `TIMER_RESUMED` | Segundos restantes |
| `CLIENT_CONNECTED` | Nombre, rol y etapa actual |
| `CLIENT_DISCONNECTED` | Nombre, rol, etapa y motivo (`ws_close` / `beacon` / `beacon_fallback` / `logout` / `admin_kick` / `replaced`) |
| `SERVER_RESTART` | Acción tomada: timer expirado pausado / timer reanudado |

---

## Estructura de datos (server.js)

```js
// Persona
{ id, name, email, password, role: 'admin'|'user', createdAt }

// Equipo
{ id, teamName, memberIds: [personId, ...], color: '#hex', createdAt }

// Sesión (memory + data.json)
{
  roomCode,               // código de 6 caracteres
  status,                 // 'LOBBY' | 'RUNNING' | 'FINISHED'
  cases[],                // array de casos
  teams[],                // [{ id, teamName, score, history[], connected }]
  answers,                // { teamId: { answerIndex, timestamp } }
  config,                 // tiempos por etapa
  currentCaseIndex,
  currentStage,           // 'LOBBY' | 'STAGE_1' | ... | 'RESULTS' | 'FINISHED'
  skipTeamId,             // equipo que adelantó (null si nadie)
  skipAvailable,          // si el botón adelantar está activo
  timer,                  // setInterval (no se guarda en JSON)
  timerEnd,               // timestamp de expiración
  paused,                 // boolean
  pausedRemaining,        // segundos restantes al pausar
  pausedByDisconnect,     // boolean — distingue pausa automática de manual (no se guarda)
  lastResults,            // resultados del último caso
  eventLog[],             // log de hasta 500 eventos (guardado en data.json)
  awaitingReconnect,      // Set de claves pendientes de reconexión (no se guarda en JSON)
  requiredParticipants,   // Set de claves snapshot al iniciar (se guarda como array en JSON)
  projectorConnected,     // boolean — true si el proyector está conectado
  createdAt
}

// Caso
{ id, title, points, stage1, stage2, stage3,
  answers[4],           // índices 0-3 = letras A-D
  correctAnswerIndex,   // 0-based
  moraleja              // lección del caso — no se muestra en el frontend durante la dinámica
}
```

### Claves de desconexión (`disconnectKey`)
```js
// Función que genera claves únicas por cliente:
disconnectKey('team', teamId, personId)    // → 'team:${teamId}'
disconnectKey('admin', null, personId)    // → 'admin:${personId}'
disconnectKey('projector', null, null)    // → 'projector'
```

### Flags internos en objetos WS
| Flag | Propósito |
|------|-----------|
| `ws._isAlive` | Heartbeat: false si no respondió al último ping, true al recibir pong |
| `ws._logoutProcessed` | Evita doble-procesado en `ws.on('close')` tras `LOGOUT` explícito |
| `ws._closeReason` | Motivo de cierre: `'beacon'` / `'admin_kick'` / `'replaced'` / `'ws_close'` |

---

## Mensajes WebSocket (cliente → servidor)

| Tipo | Quién | Descripción |
|------|-------|-------------|
| `UNIFIED_LOGIN` | Admin / Equipo | Login con `{email, password, roomCode?}` |
| `PROJECTOR_JOIN` | Proyector | Unirse con `{roomCode}` |
| `ADMIN_JOIN_SESSION` | Admin | Conectarse a sesión existente |
| `ADMIN_CREATE_SESSION` | Admin | Nueva sesión |
| `ADMIN_KILL_SESSION` | Admin | Terminar sesión |
| `ADMIN_CREATE_PERSON` | Admin | Crear persona |
| `ADMIN_UPDATE_PERSON` | Admin | Editar persona |
| `ADMIN_DELETE_PERSON` | Admin | Eliminar persona |
| `ADMIN_CREATE_TEAM` | Admin | Crear equipo (incluye `color`) |
| `ADMIN_UPDATE_TEAM` | Admin | Editar equipo (incluye `color`) |
| `ADMIN_DELETE_TEAM` | Admin | Eliminar equipo |
| `ADMIN_SAVE_CASE` | Admin | Crear o editar caso |
| `ADMIN_DELETE_CASE` | Admin | Eliminar caso |
| `ADMIN_IMPORT_CASES` | Admin | Importar array de casos |
| `ADMIN_UPDATE_CONFIG` | Admin | Cambiar tiempos de etapa |
| `ADMIN_START_SESSION` | Admin | Iniciar dinámica (requiere proyector conectado) |
| `ADMIN_FORCE_STAGE` | Admin | Saltar a etapa manualmente |
| `ADMIN_NEXT_CASE` | Admin | Avanzar al siguiente caso |
| `ADMIN_TOGGLE_PAUSE` | Admin | Pausar/reanudar timer |
| `ADMIN_KICK_CLIENT` | Admin | Forzar desconexión de un cliente `{role, teamId}` |
| `LOGOUT` | Cualquiera | Notificación explícita de cierre de sesión (antes de cerrar WS) |
| `TEAM_SKIP` | Equipo | Adelantar a STAGE_4 |
| `TEAM_ANSWER` | Equipo | Enviar respuesta del quiz |
| `PING` | Cualquiera | Heartbeat (responde PONG) |
| `GET_STATE` | Cualquiera | Solicitar estado actual |

## Mensajes WebSocket (servidor → cliente)

| Tipo | Descripción |
|------|-------------|
| `ADMIN_LOGIN_OK` | Auth OK + sesiones + usuarios |
| `TEAM_LOGIN_OK` | Auth OK + datos equipo + sesión (incluye `answers` para restaurar estado respondido) |
| `PROJECTOR_JOIN_OK` | OK + estado de la sesión |
| `PONG` | Respuesta al heartbeat |
| `AUTH_ERROR` | Error de autenticación (mostrado como toast + div persistente en el formulario) |
| `LOGOUT_OK` | Confirmación de logout procesado |
| `WAITING` | No hay sesión activa |
| `SESSION_AVAILABLE` | Sesión disponible → auto-retry |
| `SESSION_CREATED` | Nueva sesión creada |
| `SESSION_STATE` | Estado completo de sesión |
| `SESSION_STARTED` | Dinámica iniciada |
| `SESSION_FINISHED` | Fin + clasificación |
| `SESSION_KILLED` | Sesión terminada |
| `SESSIONS_UPDATED` | Lista de sesiones actualizada |
| `STAGE_CHANGE` | Cambio de etapa + sesión |
| `TIMER_TICK` | Tick cada 500ms |
| `TIMER_PAUSED` / `TIMER_RESUMED` | Estado del timer |
| `TEAMS_UPDATED` | Equipos + clasificación + `projectorConnected` |
| `TEAM_SKIPPED` | Equipo que adelantó |
| `TEAM_ANSWERED` | Progreso de respuestas |
| `CASE_RESULTS` | Resultados + clasificación + eventLog |
| `CLIENT_DISCONNECTED` / `CLIENT_RECONNECTED` | Gestión reconexión (incluye `awaitingReconnect[]`) |
| `USERS_UPDATED` | Personas y equipos |
| `CASES_UPDATED` | Casos (con importResult si viene de importación) |
| `CONFIG_UPDATED` | Tiempos actualizados |
| `STATE_SYNC` | Sincronización completa |
| `ERROR` | Error con mensaje |

---

## Diseño visual

- **Tema**: oscuro (dark mode), paleta industrial/warehouse
- **Fuentes**: `Syne` (principal) + `Space Mono` (monoespaciado)
- **Colores base**: fondo `#0a0e1a`, surface `#111827`, verde `#22c55e`, azul `#3b82f6`, morado `#8b5cf6`
- **Acento (`--accent`)**: naranja `#f5a623` (admin/default) · azul `#3b82f6` (proyector) · color del equipo (team)
- Sin frameworks CSS — todo CSS custom con variables

---

## Equipos para la sesión real

| Equipo | Integrantes |
|--------|------------|
| 🔴 Error 404: Mercancía Not Found | Adrian Cifuentes (Dev), Adriana Saiz (Dev), Javier Sánchez (Fun), Fabio García (Fun), Jesús Sánchez (Fun) |
| 🤠 El Picking de los Hermanos Dalton | Oscar Indias (Dev), Álvaro Gómez (Dev), Luis Novalio (Fun), Sabrina Iborra (Fun) |
| 📦 FIFO Pero a Nuestra Manera | Sergio Bustamante (Dev), Nacho Morales (Fun), Lucas Andreu (Fun), Daniel Cagigas (Fun), Nuria Delgado (Fun) |

Moderador: pendiente decidir (candidatos: Adriana Saiz / Álvaro Gómez / Lucas Andreu).

---

## Los 10 casos del evento (`almacen_en_crisis.docx`)

No están precargados — se importan desde JSON. Los recomendados para la sesión: **01, 07 y 09**.

| # | Título | Dificultad |
|---|--------|-----------|
| 01 | La Mercancía Fantasma | ⭐⭐ |
| 02 | El Camión que No Existía | ⭐⭐⭐ |
| 03 | Operación Devolución Infinita | ⭐⭐ |
| 04 | Cadena de Frío Rota | ⭐⭐⭐⭐ |
| 05 | El Pedido Duplicado | ⭐⭐ |
| 06 | El Etiquetado Maldito | ⭐⭐ |
| 07 | El Cuello de Botella Invisible | ⭐⭐⭐ |
| 08 | El Acceso No Autorizado | ⭐⭐⭐⭐ |
| 09 | El Proveedor que Desaparece | ⭐⭐⭐ |
| 10 | La Reubicación que Nadie Planificó | ⭐⭐ |

`casos_template.json` tiene 5 casos genéricos de prueba para validar la importación.

---

## Pendiente / ideas anotadas

- [ ] **Exportar resultados** al final (CSV o pantalla de resumen imprimible)
- [ ] **Preparar casos reales** en JSON para el evento (pasar los 10 casos de `almacen_en_crisis.docx` a formato JSON)
- [ ] **Decidir moderador** para la sesión real
- [ ] Asignar casos específicos a cada equipo (actualmente todos ven los mismos)

---

## Convenciones de código

- Frontend JS vanilla, todo en `public/index.html`; estado global en objeto `S`
- Renders parciales: `updateTimerUI()`, `refreshLeaderboards()`, `syncPauseBtn()`, `refreshDisconnectBanner()`
- Elementos en tiempo real localizados con `data-lb`, `data-answer-bar` (sin IDs fijos)
- Routing WebSocket: `switch` manual sobre `msg.type` en server.js
- Contraseñas en texto plano (sin hash) — aceptable para evento interno único
- `_publicSessions`: caché global en frontend para el dropdown de login, actualizada con `fetchPublicSessions()`
- `PING` se envía cada 25s desde cliente (si hay role activo) para mantener la conexión viva ante idle timeouts de proxy
- `TEAMS_UPDATED` siempre incluye `projectorConnected` y dispara `render()` en el admin (para actualizar botones y puntos de presencia en tiempo real)
- Al recibir `TEAM_LOGIN_OK`, se restaura `S.answered` y `S.selectedAnswer` desde `session.answers[teamId]` para evitar doble-respuesta tras reconexión
