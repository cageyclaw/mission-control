# OpenClaw ↔ OCC Integration Analysis: Live Bridge Crew Spawn Visibility

## Executive Summary

The root problem is **not** that OpenClaw fails to emit real-time subagent spawn events over the gateway.

OpenClaw **already does** expose subagent lifecycle changes over WebSocket as `sessions.changed` events, including subagent creation metadata such as:
- `reason`
- `sessionKey`
- `sessionId`
- `label`
- `parentSessionKey`
- `subagentRole`
- `status`
- `startedAt` / `endedAt` / `runtimeMs`

OCC is already:
- connecting via `NativeGatewayClient`
- subscribing with `sessions.subscribe`
- receiving `sessions.changed`
- refreshing `sessions.list`

But OCC still only shows Q because its own attribution logic intentionally refuses to show subagent sessions unless they are explicitly registered in the crew registry.

That registry is never authoritatively populated from the gateway events OCC already has.

## Conclusion

### Recommended solution
**Fix OCC, not OpenClaw core.**

Implement an OCC-side authoritative registration path that:
1. listens to `sessions.changed`
2. detects subagent creation / lifecycle events
3. maps gateway session metadata to a `crewId` using `label` (and optionally `displayName`)
4. calls `useCrewRegistryStore.getState().confirmRegistration(...)` automatically
5. also reconciles from `sessions.list` on startup/reconnect so missed events are recovered

This works **without**:
- importing `sessions_spawn`
- wrapping tool calls
- sidecar confirmation hops
- manual approval per spawn
- breaking changes to OpenClaw

---

## What I verified in OpenClaw

## 1) `sessions_spawn` / subagent creation already emits lifecycle events

### Source
**File:** `/usr/local/lib/node_modules/openclaw/dist/pi-embedded-bukGSgEe.js`

### Verified behavior
OpenClaw emits a session lifecycle event immediately after subagent/session creation:

```js
emitSessionLifecycleEvent({
  sessionKey: childSessionKey,
  reason: "create",
  parentSessionKey: requesterInternalKey,
  label: label || void 0
});
```

This occurs in the subagent spawn path just after the child session/run is registered.

### Why this matters
This is the exact real-time signal OCC needs when a crew member spawns.

---

## 2) OpenClaw gateway already forwards lifecycle events over WebSocket

### Source
**File:** `/usr/local/lib/node_modules/openclaw/dist/gateway-cli-6Ksv5U_O.js`

### Verified behavior
The gateway subscribes to internal lifecycle events with `onSessionLifecycleEvent(...)` and broadcasts them to WebSocket clients as `sessions.changed`:

```js
lifecycleUnsub = minimalTestGateway ? null : onSessionLifecycleEvent((event) => {
  const connIds = sessionEventSubscribers.getAll();
  if (connIds.size === 0) return;
  const sessionRow = loadGatewaySessionRow(event.sessionKey);
  broadcastToConnIds("sessions.changed", {
    sessionKey: event.sessionKey,
    reason: event.reason,
    parentSessionKey: event.parentSessionKey,
    label: event.label,
    displayName: event.displayName,
    ts: Date.now(),
    ...sessionRow ? {
      updatedAt: sessionRow.updatedAt ?? void 0,
      sessionId: sessionRow.sessionId,
      kind: sessionRow.kind,
      ...
      subagentRole: sessionRow.subagentRole,
      label: event.label ?? sessionRow.label,
      displayName: event.displayName ?? sessionRow.displayName,
      parentSessionKey: event.parentSessionKey ?? sessionRow.parentSessionKey,
      ...
      status: sessionRow.status,
      startedAt: sessionRow.startedAt,
      endedAt: sessionRow.endedAt,
      runtimeMs: sessionRow.runtimeMs
    } : {}
  }, connIds, { dropIfSlow: true });
});
```

### Why this matters
OCC’s assumption that lifecycle events are not exposed over WebSocket is incorrect for the installed OpenClaw build I inspected.

