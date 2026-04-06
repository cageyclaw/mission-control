# Spawn → Crew Registry Bridge Plan (Bridge Crew Critical Gap)

## Problem Summary (the actual missing wire)
OCC’s **Crew Registry** is designed around **explicit registration** (`spawnBehavior: "explicitRegistration"`). The UI and stores (sessionsStore/gateway/activityFeed) **refuse to infer** crew attribution for subagent sessions.

Result: subagents spawn successfully in OpenClaw, but OCC never calls:
- `useCrewRegistryStore.getState().registerPendingSpawn(...)`
- followed by `confirmRegistration(...)`

So `registry.getRegistrationBySession(...)` returns `undefined`, and the UI drops those sessions on the floor.

The bridge must:
1. Detect a spawn attempt
2. Carry **crewId** (and optional metadata: task/model/requestId/sessionKey)
3. Confirm once the **sessionId/sessionKey** is known
4. Handle failure + timeouts cleanly

---

## Options Analysis

### Option A — Extend `sessions_spawn` to accept `crewId` (and emit event)
**Idea:** Add a `crewId` parameter to the tool / gateway RPC, and have the gateway emit an event like `crew.spawned` or enrich `sessions.spawned`.

**Pros**
- Cleanest conceptual model: spawn is inherently “a crew spawn”.
- Single source of truth: OpenClaw emits authoritative mapping.
- Lowest chance of OCC/main-agent disagreement.

**Cons / Costs**
- Requires changes in **OpenClaw core** (tool schema, tool handler, gateway protocol/events, UI).
- Requires versioning + compatibility handling across gateway ↔ OCC.
- Slower iteration (publish OpenClaw, update install, etc.).

**Complexity:** High (core product change)

**Best when:** You want long-term “first-class Bridge Crew” in OpenClaw itself.

---

### Option B — Pre-register API (two-phase commit): `spawn-intent` → `spawn` → `confirm`
**Idea:** OCC (or a local service it owns) exposes a registration endpoint. The parent (main session / tool wrapper) calls:
1) `POST /crew/spawn-intents` with `{crewId, task, modelRequested, ownerId...}` → returns `requestId`
2) Spawn subagent with `requestId` embedded (label/task metadata)
3) When session appears / spawn returns sessionKey, call `POST /crew/spawn-confirm` with `{requestId, sessionId/sessionKey}`

**Pros**
- Works **today** without changing OpenClaw.
- Very explicit; matches existing registry design (`pendingByRequestId`).
- Easy to test end-to-end in OCC repo.

**Cons**
- Requires building/hosting an HTTP endpoint reachable by the spawner.
  - OCC is a static Vite preview by default; no server.
  - Sidecar exists (metrics server) but currently separate.
- Two-phase flows need retries + cleanup.

**Complexity:** Medium (requires a small local server)

**Best when:** You can safely add endpoints to the **existing sidecar** (port 18790) or add a tiny “bridge server”.

---

### Option C — Proxy/intercept `sessions_spawn` calls (client-side wrapper)
**Idea:** Never call `sessions_spawn()` directly. Instead call a wrapper `spawnCrew(crewId, ...)` that:
- pre-registers in the registry store (in OCC context)
- calls gateway/tool spawn
- confirms once it has a sessionKey/sessionId

**Pros**
- Fastest to implement if the spawner is OCC itself.
- No OpenClaw core changes.

**Cons**
- In reality, spawns are often initiated by **the agent runtime** (Q) using the tool, not by OCC.
- If the main session spawns from Telegram/CLI, OCC can’t intercept that.

**Complexity:** Low, but only solves a subset.

**Best when:** All spawns originate from OCC UI actions.

---

### Option D — Gateway plugin / runtime hook that watches spawns, maps → crewId, notifies OCC
**Idea:** Implement a plugin (or internal hook) in OpenClaw that listens for subagent spawns (`spawnSubagentDirect` path exists), extracts `crewId` from metadata (label convention, requestId, etc.), then emits a gateway event OCC can consume.

**Pros**
- No fork of OpenClaw core if plugin API supports hooks.
- Centralized, works regardless of who initiated the spawn.
- Can evolve to Option A later.

**Cons**
- Depends on plugin extensibility for spawn lifecycle events.
- Still needs a reliable way to determine crewId.
  - Without explicit param, you need **conventions** (label/tagging).

**Complexity:** Medium–High depending on hook availability.

