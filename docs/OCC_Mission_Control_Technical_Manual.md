# OCC Mission Control Technical Manual

**Product:** OCC Mission Control (OpenClaw Command Center)  
**Repo:** `projects/mission-control/`  
**Audience:** internal engineering and operations  
**Status:** verified against the current codebase on 2026-04-02

---

## 1. Purpose and Scope

OCC Mission Control is an **Electron + React desktop operator console** for OpenClaw. It is a local desktop UI that connects directly to an OpenClaw Gateway over WebSocket, renders session and crew state, provides a native chat surface, and optionally polls a local sidecar for host metrics.

This manual describes the implementation that exists in this repository today. It does **not** describe intended architecture, legacy assumptions, or planned work unless explicitly labeled as such.

### Covered here
- Renderer, Electron main, gateway client, and metrics sidecar topology
- Store responsibilities and boundaries
- Session-to-crew attribution rules
- Chat session switcher behavior and data flow
- Security properties and limitations
- Packaging, ports, and troubleshooting

### Out of scope
- OpenClaw Gateway internals beyond the RPC and event surface OCC consumes
- Future roadmap items
- Historical proxy-based architecture, except where needed to explain leftovers

---

## 2. Runtime Topology

```text
┌──────────────────────────────────────────────────────┐
│ Electron main (`electron/main.mjs`)                 │
│ - creates BrowserWindow                             │
│ - exposes preload bridge                            │
│ - stores settings.json in Electron userData         │
│ - spawns legacy proxy stub and metrics sidecar      │
│ - manages tray and app IPC                          │
└───────────────────────┬──────────────────────────────┘
                        │
                        v
┌──────────────────────────────────────────────────────┐
│ Renderer (`src/`)                                   │
│ - React UI                                          │
│ - Zustand stores                                    │
│ - native gateway WebSocket client                   │
│ - chat/session/tool/system state                    │
└───────────────┬──────────────────────────────────────┘
                │ WebSocket RPC + events
                v
┌──────────────────────────────────────────────────────┐
│ OpenClaw Gateway                                    │
│ default: ws://127.0.0.1:18789                       │
│ - `connect`, `health`, `status` RPC                 │
│ - `sessions.subscribe`, `sessions.list` RPC         │
│ - `chat.history`, `chat.send`, `chat.abort` RPC     │
│ - `sessions.changed`, `chat`, `agent`, `ready`      │
└──────────────────────────────────────────────────────┘

Optional, separate HTTP sidecar:

┌──────────────────────────────────────────────────────┐
│ system-metrics-server (`/system-metrics-server/`)   │
│ default: http://127.0.0.1:18790                     │
│ fallback ports: 18791-18793                         │
│ - `/api/system/metrics`                             │
│ - `/api/system/platform`                            │
│ - `/spawn-intent`, `/spawn-confirm`, `/spawn-status`│
│ - `/health`                                         │
└──────────────────────────────────────────────────────┘
```

### What is actually true in Phase 7
Phase 7 removed the old functional proxy server. The file `proxy-server.mjs` remains in the repo, but it is only a **removal stub** that logs an error and exits immediately.

The real backend integration path is now:
- **renderer ↔ gateway directly over WebSocket**
- **renderer ↔ metrics sidecar over HTTP** for host metrics and spawn bridge polling

There is still legacy scaffolding in Electron main for spawning a “proxy” process and waiting on `proxyBaseUrl`, but that process is not real anymore. Treat all proxy behavior as dead legacy code, not part of the working architecture.

---

## 3. Technology Stack

Verified from `package.json`:
- React 19
- TypeScript 5.9
- Vite 8
- Zustand 5
- Electron 37
- electron-builder 26
- Tailwind 4
- Recharts 3

### Build and package facts
Electron Builder packages:
- `dist/**/*`
- `electron/**/*`
- `package.json`

Extra packaged resource:
- `../../system-metrics-server` → `Resources/system-metrics-server`

Outputs:
- macOS DMG
- Windows NSIS
- Linux AppImage / deb / rpm

---

## 4. Electron Main Process

