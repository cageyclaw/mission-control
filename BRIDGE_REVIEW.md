# Bridge Crew Spawn-to-Registry Bridge Review

Request reviewed: `6d33f1a2-e7ec-42ff-8c19-23468bed3cd2`

## Verdict

**Mostly working in the primary spawn-helper path.**
If crew are spawned through `src/utils/spawnCrew.ts`, and the spawn result returns `sessionId` and/or `sessionKey`, the new sidecar bridge + registry polling should register them and **they should appear in the Bridge Crew panel**.

**Not fully working in the intended fallback/reconciliation path.**
The claimed “requestId extraction from session metadata” is **not actually implemented against a metadata object**, so if confirmation depends on recovering `requestId` from session metadata later, that path is currently fragile/broken.

---

## What’s working

### 1) Sidecar endpoints are coherent and usable
File: `system-metrics-server/server.mjs`

- `POST /spawn-intent` creates a UUID request ID and stores a pending intent.
- `POST /spawn-confirm` upgrades the request to confirmed and attaches session/model/fallback info.
- `GET /spawn-status` supports:
  - lookup by `requestId`
  - event polling via `sinceCursor`
  - counts for pending/confirmed
- Event cursoring is straightforward and good enough for in-memory v1.
- Old records/events are pruned, so the sidecar won’t grow forever.

Relevant lines:
- intent: `server.mjs:273-302`
- confirm: `server.mjs:304-334`
- status polling: `server.mjs:336-360`

### 2) OCC registry polling is wired correctly
File: `src/stores/crewRegistryStore.ts`

- Polling fetches `/spawn-status?sinceCursor=...` and processes incremental events.
- `intent` events call `registerPendingSpawn(...)`.
- `confirm` events call `confirmRegistration(...)`.
- Fallback state from confirm events is carried into the registry.
- `startSpawnRegistryBridgePolling()` is guarded by `spawnBridgeStarted`, so duplicate starts are avoided.

Relevant lines:
- registry merge logic: `crewRegistryStore.ts:108-167`
- bridge polling: `crewRegistryStore.ts:242-292`
- start/stop polling: `crewRegistryStore.ts:294-320`

### 3) Spawn helper correctly seeds the bridge flow
File: `src/utils/spawnCrew.ts`

- It opens with `/spawn-intent` before the actual spawn.
- It embeds the request ID in multiple places:
  - label: `"[req:xxxxxxxx]"`
  - task prefix: `"[crew:<id> request:<uuid>]"`
  - metadata: `{ crewId, requestId, fallbackAttempt }`
- It tries configured fallback models in order.
- After a successful spawn, it calls `/spawn-confirm` with `requestId`, `sessionId`, `sessionKey`, `modelActive`, and fallback info.

Relevant lines:
- model plan / fallbacks: `spawnCrew.ts:24-30`, `82-100`
- request ID embedding: `spawnCrew.ts:85-94`
- confirm call: `spawnCrew.ts:109-121`

### 4) Bridge panel attribution should now work for registered spawns
Files: `src/stores/gateway.ts`, `src/stores/__tests__/crewRegistry.test.ts`

- `gateway.ts` now refuses to auto-attribute arbitrary unregistered subagent sessions.
- It uses explicit registry matches first, which is the correct behavior.
- The existing regression test passes and confirms:
  - Q main session still works
  - registered Geordi session appears
  - unregistered subagent does **not** get falsely attributed

Relevant lines:
- registration-first matching: `gateway.ts:319-334`
- status mapping to crew panel: `gateway.ts:336-374`
- test: `src/stores/__tests__/crewRegistry.test.ts`

---

## What’s broken or incomplete

### 1) “requestId extraction from session metadata” is not actually reading metadata
File: `src/stores/gateway.ts`

`extractRequestIdFromSession()` only looks at:
- `session.flags`
- `session.requestId`
- `session.task`
- `session.label`

It does **not** inspect `session.metadata` (or any nested metadata object), despite the review target explicitly calling out metadata-based reconciliation.

Relevant lines:
- `gateway.ts:190-203`

