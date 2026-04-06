# OCC Crew Idle Status Design

## Goal

Show Bridge Crew presence as:
- **Green = active**
- **Yellow = idle**
- **Gray = offline/completed**

without relying on a nonexistent OpenClaw “session completed” event type or a magical `age` field that does not actually come from `sessions.list`.

---

## What OpenClaw actually provides

## 1) `sessions.list` response structure

OpenClaw builds the `sessions.list` result in:
- `/usr/local/lib/node_modules/openclaw/dist/session-utils-Jgzk2Bo-.js` → `listSessionsFromStore(...)`
- type definitions in `/usr/local/lib/node_modules/openclaw/dist/plugin-sdk/src/gateway/session-utils.types.d.ts`

`listSessionsFromStore(...)` returns:

```ts
{
  ts: now,
  path: storePath,
  count: sessions.length,
  defaults: getSessionDefaults(cfg),
  sessions
}
```

Source: `session-utils-Jgzk2Bo-.js`, function `listSessionsFromStore(...)`.

Each `sessions[]` item is a `GatewaySessionRow`, built by `buildGatewaySessionRow(...)`.

Exact `GatewaySessionRow` fields from `session-utils.types.d.ts`:

```ts
{
  key: string;
  spawnedBy?: string;
  spawnedWorkspaceDir?: string;
  forkedFromParent?: boolean;
  spawnDepth?: number;
  subagentRole?: SessionEntry["subagentRole"];
  subagentControlScope?: SessionEntry["subagentControlScope"];
  kind: "direct" | "group" | "global" | "unknown";
  label?: string;
  displayName?: string;
  derivedTitle?: string;
  lastMessagePreview?: string;
  channel?: string;
  subject?: string;
  groupChannel?: string;
  space?: string;
  chatType?: ChatType;
  origin?: SessionEntry["origin"];
  updatedAt: number | null;
  sessionId?: string;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  thinkingLevel?: string;
  fastMode?: boolean;
  verboseLevel?: string;
  reasoningLevel?: string;
  elevatedLevel?: string;
  sendPolicy?: "allow" | "deny";
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  estimatedCostUsd?: number;
  status?: "running" | "done" | "failed" | "killed" | "timeout";
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  parentSessionKey?: string;
  childSessions?: string[];
  responseUsage?: "on" | "off" | "tokens" | "full";
  modelProvider?: string;
  model?: string;
  contextTokens?: number;
  deliveryContext?: DeliveryContext;
  lastChannel?: SessionEntry["lastChannel"];
  lastTo?: string;
  lastAccountId?: string;
  lastThreadId?: SessionEntry["lastThreadId"];
}
```

### Important negative finding

`GatewaySessionRow` **does not include**:
- `age`
- `lastActivityAt`
- `percentUsed`
- a dedicated `active/idle` state

So OCC’s current `inferStatus()` fallback using `session.age` is reading a field that OpenClaw’s current `sessions.list` type does not define.

## 2) `sessions.changed` event payload

OpenClaw broadcasts `sessions.changed` in:
- `/usr/local/lib/node_modules/openclaw/dist/gateway-cli-6Ksv5U_O.js`

Broadcast call:

```ts
broadcastToConnIds("sessions.changed", {
  sessionKey,
  phase: lifecyclePhase,
  runId: evt.runId,
  ts: evt.ts,
  ...buildSessionEventSnapshot(sessionKey, evt)
}, sessionEventConnIds, { dropIfSlow: true });
```

This only happens when lifecycle phase is `start`, `end`, or `error`.

Source: `gateway-cli-6Ksv5U_O.js`, in gateway event fanout logic.

`buildSessionEventSnapshot(sessionKey, evt)` returns these top-level fields:

```ts
{
  session?: GatewaySessionRow merged with lifecycle patch,
  updatedAt,
  sessionId,
  kind,
  channel,
  subject,
  groupChannel,
  space,
  chatType,
  origin,
  spawnedBy,
  spawnedWorkspaceDir,
  forkedFromParent,
  spawnDepth,
  subagentRole,
  subagentControlScope,
  label,
  displayName,
  deliveryContext,
  parentSessionKey,
  childSessions,
  thinkingLevel,
  fastMode,
  verboseLevel,
  reasoningLevel,
  elevatedLevel,
  sendPolicy,
  systemSent,
  inputTokens,
  outputTokens,
  lastChannel,
  lastTo,
  lastAccountId,
  lastThreadId,
  totalTokens,
  totalTokensFresh,
  contextTokens,
  estimatedCostUsd,
  responseUsage,
  modelProvider,
  model,
  status,
  startedAt,
  endedAt,
  runtimeMs,
  abortedLastRun
}
```

And the enclosing event also adds:

```ts
{
  sessionKey,
  phase: "start" | "end" | "error",
  runId,
  ts,
  ...snapshot
}
```

## 3) Completion / termination signaling

OpenClaw **does** persist terminal lifecycle state for sessions.

In `/usr/local/lib/node_modules/openclaw/dist/gateway-cli-6Ksv5U_O.js`:
- `deriveGatewaySessionLifecycleSnapshot(...)`
- `persistGatewaySessionLifecycleEvent(...)`

Behavior:
- phase `start` ⇒ `status: "running"`, updates `startedAt`, clears `endedAt`
- phase `error` ⇒ terminal `status: "failed"`
- phase `end` with stopReason `aborted` ⇒ terminal `status: "killed"`
- phase `end` with `data.aborted === true` ⇒ terminal `status: "timeout"`
- otherwise phase `end` ⇒ terminal `status: "done"`
- terminal phases set `endedAt`, `runtimeMs`, and `updatedAt`

So the real completion signal is **not** “session disappears”; it is:
- `sessions.changed.phase === "end" | "error"`
- and persisted `session.status` becoming one of:
  - `done`
  - `failed`
  - `killed`
  - `timeout`

## 4) Timestamps available

Available on `sessions.list` rows and `sessions.changed` snapshots:
- `updatedAt`
- `startedAt`
- `endedAt`
- `runtimeMs`

Available on `sessions.changed` envelope:
- `ts`

Not available on `sessions.list` rows:
- `lastActivityAt`
- `age`

There is a `lastActivityAt` field under `SessionAcpMeta` in `/usr/local/lib/node_modules/openclaw/dist/plugin-sdk/src/config/sessions/types.d.ts`, but that is ACP-specific metadata and is **not surfaced on `GatewaySessionRow` / `sessions.list`**.

---

## What OCC is doing today

## `src/stores/sessionsStore.ts`

### Good
- Normalizes `startedAt`, `endedAt`, `runtimeMs`, `updatedAt`, `status`
- Refreshes authoritatively by calling `gatewayClient.sessionsList(...)`
- Auto-registers crew on `sessions.changed`
- Reconciles crew registry from authoritative session list

### Problem 1: `sessions.changed` is not used as an activity signal
Current handler:

```ts
gatewayClient.onEvent('sessions.changed', (frame) => {
  const changedSession = extractSessionFromChangedEvent(frame);
  if (changedSession) {
    useCrewRegistryStore.getState().autoRegisterFromSession(changedSession);
  }

  get().refreshSessions().catch(...)
});
```

This only refreshes. OCC is not storing “this crew was active at time X”.

### Problem 2: `inferStatus()` relies on nonexistent/weak signals
Current logic:
- text match on `session.kind` / flags for `active`, `running`, `stream`, `idle`, `waiting`
- fallback to `session.age`

But current OpenClaw session rows provide `status` values like:
- `running`
- `done`
- `failed`
- `killed`
- `timeout`

They do **not** provide a first-class `idle` state, and `age` is not defined in the current gateway row type.

So all-green behavior is expected: OCC has no durable idle heuristic.

## `src/stores/crewRegistryStore.ts`

Current registry tracks:
- `spawnedAt`
- `completedAt`
- `status`
- `lastSeenAt`

But `lastSeenAt` is updated whenever the registry entry is touched, not specifically when the underlying session shows new work. That makes it poor as an idle detector by itself.

## `src/components/crew/CrewCard.tsx`

Current display supports:
- `active`
- `idle`
- `error`
- `offline`

So the UI is already capable of showing yellow idle. The missing piece is store logic, not rendering.