**File:** `projects/mission-control/electron/main.mjs`

### Responsibilities
Electron main is responsible for:
- creating the BrowserWindow
- creating the tray icon and tray menu
- loading and saving runtime settings
- exposing IPC handlers used by the preload bridge
- spawning sidecar processes
- hiding the window to tray on close unless quitting

### BrowserWindow security posture
The BrowserWindow is created with:
- `contextIsolation: true`
- `nodeIntegration: false`
- preload script: `electron/preload.mjs`

That is the correct baseline. Renderer code does not get direct Node.js access.

### Preload bridge surface
**File:** `electron/preload.mjs`

The preload script exposes `window.missionControl` with:
- `isElectron`
- `getSettings()`
- `saveSettings(settings)`
- `onSettingsChanged(callback)`
- `confirmAction(options)`
- `showNotice(options)`
- `reloadWindow()`

This is the only documented renderer bridge to Electron main in the current code.

### Settings storage
Settings are stored at:
- `app.getPath('userData')/settings.json`

Default keys in Electron main:
- `gatewayHost`
- `gatewayPort`
- `gatewayProtocol`
- `proxyBaseUrl`
- `metricsBaseUrl`
- `gatewayToken`

Renderer config also supports:
- `gatewayPassword`
- `gatewayDeviceToken`
- `deviceIdentity`

Important nuance: Electron main’s `defaultSettings` only seeds `gatewayToken`; renderer config knows about `gatewayPassword` and `gatewayDeviceToken`. Those values can still persist if saved through the renderer, but they are not declared in Electron main’s defaults.

### Sidecars Electron main spawns
Electron main attempts to spawn:
1. `proxy-server.mjs` — legacy stub, exits immediately
2. `system-metrics-server/server.mjs` — real sidecar

For packaged builds, the metrics sidecar path resolves from app resources. For development, Electron main resolves it to:
- `/Users/maccagey/.openclaw/workspace/system-metrics-server/server.mjs`

### Metrics port handoff
The metrics sidecar may bind to 18790, 18791, 18792, or 18793. When it starts, it prints a JSON message of the form:

```json
{"type":"metrics-ready","port":18790}
```

Electron main parses that message and rewrites `settings.json` so `metricsBaseUrl` points at the actual chosen port.

### Legacy proxy wait path
In packaged mode, Electron main still calls `waitForProxyReady()` against `${proxyBaseUrl}/api/health` before launching the renderer. Because the proxy script is a removal stub, this readiness check will normally time out and log a warning. The app still launches.

That behavior is legacy dead weight, not an active dependency.

---

## 5. Renderer Startup Sequence

**File:** `src/App.tsx`

On mount, the renderer does the following:
1. loads `crew-config.json`
2. wires crew-config runtime reload on focus / visibility change
3. initializes `sessionsStore`
4. starts spawn registry bridge polling
5. initializes `chatStore`

On unmount, it:
- disconnects chat
- stops spawn registry bridge polling

### Important implementation detail
`startSpawnRegistryBridgePolling()` is called in `App.tsx`, and there is also bootstrap logic in `gateway.ts` that can start it if `updateStatus()` runs. The bridge has an internal guard and will not double-start, but the architecture is slightly redundant.

---

## 6. Native Gateway Client

**Directory:** `src/core/gatewayClient/`

### Files
- `bootstrap.ts` — builds connection/auth config
- `gatewayClient.ts` — WebSocket client, RPC, reconnect, event dispatch
- `events.ts` — typed event bus
- `types.ts` — transport and payload types
- `index.ts` — exports

### What the client does
The native gateway client:
- resolves the gateway WebSocket URL from settings
- opens a WebSocket directly to the gateway
- authenticates with `connect`
- optionally waits for a `connect.challenge` event or calls `connect.challenge` RPC as fallback
- signs the challenge via `signGatewayChallenge()` when a nonce exists
- dispatches RPC responses and gateway events to store consumers
- reconnects with exponential backoff and jitter
- detects event sequence gaps

### Protocol and auth facts
Bootstrap currently sends:
- protocol min/max: `3`
- role: `operator`
- scopes:
  - `operator.read`
  - `operator.write`
  - `control.read`
  - `control.write`