**Best when:** Plugin hooks are stable and you want cross-surface support.

---

## Recommendation

### Recommended path: **Option B (Pre-register via Sidecar) + lightweight labeling convention**
This is the best “works now, respects explicitRegistration, minimal upstream changes” solution.

Reasoning:
- OCC already *intentionally* forbids inference. Therefore we must introduce an explicit, deterministic mapping source.
- We can implement a small API in the existing **system-metrics-server sidecar** (port 18790) to store spawn intents and relay them to OCC.
- It avoids modifying OpenClaw core.
- It uses the registry store’s existing design: `pendingByRequestId` + `confirmRegistration`.

### Small addition for robustness
Embed `requestId` in the subagent spawn metadata so the confirmation step can match reliably:
- Add to label: `"Data [crew:data req:abcd1234]"` (human-readable)
- Add to task prefix: `"[crew:data request:abcd1234] ..."`

Even if label/task formatting changes, the **confirm** call uses returned sessionKey/sessionId.

---

## Target Architecture (recommended)

### Components
1) **Bridge API (Sidecar)** — extend `system-metrics-server`:
- `POST /crew/spawn-intents` → returns `{requestId}`
- `POST /crew/spawn-confirm` → stores `{requestId, sessionId?, sessionKey?}`
- `GET /crew/spawn-events?since=<cursor>` (or SSE) → for OCC to consume

2) **OCC Frontend**
- A `crewSpawnBridge.ts` module that:
  - polls `/crew/spawn-events`
  - calls `useCrewRegistryStore.getState().registerPendingSpawn` for intent events
  - calls `confirmRegistration` for confirm events
  - updates status over time (timeouts, errors)

3) **Spawner wrapper (main session helper)**
- A small helper function in the main agent runtime (or wherever spawns are initiated from) that:
  1. calls `POST /crew/spawn-intents`
  2. calls `sessions_spawn({ label, task, model, ... })`
  3. calls `POST /crew/spawn-confirm` with returned child `sessionId/sessionKey`

This keeps OCC entirely passive: it just consumes events.

---

## Step-by-Step Implementation Plan

### Step 0 — Decide the storage location
Use the existing `system-metrics-server` since it is already running and reachable by OCC.

Assumed repo path:
- `/Users/maccagey/.openclaw/workspace/system-metrics-server/`

If that server is not suitable, create `projects/mission-control-bridge-server/` as a tiny Express/Fastify service.

---

### Step 1 — Sidecar: add spawn-intent storage + event stream

#### 1.1 Add types
**File:** `system-metrics-server/src/crewSpawn/types.ts`
```ts
export type CrewSpawnEvent =
  | { type: 'intent'; requestId: string; crewId: string; task?: string; modelRequested?: string; ownerId?: string; sessionKey?: string; spawnedAt: number }
  | { type: 'confirm'; requestId: string; sessionId?: string; sessionKey?: string; modelActive?: string; confirmedAt: number }
  | { type: 'error'; requestId: string; crewId: string; reason: string; at: number };
```

#### 1.2 Add in-memory store (good enough for v1)
**File:** `system-metrics-server/src/crewSpawn/store.ts`
```ts
import crypto from 'node:crypto';
import type { CrewSpawnEvent } from './types';

const events: CrewSpawnEvent[] = [];
let seq = 0;

export function createIntent(input: Omit<Extract<CrewSpawnEvent,{type:'intent'}>, 'type'|'requestId'>) {
  const requestId = crypto.randomUUID();
  events.push({ type: 'intent', requestId, ...input });
  seq += 1;
  return { requestId, seq };
}

export function confirmIntent(input: Extract<CrewSpawnEvent,{type:'confirm'}>) {
  events.push(input);
  seq += 1;
  return { ok: true, seq };
}

export function appendError(input: Extract<CrewSpawnEvent,{type:'error'}>) {
  events.push(input);
  seq += 1;
}

export function listEvents(sinceSeq: number) {
  // naive: return all + cursor
  return { events, nextSeq: seq };
}
```

(You can later swap to SQLite or file-backed JSON if persistence across restarts matters.)