---

## Recommended detection mechanism

## Summary
Use a **local OCC activity model** built from OpenClaw session timestamps and lifecycle events:

- **Active (green)**
  - session status is `running`
  - and the session has shown recent activity within an idle threshold
- **Idle (yellow)**
  - session still exists
  - session is **not terminal**
  - but no activity has been observed for the idle threshold
- **Offline (gray)**
  - no matching session/registration exists, or
  - session is terminal: `done`, `killed`, `timeout`
- **Error (red/gray depending current styling)**
  - session status is `failed`

## Why this works
Because OpenClaw *does* give us enough to know:
1. when a run starts (`phase: start`, status `running`)
2. when a run ends/errors (`phase: end|error`, terminal persisted status)
3. when the session was last updated (`updatedAt`)

What OpenClaw does **not** give is a native idle state. So OCC must derive idle based on **lack of recent updates while still non-terminal**.

That is normal. Annoying, yes, but survivable. Civilization continues.

---

## The actual idle signal OCC should use

Track **per-session last meaningful activity timestamp** in OCC.

Update it when either of these changes:
- `sessions.changed` event for that session with `phase: start`
- `sessions.list` shows `updatedAt` increased
- optional stronger signal: `totalTokens`, `inputTokens`, `outputTokens`, or `runtimeMs` changed

### Recommended `lastActiveAt` rule
For each session row, derive activity like this:

1. If a fresh `sessions.changed` event arrives:
   - set `lastActiveAt = event.ts`
2. On each authoritative `sessions.list` refresh:
   - compare current row vs previous row for same `session.key`
   - if any of these changed, set `lastActiveAt = now`:
     - `updatedAt`
     - `totalTokens`
     - `inputTokens`
     - `outputTokens`
     - `runtimeMs`
     - `status`
3. Seed initial `lastActiveAt` from available timestamps:
   - `endedAt ?? updatedAt ?? startedAt ?? Date.now()`

This avoids relying only on token counters, which may not change every moment, and avoids relying only on `updatedAt` in case some backends batch updates strangely.

---

## Status mapping OCC should use

For each crew member’s primary session:

### Terminal/error first
- `status === "failed"` → `error`
- `status === "done" || status === "killed" || status === "timeout"` → `offline`

### Running sessions
If `status === "running"`:
- if `now - lastActiveAt < IDLE_THRESHOLD_MS` → `active`
- else → `idle`

### Sessions with no status / older compatibility cases
If row exists but no terminal status:
- if `now - lastActiveAt < IDLE_THRESHOLD_MS` → `active`
- else → `idle`

### No session row, but registry entry exists
If there is no current session row:
- if latest registry status is `error` → `error`
- else → `offline`

---

## Idle threshold recommendation

## Recommended default: **2 minutes** (`120000 ms`)

Why 2 minutes:
- long enough to avoid flicker during tool calls, stream pauses, or gateway batching
- short enough that a finished-but-still-listed session won’t stay green forever
- matches the current OCC heuristic spirit (`<= 120000` was previously treated as active using `age`)

### Optional tuning
- **90s** if you want more responsive yellowing
- **180s** if some models often pause for a long time during heavy tool work

My recommendation: start at **120s**, make it a constant.

---

## Implementation plan for OCC

## 1) Extend session state with local activity tracking

In `src/stores/sessionsStore.ts`, add something like:

```ts
type SessionActivityMap = Record<string, number>; // key -> lastActiveAt
```

Store fields:

```ts
sessionActivityByKey: SessionActivityMap;
```

## 2) Record activity on `sessions.changed`

In the `sessions.changed` handler:
- if payload has `sessionKey`, update `sessionActivityByKey[sessionKey] = frame.payload.ts || Date.now()`
- then refresh sessions as today

Important: use the event timestamp from OpenClaw when present.

## 3) Record activity during `refreshSessions()` diffing

When new `sessions` arrive:
- compare each row to previous `sessionsByKey[key]`
- if any meaningful fields changed, bump `sessionActivityByKey[key]`

Recommended comparison fields:
- `updatedAt`
- `status`
- `runtimeMs`
- `totalTokens`
- `inputTokens`
- `outputTokens`