- caps: `['tool-events']`
- client id: `openclaw-control-ui`
- client display name: `Mission Control`
- mode: `webchat`

Supported auth material from settings:
- `gatewayToken`
- `gatewayPassword`
- `gatewayDeviceToken`

### RPC methods OCC actively uses
- `connect`
- `connect.challenge` fallback path
- `sessions.subscribe`
- `sessions.list`
- `chat.history`
- `chat.send`
- `chat.abort`
- `health`
- `status`

### Events OCC actively consumes
- `sessions.changed`
- `chat`
- `agent`
- `ready` and `gateway.ready`
- `connect.challenge`
- wildcard `*` in some stores for generic observation

### Reconnect behavior
The client reconnects automatically unless it detects an authentication failure. Auth failures disable reconnect until the app explicitly reconnects.

Backoff defaults:
- min delay: 800 ms
- max delay: 15 s
- jitter ratio: 0.3

---

## 7. Store Architecture and Boundaries

**Store directory:** `src/stores/`

The current architecture is store-driven and mostly event-driven. Source-of-truth boundaries matter here, because the code still contains some compatibility shims from earlier phases.

### Primary stores
- `sessionsStore.ts` — authoritative renderer model for gateway sessions and crew display state
- `crewRegistryStore.ts` — explicit crew/session registration plus spawn bridge polling
- `chatStore.ts` — chat transcript, current session, streaming assistant state
- `toolStore.ts` — tool activity derived from gateway events
- `systemStore.ts` — gateway connection/health/ready/status
- `hostMetricsStore.ts` — host CPU/memory/disk from metrics sidecar
- `activityFeedStore.ts` — read-only computed projection over session/chat/tool state
- `gateway.ts` — **primary UI aggregation store**. Provides component-ready state derived from lower-level stores. NOT legacy.

### Store hierarchy

**Source of truth (raw gateway data):**
- `sessionsStore` — session lifecycle, attribution, selection
- `crewRegistryStore` — explicit registrations
- `chatStore` — chat transcript, streaming state

**UI aggregation (what components read):**
- `gatewayStore` — combined crew state, feed, cost, view state, Q context

**Practical rule:**
- Gateway events → `sessionsStore` → `crewRegistryStore`/`chatStore`
- UI components → `gatewayStore` (for display state) OR direct to source stores (for truth)

`gatewayStore` is the primary interface between raw data and UI rendering. It is actively maintained, not deprecated.

---

## 8. sessionsStore: Session Authority

**File:** `src/stores/sessionsStore.ts`

### Responsibilities
`sessionsStore` is the renderer’s authoritative session model. It handles:
- gateway connection state for session subscription
- session normalization from gateway payloads
- session refresh from `sessions.list`
- reaction to `sessions.changed`
- active-session selection for chat
- main session selection
- crew display state derivation
- synchronization of aggregated state into `gatewayStore` (UI-facing display state)

### Initialization flow
On `initialize()` it:
1. connects the gateway client
2. subscribes to session updates with `sessions.subscribe()`
3. fetches authoritative sessions via `sessions.list({ includeGlobal: true, includeUnknown: true, limit: 500 })`
4. wires event listeners once

On reconnect, it re-subscribes and re-fetches sessions.

### Session normalization
`normalizeSession()` accepts either direct session payloads or payloads wrapped under `session` and normalizes fields including:
- `key`
- `sessionId`
- `agentId`
- `label`
- `displayName`
- `parentSessionKey`
- `spawnedBy`
- `subagentRole`
- `status`
- `startedAt`
- `endedAt`
- `runtimeMs`
- `updatedAt`
- token counters
- `contextTokens`
- `percentUsed`
- `model`
- `flags`

`percentUsed` is taken from the payload when present. If missing, it is computed from `totalTokens / contextTokens`.

### Main session selection
`pickMainSessionKey()`:
- finds the crew member marked `isMainSession` in crew config
- maps eligible sessions to that crew member
- sorts by `totalTokens` descending, then `updatedAt` descending
- picks the winning session key as `mainSessionKey`