Why this matters:
- `spawnCrew.ts` does send `metadata: { requestId, crewId, fallbackAttempt }`.
- But `extractRequestIdFromSession()` never reads a metadata object.
- So if the only durable place the gateway exposes the request ID is metadata, reconciliation will fail.

### 2) Reconciliation depends on fields that may not survive normalization / transport
Files: `src/stores/gateway.ts`, `src/api/types.ts`, `src/stores/sessionsStore.ts`

`gateway.ts` casts `session` to a wider shape and tries to read `task` and `label`, but the formal `Session` type only contains:
- `agentId`, `key`, `kind`, `sessionId`, token fields, `model`, `flags`, etc.

Relevant lines:
- `gateway.ts:196-199`
- `api/types.ts` `Session` interface

So the reconciliation fallback is only reliable if `status.sessions.recent` truly carries extra ad hoc properties at runtime. That may happen, but it is not strongly wired or normalized.

### 3) `spawn-confirm` response is not validated by the client
File: `src/utils/spawnCrew.ts`

The helper sends `/spawn-confirm` but does not check `response.ok`.

Relevant lines:
- `spawnCrew.ts:109-121`

Impact:
- If confirm fails, spawn still returns success to the caller.
- That can leave the crew session running but unregistered in the Bridge UI.

### 4) Fallback count is underreported for deeper fallback chains
File: `src/utils/spawnCrew.ts`

`fallbackCount` is sent as:
- `0` when first model works
- `1` when any fallback works

Relevant lines:
- `spawnCrew.ts:118-119`

If the third or fourth model succeeds, the actual number of fallback attempts is larger than `1`, but the bridge records only `1`.

### 5) Bridge polling auto-starts during `gateway.updateStatus()` and causes noisy test/runtime coupling
Files: `src/stores/gateway.ts`, `src/App.tsx`

Polling is started in both places:
- `App.tsx:39`
- `gateway.ts:277-281`

The internal guard prevents duplicate timers, so this is not catastrophic. But it does create awkward coupling.

In the regression test, this produces a warning because `getSettings()` expects browser globals:
- test passed, but stderr showed `window is not defined` from spawn bridge polling.

This is not a production blocker, just a cleanliness issue.

---

## Do crew members now appear in the Bridge Crew panel when spawned?

### Yes — in the main intended path
**They should appear now** when all of the following are true:
1. spawn goes through `src/utils/spawnCrew.ts`
2. `/spawn-intent` succeeds
3. the actual spawn succeeds
4. the spawn result includes a usable `sessionId` and/or `sessionKey`
5. `/spawn-confirm` reaches the sidecar
6. the UI is polling `/spawn-status`

That happy path is implemented correctly enough for the panel to light up.

### But not guaranteed in metadata-only recovery scenarios
If a spawned session does **not** return usable `sessionId/sessionKey` during confirm, and later reconciliation is supposed to recover the request ID from **session metadata**, then **no, that part is not reliably working yet**.

So the honest answer is:
- **Bridge Crew panel visibility: yes for confirmed spawns via the helper**
- **Metadata-only reconciliation fallback: not fully implemented**

---

## Recommended fixes

1. **Actually read `session.metadata` in `extractRequestIdFromSession()`**
   - Check `session.metadata.requestId`
   - Also consider nested payloads if the gateway wraps metadata

2. **Validate `/spawn-confirm` response**
   - Throw or at least log hard when confirm fails

3. **Send real fallback attempt count**
   - Use `i` instead of boolean `fallbackUsed ? 1 : 0`

4. **Decide on one place to start bridge polling**
   - Prefer app bootstrap or gateway bootstrap, not both

5. **Add one test for metadata-only reconciliation**
   - Simulate a session that has requestId in metadata but no pre-confirmed registry match
   - Verify it becomes attributed to the correct crew member

---

## Bottom line

**What Geordi built is good enough to make Bridge Crew panel registration work for the normal spawn-helper flow.**

**What Geordi did not fully finish is the advertised metadata-based reconciliation fallback.** That part still has a hole large enough to fly a shuttlecraft through.