If a session is new, seed from:
- `endedAt ?? updatedAt ?? startedAt ?? Date.now()`

If a session becomes terminal, leave `lastActiveAt` as-is; status logic will map terminal to offline/error.

## 4) Replace `inferStatus(session)` with `inferStatus(session, lastActiveAt)`

Suggested logic:

```ts
function inferStatus(session: Session, lastActiveAt?: number): CrewMember['status'] {
  const status = (session.status || '').toLowerCase();

  if (status === 'failed') return 'error';
  if (status === 'done' || status === 'killed' || status === 'timeout') return 'offline';

  const now = Date.now();
  const activeAt = lastActiveAt
    ?? session.updatedAt
    ?? session.startedAt
    ?? 0;

  if (now - activeAt < 120000) return 'active';
  return 'idle';
}
```

Key point: use **`session.status`**, not `session.kind`, as the primary source. `kind` in gateway rows is session classification (`direct/group/global/unknown`), not runtime activity.

## 5) Pass `lastActiveAt` into crew display building

In `buildCrewDisplayState(sessions)`:
- when selecting the latest session for a crew member, also read `sessionActivityByKey[session.key]`
- feed that into `inferStatus(...)`

## 6) Keep `crewRegistryStore` for identity/ownership, not idle truth

Registry should continue to handle:
- spawn intent
- confirm registration
- model/fallback tracking
- task association

But **idle/active** should come from session activity, not registry `lastSeenAt`, because registry touches do not equal work.

## 7) No UI overhaul required

`CrewCard.tsx` already renders `[ACTIVE]`, `[IDLE]`, `[OFFLINE]`, `[ERROR]`.

If desired, make idle visually explicit by changing the status text color for `idle` to OCC yellow, but that is optional.

---

## Why this will actually work

1. **OpenClaw exposes terminal state**
   - `done`, `failed`, `killed`, `timeout`
   - plus `endedAt` and `runtimeMs`
   - so OCC can reliably stop showing finished work as active

2. **OpenClaw exposes `updatedAt`**
   - which is sufficient as a heartbeat-like freshness signal
   - even though there is no dedicated `lastActivityAt`

3. **`sessions.changed` provides lifecycle timestamps**
   - `phase`, `ts`, `runId`, `sessionKey`
   - enough to bump activity immediately at run start/end without waiting for a polling refresh

4. **OCC already has the right architecture**
   - authoritative session refresh
   - per-crew registry mapping
   - UI states for active/idle/offline/error

So this is not a speculative redesign. It is a small, source-backed correction:
- stop using `kind`/`age` as activity truth
- start using `status` + `updatedAt` + local `lastActiveAt`

---

## Concrete recommendation

## Final status algorithm

### Green / Active
- session exists
- `session.status === "running"` or non-terminal
- `Date.now() - lastActiveAt < 120000`

### Yellow / Idle
- session exists
- not terminal / not failed
- `Date.now() - lastActiveAt >= 120000`

### Gray / Offline
- no current session, or
- `session.status` is `done`, `killed`, or `timeout`

### Error
- `session.status === "failed"`

---

## Specific OCC code issues to fix

1. **`normalizeSession()` currently sets `kind` from `candidate.kind || candidate.status`**
   - that conflates session kind and runtime status
   - OCC should prefer `status` for lifecycle state

2. **`inferStatus()` should not inspect `session.kind` for running/idle**
   - `kind` is `direct/group/global/unknown` in OpenClaw

3. **`inferStatus()` should stop relying on `session.age`**
   - current OpenClaw gateway row type does not expose `age`

---

## Minimal implementation sequence

1. Add `sessionActivityByKey` to `sessionsStore`
2. Update it on `sessions.changed`
3. Diff authoritative session rows during `refreshSessions()` and bump activity timestamps on changes
4. Rewrite `inferStatus()` to use:
   - `session.status`
   - `lastActiveAt`
   - `updatedAt/startedAt` fallback
5. Keep terminal sessions gray, failed sessions error, stale non-terminal sessions yellow

That will give OCC the behavior the user wants, using signals OpenClaw really emits instead of imaginary ones.