In practice, that means the main Q session is whichever mapped main session shows the most token activity, not simply the newest session.

### Selected session behavior
`sessionsStore.selectedSessionKey` is the user-selected chat session.
- If the current selection disappears, it falls back to `mainSessionKey`.
- `selectSession()` refuses unknown keys.
- Clearing the selection sets it to `null`; the chat layer then falls back to the main session if present.

### Activity timestamps
`sessionActivityByKey` is updated when:
- a meaningful session change is detected during refresh
- a `sessions.changed` event arrives

The store uses this activity map for recency ordering and display status.

---

## 9. crewRegistryStore: Explicit Crew Attribution

**File:** `src/stores/crewRegistryStore.ts`

This store is the missing link between raw OpenClaw sessions and named bridge crew members.

### What it tracks
For each crew/session registration it stores:
- `sessionId`
- `sessionKey`
- `requestId`
- `ownerId`
- `crewId`
- `task`
- `spawnedAt`
- `completedAt`
- `modelRequested`
- `modelActive`
- fallback history
- normalized status
- raw OpenClaw status
- timestamps and source

### Registration sources
There are two registration paths:

#### 1. Spawn bridge path
The metrics sidecar maintains a small in-memory spawn bridge.
- `/spawn-intent` records that a crew member is about to be spawned
- `/spawn-confirm` records which session actually materialized
- `/spawn-status` returns event history for polling

`crewRegistryStore.startSpawnRegistryBridgePolling()` polls `/spawn-status` every 1500 ms and updates pending and confirmed registrations.

This is the most explicit attribution path because it carries:
- crew id
- request id
- session key
- owner id
- requested model
- active model
- fallback metadata

#### 2. Session auto-registration path
`sessionsStore` also calls `autoRegisterFromSession(session)` for subagent sessions.

Auto-registration only happens when all of the following are true:
- the session has `parentSessionKey`
- the session label matches a crew member id or name from `crew-config.json`

If those conditions are not met, the subagent is **not** attributed automatically.

### Session → crew attribution rule
The actual lookup order is:
1. check `crewRegistryStore.getRegistrationBySession(sessionId, sessionKey)`
2. if not found and the session is a non-subagent main session, map it to the crew member with `isMainSession=true` (Q)
3. otherwise do **not** attribute the session

That means the manual rule is simple:
- **Q main session**: explicit main-session policy
- **subagents**: explicit registration first, label-based auto-registration second
- **unknown subagents**: intentionally left unattributed

### Fallback model tracking
If a session’s active model differs from the requested model and the active model is listed in that crew member’s `fallbackModels`, the registry marks:
- `fallbackActive: true`
- increments `fallbackCount`
- tracks `fallbackModelsTried`

That state then flows into crew display state.

---

## 10. Crew Display State

Crew cards and crew status are derived, not directly stored in the gateway payload.

### Status mapping in `sessionsStore`
`inferStatus()` maps raw session status like this:
- `failed` → `error`
- `killed` → `stopped`
- `done` → `completed`
- `timeout` / timed variants → `timed-out`
- `running` → `active`
- anything else → `active` if recently updated, otherwise `idle`

Idle threshold:
- 120000 ms (2 minutes)

### Display content per crew member
For each configured crew member, `buildCrewDisplayState()` resolves:
- display status
- active model
- context percent
- current task from registry
- requested model
- fallback flags and count

If a crew member has no current mapped session, the store falls back to the most recent registry record for that crew member and maps its state to an offline/idle/completed/error display.

---

## 11. Chat Store and Chat Session Mechanics

**File:** `src/stores/chatStore.ts`

### Responsibilities
`chatStore` owns:
- current chat connection status
- currently active `sessionKey`
- persisted transcript for the active session
- in-flight assistant stream state
- optimistic user messages
- run abort state
- chat history loading

### Session source of truth
`chatStore` does **not** choose sessions independently. It subscribes to `sessionsStore` and derives its session like this:
- `selectedSessionKey ?? mainSessionKey ?? null`