#### 1.3 Add routes
**File:** `system-metrics-server/src/routes/crewSpawn.ts`
```ts
import type { FastifyInstance } from 'fastify';
import { createIntent, confirmIntent, listEvents } from '../crewSpawn/store';

export async function crewSpawnRoutes(app: FastifyInstance) {
  app.post('/crew/spawn-intents', async (req, reply) => {
    const body = req.body as any;
    const spawnedAt = typeof body.spawnedAt === 'number' ? body.spawnedAt : Date.now();
    const { requestId } = createIntent({
      crewId: String(body.crewId),
      task: typeof body.task === 'string' ? body.task : undefined,
      modelRequested: typeof body.modelRequested === 'string' ? body.modelRequested : undefined,
      ownerId: typeof body.ownerId === 'string' ? body.ownerId : undefined,
      sessionKey: typeof body.sessionKey === 'string' ? body.sessionKey : undefined,
      spawnedAt,
    });
    reply.send({ requestId });
  });

  app.post('/crew/spawn-confirm', async (req, reply) => {
    const body = req.body as any;
    confirmIntent({
      type: 'confirm',
      requestId: String(body.requestId),
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
      sessionKey: typeof body.sessionKey === 'string' ? body.sessionKey : undefined,
      modelActive: typeof body.modelActive === 'string' ? body.modelActive : undefined,
      confirmedAt: Date.now(),
    });
    reply.send({ ok: true });
  });

  app.get('/crew/spawn-events', async (req, reply) => {
    const since = Number((req.query as any)?.since ?? 0);
    reply.send(listEvents(Number.isFinite(since) ? since : 0));
  });
}
```

#### 1.4 Register the routes
**File:** `system-metrics-server/src/server.ts` (or equivalent entry)
```ts
import { crewSpawnRoutes } from './routes/crewSpawn';
// ...
await app.register(crewSpawnRoutes);
```

---

### Step 2 — OCC: consume spawn events and update `crewRegistryStore`

#### 2.1 Add a bridge client
**File:** `projects/mission-control/src/core/crewSpawnBridge/crewSpawnBridge.ts`
```ts
import { useCrewRegistryStore } from '../../stores/crewRegistryStore';

type CrewSpawnEvent =
  | { type: 'intent'; requestId: string; crewId: string; task?: string; modelRequested?: string; ownerId?: string; sessionKey?: string; spawnedAt: number }
  | { type: 'confirm'; requestId: string; sessionId?: string; sessionKey?: string; modelActive?: string; confirmedAt: number }

export function startCrewSpawnBridge(sidecarBaseUrl: string) {
  let stopped = false;
  let since = 0;

  async function tick() {
    if (stopped) return;

    try {
      const res = await fetch(`${sidecarBaseUrl}/crew/spawn-events?since=${since}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { events: CrewSpawnEvent[]; nextSeq: number };

      const registry = useCrewRegistryStore.getState();

      for (const evt of data.events) {
        if (evt.type === 'intent') {
          registry.registerPendingSpawn({
            crewId: evt.crewId,
            requestId: evt.requestId,
            ownerId: evt.ownerId,
            sessionKey: evt.sessionKey,
            task: evt.task,
            modelRequested: evt.modelRequested,
            spawnedAt: evt.spawnedAt,
          });
        }

        if (evt.type === 'confirm' && evt.sessionId) {
          registry.confirmRegistration({
            sessionId: evt.sessionId,
            requestId: evt.requestId,
            sessionKey: evt.sessionKey,
            modelActive: evt.modelActive,
          });
        }
      }

      since = data.nextSeq;
    } catch (err) {
      // don’t crash; keep trying
      console.warn('[crewSpawnBridge] tick failed', err);
    } finally {
      setTimeout(tick, 1000);
    }
  }

  void tick();

  return () => { stopped = true; };
}
```

#### 2.2 Wire it into OCC startup
Find the bootstrap point.
**Likely file:** `projects/mission-control/src/main.tsx` or `src/core/gatewayClient/bootstrap.ts`

Add:
```ts
import { startCrewSpawnBridge } from './core/crewSpawnBridge/crewSpawnBridge';