They are exposed as `sessions.changed`.

---

## 3) `sessions.list` already includes the identity fields OCC needs

### Source
**File:** `/usr/local/lib/node_modules/openclaw/dist/session-utils-Jgzk2Bo-.js`

### Verified behavior
`buildGatewaySessionRow(...)` includes:

```js
return {
  key,
  spawnedBy: subagentOwner || entry?.spawnedBy,
  spawnedWorkspaceDir: entry?.spawnedWorkspaceDir,
  forkedFromParent: entry?.forkedFromParent,
  spawnDepth: entry?.spawnDepth,
  subagentRole: entry?.subagentRole,
  subagentControlScope: entry?.subagentControlScope,
  kind: classifySessionKey(key, entry),
  label: entry?.label,
  displayName,
  ...
  sessionId: entry?.sessionId,
  status: subagentRun ? subagentStatus : entry?.status,
  startedAt: subagentRun ? subagentStartedAt : entry?.startedAt,
  endedAt: subagentRun ? subagentEndedAt : entry?.endedAt,
  runtimeMs: subagentRun ? subagentRuntimeMs : entry?.runtimeMs,
  parentSessionKey: subagentOwner || entry?.parentSessionKey,
  ...
};
```

And `listSessionsFromStore(...)` returns those rows as `sessions`.

### Why this matters
Even if OCC misses a real-time `sessions.changed` event, it can recover from `sessions.list` after reconnect/startup.

---

## 4) OpenClaw event scopes already allow `sessions.changed`

### Source
**File:** `/usr/local/lib/node_modules/openclaw/dist/gateway-cli-6Ksv5U_O.js`

### Verified behavior
`EVENT_SCOPE_GUARDS` includes:

```js
"sessions.changed": [READ_SCOPE]
```

### Why this matters
No protocol or permission extension is required for an operator-read OCC client.

---

## What I verified in OCC

## 5) OCC already subscribes to session events correctly

### Source
**File:** `src/core/gatewayClient/gatewayClient.ts`

### Verified behavior
OCC provides:
- `sessionsSubscribe()` → RPC `sessions.subscribe`
- `sessionsList()` → RPC `sessions.list`
- event dispatch via `onEvent(eventName, listener)`

### Source
**File:** `src/stores/sessionsStore.ts`

### Verified behavior
On init OCC does:

```ts
await gatewayClient.connect();
await gatewayClient.sessionsSubscribe();
await get().refreshSessions();
```

And it wires:

```ts
gatewayClient.onEvent('sessions.changed', () => {
  get().refreshSessions().catch(...)
});
```

### Why this matters
The transport path is already live.

---

## 6) OCC drops unregistered subagent sessions on purpose

### Source
**File:** `src/stores/sessionsStore.ts`

### Verified behavior
Crew attribution is registry-gated:

```ts
function mapSessionToCrewId(session: Session): string | null {
  const registry = useCrewRegistryStore.getState();
  const reg = registry.getRegistrationBySession(session.sessionId, session.key);
  if (reg) return reg.crewId;

  const mainCrew = getCrewConfig().crew.find((c) => c.isMainSession);
  if (mainCrew && session.key.includes(':main') && !session.key.includes('subagent')) {
    return mainCrew.id;
  }

  // Never auto-attribute unregistered subagents.
  return null;
}
```

### Why this matters
This is why Q appears and everyone else vanishes.

Not because sessions are absent — because they are not registered.

---

## 7) OCC ignores the gateway metadata needed to fix this

### Source
**File:** `src/api/types.ts`

### Verified behavior
The `Session` interface only includes:
- `agentId`
- `key`
- `kind`
- `sessionId`
- token fields
- `model`
- `flags`

It does **not** include:
- `label`
- `displayName`
- `parentSessionKey`
- `spawnedBy`
- `subagentRole`
- `status`
- `startedAt`
- `endedAt`
- `runtimeMs`

### Source
**File:** `src/stores/sessionsStore.ts`