When that value changes, `chatStore` immediately:
- sets the new `sessionKey`
- sets session status to `available` or `missing`
- clears transcript, stream, pending ids, and errors
- increments `historyLoadToken`
- loads chat history for the new session

That means the session switcher is implemented as a **store-driven reset and rehydrate**, not a UI-only swap.

### History loading
`loadHistoryForSession(sessionKey, limit=200)` calls `chat.history` and normalizes message payloads.

To prevent stale async writes from racing the UI, it uses `historyLoadToken`; only the latest load for the currently active session is allowed to commit.

### Sending messages
When sending a message, `chatStore`:
1. validates that a session is selected and the gateway is connected
2. adds an optimistic user message locally
3. generates local `runId` and `idempotencyKey`
4. sends `chat.send(sessionKey, message, { idempotencyKey, deliver: false })`

Important: the locally created `runId` is **not** sent to the gateway. The gateway generates its own run id.

### Streaming behavior
`chatStore` consumes `chat` events for the active session only.

Handled stream states:
- `delta` — append assistant text to in-memory stream
- `final` — commit assistant message to transcript, clear stream, reload history
- `aborted` — commit interrupted assistant message if any
- `error` — commit error-state assistant message if partial output exists

### Abort behavior
`abortActiveRun()` calls `chat.abort(sessionKey, activeRunId?)`.
If no local run id is known, it still sends an abort using just the session key.

---

## 12. Chat Session Switcher Data Flow

**Files:**
- `src/components/chat/SessionSelector.tsx`
- `src/components/chat/ChatStatusCard.tsx`
- `src/components/chat/ChatView.tsx`

### UI composition
`ChatView` renders `ChatStatusCard` with `showSessionSelector={true}`. `ChatStatusCard` then renders `SessionSelector` in the “Active Session” row.

### Ordering and filtering
`SessionSelector` builds its menu from `sessionsStore`:
- `sessionKeys`
- `sessionsByKey`
- `sessionActivityByKey`
- `selectedSessionKey`
- `mainSessionKey`

Sessions are sorted by:
1. main session first
2. then descending activity timestamp (`sessionActivityByKey`, then `updatedAt`, then `startedAt`)

Search input appears only when there are more than 10 sessions.

### Selection flow
When the user selects a session:
1. `SessionSelector.chooseSession()` calls `sessionsStore.selectSession(session.key)`
2. the selector closes immediately
3. `chatStore` subscription notices the new `selectedSessionKey`
4. `chatStore` clears current chat state and loads the new history
5. once `chatStore.sessionKey` matches the target key, the selector clears its local loading indicator
6. `ChatView` updates the session banner and transcript

### What “switching” actually means
The selector’s spinner is driven by this condition:
- `switchingTargetKey !== null && chatSessionKey !== switchingTargetKey`

So the UI does not consider the switch complete when the dropdown closes. It considers the switch complete when the **chat store** has actually adopted the new session key.

### Label shown to the user
Displayed session label priority:
1. `displayName`
2. `label`
3. raw session key

### Status dot mapping in the selector
The menu dot colors are based on raw session status:
- `running` → running
- `done` → done
- `failed`, `killed`, `timeout` → error
- anything else → idle

This mapping is local to the selector. It is not the same as the broader crew display mapping.

---

## 13. Tool Activity Tracking

**File:** `src/stores/toolStore.ts`

### Responsibilities
`toolStore` tracks tool runs for chat sessions by listening to:
- `agent` events for tool stream updates
- `chat` events for run finalization or failure

### Event model
Tool data is expected either when:
- `payload.stream === 'tool'`, or
- nested event data includes a `toolCallId`

Each tool run is keyed as:
- `${sessionKey}:${toolCallId}`

This is intentional. The entity id does not depend on `runId`, which avoids duplicate tool rows when a run id arrives after the initial tool event.

### Status mapping
Phases map to run status as follows:
- `error` → `error`
- `result`, `done`, `complete`, `completed`, `final` → `success`
- everything else → `running`

When a chat run ends with `final`, all still-running tools for that session are settled as success. If the chat run ends with `aborted` or `error`, remaining running tools are settled as error.