startCrewSpawnBridge('http://localhost:18790');
```

(If you already have sidecar URL in config, use that.)

---

### Step 3 — Spawner helper: make spawns always register

Wherever Q triggers crew spawns, replace direct `sessions_spawn()` usage with a helper.

#### 3.1 Pseudocode helper (runtime side)
```ts
async function spawnCrewMember({ crewId, label, task, model }: {crewId: string; label: string; task: string; model?: string}) {
  // 1) intent
  const intentRes = await fetch('http://localhost:18790/crew/spawn-intents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ crewId, task, modelRequested: model, ownerId: 'main' }),
  });
  const { requestId } = await intentRes.json();

  // 2) spawn (embed requestId in label or task for human debugging)
  const spawn = await sessions_spawn({
    label: `${label} [crew:${crewId} req:${requestId.slice(0,8)}]`,
    task: `[crew:${crewId} request:${requestId}]\n\n${task}`,
    ...(model ? { model } : {}),
  });

  // spawn result shape depends on tool; adapt accordingly.
  const sessionKey = (spawn as any)?.sessionKey;
  const sessionId = (spawn as any)?.sessionId ?? (sessionKey?.split(':').pop());

  // 3) confirm
  await fetch('http://localhost:18790/crew/spawn-confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId, sessionKey, sessionId, modelActive: model }),
  });

  return spawn;
}
```

**Key point:** you already have registry support for both `requestId` and `sessionKey`. This two-phase approach uses both so matching is reliable.

---

## Integration Notes (how this fits existing OCC code)

- `gateway.ts` and `activityFeedStore.ts` both rely on:
  - `useCrewRegistryStore.getState().getRegistrationBySession(sessionId, session.key)`

Once the bridge is running and confirmations happen:
- `gateway.updateStatus()` will start creating `subagentMappings` for those sessions
- `CrewCard` will show correct online/offline + model + context
- Activity feed will attribute tool output to the correct crew member

No changes required to `sessionsStore.ts` mapping logic, because it’s already correct: it’s waiting for the registry to be populated.

---

## Testing Strategy

### 1) Sidecar unit tests
- Test `createIntent()` returns requestId and appends an intent event.
- Test `confirmIntent()` appends confirm event.
- Test `listEvents(since)` returns events and advances cursor.

### 2) OCC integration tests (store-level)
- Add a test that simulates bridge events:
  - call `registerPendingSpawn({ crewId, requestId })`
  - then call `confirmRegistration({ sessionId, requestId })`
  - assert `getRegistrationBySession(sessionId)` returns crewId

(You already have `crewRegistry.test.ts`; add a “bridge style flow” test case.)

### 3) End-to-end manual verification
1. Start gateway + sidecar + OCC.
2. Spawn Data via helper.
3. In OCC, confirm:
   - Data card becomes online/active
   - sessions list shows subagent session mapped to Data
   - activity feed attributes entries to Data
4. Kill/restart OCC: ensure bridge replays events (if store is ephemeral, you’ll lose mapping — see persistence note below).

### 4) Failure-mode tests
- Sidecar offline: spawn still works, OCC shows no mapping; ensure UI doesn’t crash.
- Confirm missing sessionId: confirm should be retried later once session list contains it.

---

## Fallback Handling (when registration fails)

### A) Sidecar unavailable at spawn time
- The helper should:
  - attempt intent registration with a short timeout (e.g., 500ms–1500ms)
  - if it fails, still spawn the subagent
  - log a warning and embed `[crew:<id>]` in the label/task so a later reconciliation tool can attribute it

### B) Confirm fails
- Retry confirm a few times (exponential backoff up to ~30s).
- OCC bridge can also reconcile by:
  - scanning new sessions
  - looking for label/task tags containing `requestId`
  - and calling `confirmRegistration` locally

### C) OCC reloads and loses in-memory registry
Two approaches:
1) Persist events in sidecar (recommended): keep an append-only event log in memory + write-through to disk.
2) On OCC start, replay events from sidecar (bridge already does this if it returns full list).

### D) Session spawned but never appears (spawn failure)
- Sidecar should support an `error` event:
  - helper catches spawn exception → `POST /crew/spawn-error`
- OCC receives it → `registerPendingSpawn` then `updateRegistration(... status:'error')`

---

## Future Improvements / Migration Path

1) Add persistence to sidecar spawn store (SQLite or JSONL file).
2) Add SSE/WebSocket stream instead of polling.
3) Upgrade to Option D plugin hooks if OpenClaw exposes a stable spawn lifecycle hook.
4) Long-term: Option A — make `crewId` a first-class `sessions_spawn` param and emit `crew.spawned` events over gateway.

---

## Minimal Checklist (what to implement first)
1. Sidecar endpoints: `/crew/spawn-intents`, `/crew/spawn-confirm`, `/crew/spawn-events`
2. OCC bridge poller that feeds `crewRegistryStore`
3. Spawn helper in main session that performs intent → spawn → confirm

Once these exist, Bridge Crew stops being a static config file and becomes a live, correctly attributed roster.