### Verified behavior
`normalizeSession(...)` discards those same fields.

### Why this matters
OCC refreshes from gateway state, but strips away the very metadata that identifies a spawned crew member.

---

## 8) Existing sidecar bridge is unnecessary for the primary fix

### Source
**File:** `src/stores/crewRegistryStore.ts`

### Verified behavior
The spawn bridge polls a sidecar endpoint:

```ts
fetch(`${base}/spawn-status?sinceCursor=${spawnBridgeCursor}`)
```

and only then calls:
- `registerPendingSpawn(...)`
- `confirmRegistration(...)`

### Why this matters
That design depends on an out-of-band confirm step. The gateway already has authoritative session identity data, so this extra loop is redundant for the live visibility problem.

---

## Root Cause

OCC was built around `spawnBehavior: 'explicitRegistration'` and therefore refuses to infer subagent crew identity heuristically.

That is fine.

The bug is that OCC is **not using the authoritative identity metadata it already receives from OpenClaw**.

Specifically:
- OpenClaw emits lifecycle → gateway forwards `sessions.changed`
- OCC refreshes `sessions.list`
- OCC strips `label` / `parentSessionKey` / `subagentRole`
- OCC never auto-confirms registry entries from those authoritative gateway fields
- therefore only the main session (Q) is visible

---

## Recommended Solution

# Option 1 — Recommended: OCC-only fix using existing gateway events

No OpenClaw core change required.

## Implementation strategy

### A. Treat gateway session metadata as authoritative registration input
When OCC receives a `sessions.changed` event with:
- `reason === 'create'` or `reason === 'subagent-status'`
- `subagentRole` present, or `kind`/`key` indicates subagent
- `label` matching a configured crew member name

it should automatically confirm/update crew registry state.

### B. Also reconcile from `sessions.list`
On startup/reconnect/full refresh, OCC should scan sessions returned by `sessions.list` and auto-register any recognized crew subagent sessions it has not yet mapped.

This makes the system resilient to:
- reconnects
- missed event frames
- browser refreshes
- app restarts

---

## Exact OCC changes required

## 1) Expand session model to preserve gateway identity fields

### File
`src/api/types.ts`

### Add fields to `Session`
At minimum:
- `label?: string`
- `displayName?: string`
- `parentSessionKey?: string`
- `spawnedBy?: string`
- `subagentRole?: string`
- `status?: string`
- `startedAt?: number`
- `endedAt?: number`
- `runtimeMs?: number`

Optional but useful:
- `spawnDepth?: number`
- `spawnedWorkspaceDir?: string`
- `modelProvider?: string`

---

## 2) Preserve those fields in normalization

### File
`src/stores/sessionsStore.ts`

### Function
`normalizeSession(raw: unknown): Session | null`

### Required change
Parse and keep:
- `label`
- `displayName`
- `parentSessionKey`
- `spawnedBy`
- `subagentRole`
- `status`
- `startedAt`
- `endedAt`
- `runtimeMs`

Today OCC discards them.

---

## 3) Add authoritative auto-registration from gateway session data

### File
`src/stores/sessionsStore.ts`

### Add helper functions
Suggested helpers:
- `resolveCrewIdFromGatewaySession(session: Session): string | null`
- `reconcileAuthoritativeCrewRegistrations(sessions: Session[]): void`
- `reconcileAuthoritativeCrewRegistrationFromEvent(frame: GatewayEventFrame): void`

### Matching rule
Use configured crew names from `src/config/crewConfig.ts`.

Example deterministic mapping:
- `label === 'Data'` → `crewId = 'data'`
- `label === 'Geordi'` → `crewId = 'geordi'`
- etc.

Use exact case-insensitive name matching first.
Do **not** try vague heuristics beyond that.

### Recommended registration logic
For each subagent session with recognized crew label:

```ts
registry.confirmRegistration({
  sessionId: session.sessionId,
  sessionKey: session.key,
  modelActive: session.model,
});

registry.updateRegistration(session.sessionId, {
  crewId,                // only if helper writes via dedicated method or merged base
  status: mappedStatus,
  modelActive: session.model,
  spawnedAt: session.startedAt ?? session.updatedAt ?? Date.now(),
  source: 'reconciled',
});
```

Because current `confirmRegistration(...)` derives base metadata from pending queues or existing entries, you will likely want one of these two approaches:

### Preferred
Add a new registry method:
- `upsertAuthoritativeRegistration(input)`

### File
`src/stores/crewRegistryStore.ts`

### Why
`confirmRegistration(...)` assumes a prior pending spawn.
Your new path needs to create a registration directly from authoritative gateway data, even when no pending intent exists.

### Suggested shape
```ts
upsertAuthoritativeRegistration({
  sessionId,
  sessionKey,
  crewId,
  task,
  modelRequested,
  modelActive,
  spawnedAt,
  status,
  source: 'reconciled',
})
```

This is the cleanest OCC-side fix.

---

## 4) Wire event-driven registration before refresh-only logic

### File
`src/stores/sessionsStore.ts`

### Current code
```ts
gatewayClient.onEvent('sessions.changed', () => {
  get().refreshSessions().catch(...)
});
```

### Change
Handle the payload first, then refresh:

```ts
gatewayClient.onEvent('sessions.changed', (frame) => {
  reconcileAuthoritativeCrewRegistrationFromEvent(frame);
  get().refreshSessions().catch(...);
});
```

### Why
This gives immediate crew visibility on spawn before or alongside the list refresh.

---

## 5) Reconcile from full list during refresh

### File
`src/stores/sessionsStore.ts`

### Function
`refreshSessions()`

### Add step
After `const sessions = extractSessionsPayload(payload);`
run:

```ts
reconcileAuthoritativeCrewRegistrations(sessions);
```

### Why
This repairs missed events and survives reconnects.

---

## 6) Keep the sidecar bridge only as optional legacy fallback

### File
`src/stores/crewRegistryStore.ts`

### Recommendation
Do not delete immediately, but demote it.

Use gateway-authoritative registration as primary.
Leave sidecar polling disabled by default or as fallback only if you still want to support old flows.

---

## Why this will actually work

Because it aligns exactly with the verified runtime behavior:

1. **Subagent spawn emits internal lifecycle event**
   - verified in `pi-embedded-bukGSgEe.js`
2. **Gateway forwards that as `sessions.changed`**
   - verified in `gateway-cli-6Ksv5U_O.js`
3. **OCC already subscribes to `sessions.changed`**
   - verified in `gatewayClient.ts` and `sessionsStore.ts`
4. **Gateway `sessions.list` already includes `label`, `parentSessionKey`, `subagentRole`, `status`**
   - verified in `session-utils-Jgzk2Bo-.js`
5. **OCC currently hides subagents only because registry attribution is missing**
   - verified in `sessionsStore.ts`

So the missing link is simple:

> consume the gateway’s authoritative metadata and write it into OCC’s explicit registry.

No manual confirmation. No tool import. No wrapper. No brittle polling bridge required.

---

## Exact OpenClaw changes required

## For the recommended solution
**None required.**

That is the point.

OpenClaw already emits what OCC needs.

---

## Optional OpenClaw improvements (not required)

If you want a cleaner upstream contract later, these are valid but optional:

### Option A: add dedicated event name
Instead of overloading `sessions.changed`, OpenClaw could also emit something like:
- `session.lifecycle`
- `subagent.spawned`

### Files involved
- internal lifecycle emitter path in `src/sessions/session-lifecycle-events.ts` (bundled into `pi-embedded-bukGSgEe.js`)
- gateway lifecycle forwarding path in `src/gateway/...` (bundled into `gateway-cli-6Ksv5U_O.js`)

### Why optional only
It is nicer, but not necessary. OCC already has enough signal.

---

## Alternative approaches considered and rejected

## Rejected 1 — OpenClaw PR to expose lifecycle events over WebSocket