---

## 14. systemStore vs hostMetricsStore

These two stores are intentionally separate.

### systemStore
**File:** `src/stores/systemStore.ts`

This store contains **gateway-native state**:
- WebSocket connection state
- health from `health` RPC
- ready state from `ready` / `gateway.ready` events and health payloads
- status from `status` RPC
- channel summary

Polling interval:
- 30 seconds for health and status, but only while connected

### hostMetricsStore
**File:** `src/stores/hostMetricsStore.ts`

This store contains **host OS metrics** from the metrics sidecar:
- CPU usage
- load average
- memory usage
- disk usage

Polling interval:
- 5 seconds by default

### Practical rule
- If you want to know whether the gateway is alive, use `systemStore`.
- If you want to know whether the host machine is under load, use `hostMetricsStore`.

Do not mix them. The code intentionally does not.

---

## 15. activityFeedStore

**File:** `src/stores/activityFeedStore.ts`

The activity feed is a **computed projection**, not a source of truth.

It derives feed entries from:
- `sessionsStore`
- `chatStore`
- `toolStore`

It explicitly does **not** own session or crew state.

This matters because it still performs some lightweight session interpretation for feed display, but those computations must not be treated as authoritative for attribution or runtime state.

---

## 16. Crew Configuration

**Files:**
- `crew-config.json`
- `src/config/crewConfig.ts`

### Required config shape
Crew config is validated at runtime. The current rules are:
- `spawnBehavior` must be `explicitRegistration`
- there must be exactly one `isMainSession: true` crew member
- every non-main crew member must define `defaultModel`

### Current configured crew
- Q — main session commander
- Data — research
- Geordi — code
- Spark — quick code
- Riker — QA/review
- Troi — marketing
- Barclay — art/UX

### Runtime reload behavior
The renderer reloads `crew-config.json` when:
- the window gains focus
- the document becomes visible again

If the config file is invalid or unavailable, the app falls back to `DEFAULT_CREW_CONFIG` and marks the config as degraded internally.

---

## 17. Metrics Sidecar

**Real file:** `/Users/maccagey/.openclaw/workspace/system-metrics-server/server.mjs`

The technical manual previously pointed at a non-existent copy under `projects/mission-control/system-metrics-server/`. That path is wrong for development. The real source lives at workspace root and is packaged into the app as an extra resource.

### Responsibilities
The sidecar does two unrelated but real jobs:
1. expose host system metrics over HTTP
2. provide a lightweight in-memory spawn registry bridge

### Ports and binding
It tries ports in order:
- 18790
- 18791
- 18792
- 18793

The code listens without an explicit host parameter, which means it binds according to Node/OS defaults. In practice, this is often broader than `127.0.0.1`.

Do **not** document this as loopback-only. The current implementation does not enforce that.

### Endpoint summary
- `GET /api/system/metrics` — CPU/memory/disk snapshot
- `GET /api/system/platform` — platform metadata
- `POST /spawn-intent` — record crew spawn intent
- `POST /spawn-confirm` — record session confirmation
- `GET /spawn-status` — poll current registry or event log
- `GET /health` — basic sidecar health response

### Caching and retention
- metrics cache TTL: 5 seconds
- spawn intent retention: 6 hours
- spawn event retention: last 5000 events and/or last 6 hours

### Metric collection details
macOS:
- CPU from `top -l 2 -n 0 -F | tail -1`
- load average from `sysctl -n vm.loadavg`
- memory from `vm_stat`
- disk from `df -h /`

Linux:
- CPU and load from `/proc/stat` and `/proc/loadavg`
- memory from `/proc/meminfo`
- disk from `df -h /`

### Known formatting quirk
`collectMetrics()` sets `timestamp` to an ISO string, while `hostMetricsStore` expects a numeric timestamp and falls back to `Date.now()` if it is not numeric. The UI still works, but the timestamp contract is inconsistent.

---

## 18. Security Considerations

### What is protected
- Electron renderer does not have direct Node integration.
- BrowserWindow uses `contextIsolation: true`.
- Gateway traffic can use `ws` or `wss` depending on settings.
- Challenge signing is supported through device-auth flow when the gateway issues a challenge nonce.

### What is **not** encrypted or protected by OCC
- `settings.json` stores gateway credentials in plaintext if configured.
  - This includes at least `gatewayToken`
  - It may also include `gatewayPassword` and `gatewayDeviceToken` if the renderer saves them
- The metrics sidecar exposes unauthenticated HTTP endpoints.
- Spawn bridge endpoints are unauthenticated.
- CORS on the sidecar is `Access-Control-Allow-Origin: *`.
- The sidecar does not explicitly bind to loopback only.
- Chat transcript and session state live in renderer memory; OCC does not add application-level encryption.

### Practical security posture
OCC is safe enough for a trusted local operator environment. It is **not** hardened for hostile local networks or multi-user machines in its current form.

### Minimum operational guidance
- treat the Electron userData directory as sensitive
- do not expose the metrics sidecar port beyond localhost without adding auth and bind restrictions
- prefer `wss` when the gateway is remote
- do not assume the sidecar is private just because Electron spawned it

---

## 19. Ports and Endpoints

### Default ports
- `5180` — Vite dev server
- `18789` — OpenClaw Gateway WebSocket
- `18790` — preferred metrics sidecar port
- `18791-18793` — metrics sidecar fallback ports
- `5181` — legacy proxy default in settings only; not an active service in Phase 7

### Current endpoint usage
Renderer uses:
- WebSocket to gateway
- HTTP to metrics sidecar

Renderer does **not** use the removed proxy for normal operation.

---

## 20. Development and Packaging

### Development
From `projects/mission-control/`:

```bash
npm run dev
```

That starts the Vite dev server on 5180.

To run the packaged Electron shell in development, use Electron separately if needed. The repo script list includes:

```bash
npm run electron
```

### Build
```bash
npm run build
```

### Package
```bash
npm run dist:mac
npm run dist
```

### Dev metrics sidecar
From workspace root:

```bash
cd /Users/maccagey/.openclaw/workspace/system-metrics-server
node server.mjs
```

---

## 21. Troubleshooting

This section is written for actual failure modes in the current code, not wishful thinking.

### Chat shows “No Active Session”
Cause chain:
- `chatStore.sessionKey` is null because `selectedSessionKey ?? mainSessionKey` resolved to null

Check, in order:
1. confirm the gateway connection is up
2. confirm `sessionsStore.initialize()` succeeded
3. confirm `sessions.list` is returning sessions
4. confirm at least one main session exists and is being mapped to Q
5. if sessions exist but no session is selected, use the session selector and verify the key remains in `sessionsByKey`

Likely root causes:
- gateway disconnected
- no active OpenClaw sessions
- session payload missing a usable `key`
- crew mapping failure leaving `mainSessionKey` null

### Session selector is empty
That means `sessionKeys.length === 0`.

Check:
1. WebSocket connection to gateway
2. `sessions.subscribe()` success
3. `sessions.list({ includeGlobal: true, includeUnknown: true, limit: 500 })` response shape
4. whether session payloads are wrapped in an unexpected structure not handled by `extractSessionsPayload()`

### Session switcher spins and never completes
The selector waits for `chatStore.sessionKey` to equal the selected target key.

Check:
1. whether `sessionsStore.selectSession()` accepted the key
2. whether `chatStore` subscription is still wired
3. whether `chatStore.sessionKey` changed
4. whether `loadHistoryForSession()` threw and left the store in a half-switched state

A fast diagnostic is to inspect:
- `sessionsStore.selectedSessionKey`
- `chatStore.sessionKey`

If those diverge permanently, the chat subscription path is broken.

### Crew member appears offline even though a subagent session exists
This is usually an attribution problem, not a transport problem.

Check:
1. does the session have `parentSessionKey`?
2. does the session label match a crew id or crew name exactly, case-insensitively?
3. did the spawn bridge emit an intent and confirm event?
4. does `crewRegistryStore.getRegistrationBySession(sessionId, sessionKey)` return a record?