### Rejection reason
OpenClaw already does this in the installed build.

So a PR for the core visibility problem would be solving the wrong problem.

---

## Rejected 2 — Poll only `sessions.list` and match by label, without registry integration

### Rejection reason
This would still fight OCC’s explicit-registration design.

You need to write to the registry so the rest of OCC (`sessionsStore`, `gateway`, `activityFeedStore`) sees a consistent mapping.

Polling/list reconciliation is good as a recovery mechanism, not as a replacement for registry writes.

---

## Rejected 3 — Sidecar `/spawn-intent` → `/spawn-confirm` as primary architecture

### Rejection reason
It duplicates information the gateway already exposes.
It requires an extra out-of-band confirmation path.
It is more fragile than consuming the authoritative event source directly.

Keep only as fallback if desired.

---

## Rejected 4 — Import or wrap `sessions_spawn`

### Rejection reason
You already confirmed the core issue: `sessions_spawn` is a tool, not an importable app API in your environment.
Even if it were wrappable, that would only catch spawns initiated from one surface.
It would not solve spawns initiated elsewhere.

---

## Step-by-step implementation plan

## Phase 1 — Minimal working fix

### OCC
1. Update `src/api/types.ts` to include gateway identity fields.
2. Update `src/stores/sessionsStore.ts::normalizeSession()` to preserve them.
3. Add `upsertAuthoritativeRegistration(...)` to `src/stores/crewRegistryStore.ts`.
4. Add `resolveCrewIdFromGatewaySession()` in `src/stores/sessionsStore.ts` using exact crew name ↔ label matching from `getCrewConfig().crew`.
5. In `gatewayClient.onEvent('sessions.changed', frame => ...)`, inspect payload and upsert registration for recognized subagent sessions.
6. In `refreshSessions()`, reconcile all recognized subagent sessions from `sessions.list`.
7. Verify Data/Geordi/Riker/Troi/Barclay appear immediately when spawned.

## Phase 2 — Hardening

1. Prefer `startedAt` over `updatedAt` for `spawnedAt` when available.
2. Update registry status from gateway `status` directly when present.
3. Handle completion/error transitions from later `sessions.changed` events.
4. Add unit tests for:
   - spawn event → registry entry created
   - reconnect/list refresh → registry reconstructed
   - unknown label → ignored
   - Q main session still handled separately

## Phase 3 — Optional cleanup

1. Disable sidecar spawn bridge by default.
2. Remove old requestId-based confirmation path if no longer needed.
3. Keep bridge only if you still need compatibility with older builds or nonstandard spawn flows.

---

## Suggested test cases

1. **Spawn Geordi with label `Geordi`**
   - Expect `sessions.changed` with `reason: 'create'`
   - Expect registry upsert for `crewId: 'geordi'`
   - Expect crew UI shows Geordi active

2. **Refresh OCC after Geordi already exists**
   - Expect `sessions.list` reconciliation rebuilds Geordi registration
   - Expect Geordi still visible without needing a fresh event

3. **Spawn unknown label**
   - Expect no crew assignment
   - Expect session remains unmapped

4. **Completion lifecycle**
   - Expect later `sessions.changed`/list refresh updates registry status to completed/error

---

## Final Recommendation

Implement the fix in **OCC only**.

### Do this now
- Preserve gateway session identity fields
- Auto-upsert crew registry entries from `sessions.changed` and `sessions.list`
- Match crew by exact configured label/name
- Keep explicit-registration policy, but satisfy it from authoritative gateway data instead of manual sidecar confirmation

### Do not do this now
- Do not build a new spawn wrapper around `sessions_spawn`
- Do not make sidecar confirm the primary path
- Do not open an OpenClaw PR for the live-spawn visibility issue unless you want protocol cleanup for aesthetic reasons

The gateway is already telling OCC about spawned crew.
OCC just isn’t listening intelligently enough. A tragic little software misunderstanding. Fortunately, I have now corrected reality.