Remember: OCC intentionally refuses to auto-attribute unknown subagents.

### Wrong crew member attached to a session
Check the session label first. Auto-registration resolves crew by exact normalized match against crew id or crew name. If the label is ambiguous or wrong, attribution will be wrong or missing.

### Main session is wrong
`mainSessionKey` is chosen from mapped main-session candidates by:
1. highest `totalTokens`
2. then newest `updatedAt`

If the “wrong” main session is selected, it may still be correct according to current code. The selection algorithm favors the most active main session, not strictly the newest one.

### Host metrics missing
Check:
1. the sidecar is running
2. the actual bound port from sidecar startup logs
3. `settings.json` contains the updated `metricsBaseUrl`
4. `GET ${metricsBaseUrl}/api/system/metrics` succeeds

If 18790 is occupied, the sidecar may have moved to 18791-18793. Electron main is supposed to rewrite settings when it sees the `metrics-ready` log line.

### Sidecar responds, but timestamps look odd
That is expected with the current code. The sidecar returns an ISO timestamp string; `hostMetricsStore` expects a numeric timestamp and falls back to `Date.now()`.

### Packaged app logs proxy startup warnings
Expected for now. Electron main still tries to start the removed proxy stub and may also wait for proxy health before launching. Those warnings are legacy noise unless the app actually fails to load.

### Gateway repeatedly reconnects
Check:
1. gateway host/port/protocol in settings
2. token/password/device token validity
3. whether the failure is auth-related

If the gateway client decides the error is an auth failure, it disables reconnect until the next explicit connect attempt.

---

## 22. Current Limitations and Technical Debt

- Electron main still spawns the removed proxy stub.
- Packaged startup still waits on a dead proxy health endpoint and only logs through the failure.
- Sidecar bind address is not explicitly restricted. **See `TODO-SECURITY.md` P0 #3 for remediation.**
- Sidecar endpoints are unauthenticated and CORS-permissive.
- Settings file stores credentials in plaintext.
- Metrics timestamp format is inconsistent with the consuming store.
- `gatewayStore` is a UI aggregation layer, which can confuse readers about which store is authoritative for raw session data. Source of truth is `sessionsStore`.
- Spawn bridge polling is still required for the fullest crew attribution path; there is no direct gateway-native equivalent in OCC yet.

---

## 23. Recommended Extension Rules

If you change the architecture, keep these boundaries intact:

### Session work
Change `sessionsStore` first, not UI components.

### Crew attribution work
Change `crewRegistryStore` and the spawn bridge contract first.
Do not add heuristic UI-side crew guesses.

### Chat session switching
Keep the selected-session source of truth in `sessionsStore`.
Do not let the chat UI manage its own parallel selected-session state.

### Metrics work
Keep host metrics separate from gateway health.
Do not move host CPU/memory/disk into `systemStore`.

### Security work
The highest-value hardening changes would be:
1. bind the sidecar explicitly to `127.0.0.1`
2. remove or gate permissive CORS
3. stop storing credentials in plaintext
4. remove legacy proxy startup and wait logic from Electron main

---

## 24. Key Paths

- App root: `projects/mission-control/`
- Electron main: `projects/mission-control/electron/main.mjs`
- Electron preload: `projects/mission-control/electron/preload.mjs`
- App entry: `projects/mission-control/src/App.tsx`
- Gateway client: `projects/mission-control/src/core/gatewayClient/`
- Stores: `projects/mission-control/src/stores/`
- Chat UI: `projects/mission-control/src/components/chat/`
- Crew config runtime: `projects/mission-control/src/config/crewConfig.ts`
- Crew config file: `projects/mission-control/crew-config.json`
- Proxy removal stub: `projects/mission-control/proxy-server.mjs`
- Metrics sidecar source: `/Users/maccagey/.openclaw/workspace/system-metrics-server/server.mjs`

---

## 25. Revision History

- 2026-04-02: Manual rewritten against the live codebase. Corrected Phase 7 architecture, session attribution, chat switcher flow, store boundaries, sidecar path, security notes, and troubleshooting.
