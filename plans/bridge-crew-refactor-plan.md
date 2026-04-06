# Bridge Crew Live Data Refactor Plan (Explicit Registration)

## 0) Executive Summary

Current bug: OCC only reliably shows **Q** because crew mapping depends on `agentId`/model heuristics.

Refactor target: shift to **explicit registration at spawn time** and make OCC use a canonical `sessionId -> crewId` registry. Model is display metadata, not identity.

Key outcomes:
- Deterministic crew membership for all spawned subagents
- Correct UI state for Data/Geordi/Spark/Riker/Troi/Barclay
- First-class fallback model visibility
- Runtime-safe config loading and hot reload support
- Removal of identity ambiguity when multiple crew use the same model or when fallback models overlap

## 0.1) Critical success criteria

This refactor only solves the current bug if all of the following are true:
1. **Registration happens in the same spawn flow that receives the created session identifiers** — not via later inference.
2. **OCC renders crew from config + registry**, not from model-derived detection.
3. **The main session (Q) is represented explicitly**, not as a special heuristic-only exception.
4. **Unregistered sessions are never auto-attributed to a crew member**.

If any of those remain heuristic-driven, the panel can still regress into showing only Q or mis-assigning crew.
---

## 1) Config System

## 1.1 Source of truth
- File: `crew-config.json` (already created)
- Add a loader module in OCC that reads and validates this config once at startup and optionally on file change.

## 1.2 Proposed types

```ts
export interface CrewConfig {
  version: string;
  spawnBehavior: 'explicitRegistration';
  fallbackBehavior: {
    retryDefault: number;
    fallbackDelayMs: number;
    notifyOnFallback: boolean;
  };
  crew: Array<{
    id: string;
    name: string;
    emoji: string;
    role: string;
    description?: string;
    isMainSession?: boolean;
    defaultModel?: string;
    fallbackModels?: string[];
  }>;
}
```

## 1.3 Validation strategy
- Use schema validation (recommended: `zod`) in new `src/config/crewConfig.ts`.
- Validate:
  - `spawnBehavior === "explicitRegistration"`
  - `crew.id` uniqueness
  - exactly one `isMainSession: true` (Q)
  - non-main crew have `defaultModel`
  - `fallbackBehavior` numeric constraints (`>= 0`)

## 1.4 Graceful degradation
If config missing/invalid:
1. Log structured warning
2. Fall back to built-in defaults (current `CREW_MEMBERS` + safe fallback policy)
3. Disable advanced fallback labels (but keep panel functional)
4. Surface non-blocking UI banner: “Crew config degraded; using defaults”

This prevents total panel failure when config is malformed.

---

## 2) Explicit Registration Flow

## 2.1 Core change
Replace identity inference (`agentId`/session key parsing/detectCrew) with explicit registration event/metadata produced during spawn.

**Architecture decision:** the spawn orchestrator is the only component allowed to create crew registrations. Read paths may enrich or reconcile registrations, but may not invent them.
## 2.2 Registration contract
At spawn time, include explicit metadata:

```ts
{
  crewId: 'geordi',
  requestedModel: 'openai-codex/gpt-5.3-codex',
  task: '...'
}
```

After gateway returns session identifiers, OCC registers:

```ts
registry.register({
  sessionId,
  sessionKey,
  crewId,
  modelRequested,
  modelActive,
  spawnedAt,
  task,
  fallbackCount: 0,
  fallbackActive: false,
  status: 'spawning'
});
```

### Required invariants
- `crewId` must exist in validated config.
- `sessionId` is the primary key once known.
- `sessionKey` is a temporary correlation key / secondary lookup only.
- Registration must be **idempotent** for retries, reconnects, and duplicate events.
- A single `sessionId` may belong to **exactly one** `crewId`.
- A single crew member may have multiple historical sessions, but **at most one current session** should be treated as primary in the Bridge Crew panel.

### Important implementation note
If the spawn API does not immediately return `sessionId`, use a two-phase flow:
1. create a pending registration keyed by client request ID or session key
2. promote/merge it into the canonical `sessionId` record once the gateway confirms the session

Without this, transient race conditions can still cause crew rows to disappear or attach late.
## 2.3 Registry data structure
New store/module (single source of truth):

```ts
type CrewSessionRegistration = {
  sessionId: string;
  sessionKey?: string;
  requestId?: string;
  ownerId?: string;
  crewId: string;
  task?: string;
  spawnedAt: number;
  completedAt?: number;
  modelRequested?: string;
  modelActive?: string;
  fallbackModelsTried?: string[];
  fallbackCount: number;
  fallbackActive: boolean;
  status: 'spawning' | 'active' | 'idle' | 'completed' | 'error' | 'offline';
  errorReason?: string;
  lastSeenAt: number;
  source: 'spawn' | 'reconciled';
};
```

Indexes:
- `bySessionId: Map<string, CrewSessionRegistration>`
- `bySessionKey: Map<string, string /* sessionId */>`
- `byRequestId: Map<string, string /* sessionId */>`
- `latestSessionByCrewId: Map<string, string /* sessionId */>`

Notes:
- `latestSessionByCrewId` should be a derived selector when possible, not mutable state that can drift.
- If persisted in state for performance, derive and verify it from `bySessionId` on writes.
## 2.4 Persistence
- **Ephemeral (recommended)**: in-memory zustand state only.
- Optional future enhancement: sessionStorage/localStorage checkpoint for UX continuity across reloads.

---

## 3) Bridge Crew Display

## 3.1 Display composition algorithm
For each configured crew member:
1. Find latest registration (`latestSessionByCrewId`)
2. Join with live gateway `sessions.list` snapshot by `sessionId`/`sessionKey`
3. Derive UI status:
   - Live session present + active flags -> `active`
   - Live session present but idle-ish -> `idle`
   - Registered but no live session recently -> `offline`
   - Explicit failure -> `error`
4. Populate model chips:
   - `modelActive` (current)
   - `modelRequested` (expected/default)
   - fallback indicator if different

### Selector rules
- Config controls **who exists** in the roster.
- Registry controls **which session belongs to whom**.
- Live session snapshots control **current runtime status**.
- Heuristics may be used only for diagnostics or migration metrics, never primary attribution.

This separation is important. It prevents the display layer from quietly reintroducing the very inference bug this refactor is meant to eliminate.
## 3.2 Offline handling policy
Recommended policy: **show all configured crew always** (including offline).
- Benefits: stable panel layout, operational awareness, supports “last known state”.
- UI for offline:
  - status `OFFLINE`
  - last seen time
  - last known model/context where available

## 3.3 Model vs fallback in UI
In `CrewCard`:
- Primary label: `ACTIVE MODEL: <modelActive>`
- Secondary muted label: `REQUESTED: <modelRequested>` if changed
- Badge when fallback: `FALLBACK` + counter (`x1`, `x2`)

---

## 4) Fallback Handling

## 4.0) Distinguish fallback from model drift
Not every model mismatch is a fallback event.
- **Fallback** = the spawn orchestrator intentionally switched from requested/default model to an allowed fallback model.
- **Model drift** = session metadata later reports something unexpected.

Recommended behavior:
- mark `fallbackActive = true` only for orchestrator-confirmed fallback or allowed fallback-model match after a failed attempt
- otherwise flag as `modelDrift` in logs/diagnostics, but do not present misleading fallback UI

This avoids telling the operator a clean fallback occurred when the system may actually be in an inconsistent state.

## 4.1 Detecting fallback
Fallback is detected when actual running model differs from requested model, or when spawn retries with fallback model list.

Sources (in priority order):
1. Explicit spawn result metadata (`attempt`, `modelUsed`, `isFallback`)
2. Session model mismatch (`session.model !== modelRequested`)
3. Retry state machine events from spawn orchestrator

## 4.2 State transitions
- Spawn attempt 0 -> requested/default model
- On failure -> retry per config (`retryDefault`, `fallbackDelayMs`)
- If fallback model selected -> set `fallbackActive = true`, increment `fallbackCount`, update `modelActive`
- If all attempts fail -> `status = error`

## 4.3 UI behavior
- Crew row shows fallback badge and optional warning color accent
- Activity feed adds event: `Geordi switched to fallback model (qwen3-coder-next)`
- If `notifyOnFallback` true, emit toast/banner

---

## 5) Multi-User Considerations

## 5.0) Ownership and scope
The plan currently mentions owner scoping, which is correct, but it should be explicit in the registration contract.

Required rule:
- every registration must carry an `ownerId` / workspace scope matching the session source
- selectors must filter to the active owner scope before building the Bridge Crew panel

Without this, explicit registration fixes crew attribution but still risks showing the wrong crew state in shared or multi-user OCC environments.

## 5.1 User-scoped crew definitions
Support user/environment scoped config resolution:
1. user-specific config (if present)
2. workspace default (`crew-config.json`)
3. built-in fallback

Registry should be keyed by owner scope to avoid cross-user collisions:
- `registryByOwner[ownerId].bySessionId...`

## 5.2 Runtime config changes
Implement hot reload behavior:
- Detect config file mtime changes
- Re-validate
- Apply diff:
  - added crew -> show offline immediately
  - removed crew -> hide or move to “retired” section (prefer hide)
  - model changes -> affect next spawn only, not currently running session
- Preserve existing registrations until session termination

---

## 6) Files to Modify

## 6.1 Existing files
1. `src/stores/sessionsStore.ts` (High)
   - Remove mapping heuristics (`agentId`, key regex)
   - Consume explicit registry for crew mapping
   - Build display from config + registry + live sessions

2. `src/stores/activityFeedStore.ts` (Medium)
   - Replace `extractCrewIdFromSession*` regex logic
   - Use registration lookup for crew attribution
   - Add fallback feed event type/entry formatting

3. `src/utils/crew.ts` (High)
   - Deprecate/remove heuristic `detectCrew` path from critical flow
   - Keep static crew metadata only
   - Move runtime registry out to dedicated module

4. `src/stores/gateway.ts` (Medium)
   - Remove auto-infer registration behavior
   - Wire explicit register/update APIs only

5. `src/components/crew/CrewCard.tsx` (Low)
   - Add model requested/active/fallback badge rendering

6. `src/components/crew/CrewRoster.tsx` and/or `src/components/views/CrewView.tsx` (Low)
   - Ensure all configured crew render consistently even offline

7. `src/api/types.ts` (Medium)
   - Extend types for registration + fallback metadata

## 6.2 New files
1. `src/config/crewConfig.ts` (High)
   - loader + schema validation + fallback defaults + reload hooks

2. `src/stores/crewRegistryStore.ts` (High)
   - authoritative explicit registration store

3. `src/core/crew/registration.ts` (Medium)
   - helper APIs (`registerSpawn`, `markActive`, `markFallback`, `markComplete`)

4. `src/core/crew/selectors.ts` (Medium)
   - pure selectors combining config + registry + sessions into display model

## 6.3 Estimated effort
- High: 1–2 days each (store refactors, config/registry foundations)
- Medium: 0.5–1 day each
- Low: 0.25–0.5 day each
- Total implementation window: ~4–7 working days including tests + polish

---

## 7) Testing Strategy

## 7.0) Must-have regression scenario
Add a dedicated regression test reproducing the current bug:
- spawn Q, Data, Geordi, Spark, Riker, Troi, and Barclay
- ensure all sessions are live
- ensure OCC shows all configured crew exactly once
- ensure no attribution depends on model, `agentId`, or session-key parsing

If this exact regression case is not codified, the team is trusting memory instead of tests. Charming, but reckless.

## 7.1 Unit tests
- `crewConfig` validation
  - valid config
  - missing file
  - malformed schema
  - duplicate IDs
- `crewRegistryStore`
  - register/overwrite/update lifecycle
  - sessionId/sessionKey lookup consistency
  - latest session per crew selection
- selectors
  - display state for active/idle/offline/error
  - fallback badge conditions

## 7.2 Integration tests (store-level)
- Spawn each crew member (Q/Data/Geordi/Spark/Riker/Troi/Barclay)
  - assert each appears in Bridge Crew panel
  - assert mapping by `crewId`, not `agentId`
- Same-model collision test
  - two crew members using same model still map correctly
- Config reload test
  - add/remove crew at runtime
  - ensure stable UI updates

## 7.3 Fallback tests
- Force primary model failure for Geordi/Riker
- Verify retry timing + fallback activation
- Verify UI badges + feed entries + active model update
- Verify notifyOnFallback behavior

## 7.4 Edge cases
- Registry desync: registration exists, session disappears
- Session exists without registration (legacy/foreign session)
  - should show as unassigned/ignored, not mis-attributed
- Gateway reconnect event sequence gaps
  - ensure recompute from authoritative sessions + registry
- Duplicate registration events (idempotency)
- Rapid config edits during active sessions
- Spawn succeeds but registration write fails
  - must surface error and allow reconciliation; otherwise crew silently vanishes from panel
- Registration succeeds but spawn fails before session becomes live
  - status should age from `spawning` to `error`, not stay stuck forever
- Two concurrent spawns for the same `crewId`
  - define winner policy (recommended: newest live session is primary; older becomes secondary/history)
- Session ID changes across reconnect / backend restart semantics
  - document whether this is impossible or how remapping is handled
- Crew config contains a member with no fallback models and primary model unavailable
  - panel should still show error state, not disappear
- Main session Q lacks spawn registration
  - ensure Q is explicitly synthesized or registered so the panel architecture is uniform

---

## 8) Migration / Rollout Plan

1. Introduce config loader + registry store behind feature flag: `crewExplicitRegistrationV1`
2. Dual-path period:
   - write explicit registry
   - read from registry first, heuristics only as temporary fallback
3. Add telemetry/log counters:
   - mapped via explicit
   - mapped via heuristic fallback
   - unmapped sessions
4. Add a one-time diagnostic view/log entry for any live session that appears crew-like but lacks registration
5. Once explicit mapping is stable, remove heuristic mapping code from production attribution paths

### Exit criteria for removing heuristics
Do not remove the fallback path until telemetry shows:
- explicit registration handles all spawned crew sessions in normal workflows
- unmapped crew-intended sessions are understood and resolved
- no UI regressions during reconnect/reload flows

---

## 9) Definition of Done

- All 7 crew members consistently appear in OCC Bridge Crew panel
- Mapping is deterministic and based on explicit `crewId`
- Fallback state is visible and accurate
- Config errors do not break panel; degrade gracefully
- Tests cover normal + failure + runtime change paths
- Legacy heuristic-only mapping removed from critical path

---

## 10) Immediate Next Step Checklist

- [ ] Add `crewConfig` loader/validator
- [ ] Define the spawn-to-registration handshake, including pending registration behavior before `sessionId` is known
- [ ] Add `crewRegistryStore` + registration contract
- [ ] Refactor `sessionsStore` to use registry selectors
- [ ] Update crew UI with fallback labels
- [ ] Refactor activity feed crew attribution
- [ ] Add reconciliation logic for partial failures / reconnects
- [ ] Add unit/integration tests and run regression pass

---

## 11) Riker Review

**Status:** APPROVED

### What’s solid
- The plan correctly identifies the root cause: model-based heuristics are the wrong source of identity.
- Explicit `crewId` registration at spawn time is the right architectural fix.
- Config-driven roster + registry + live session join is the correct display model.
- The proposed testing direction is strong and should catch same-model collisions and fallback behavior.

### Conditions / required clarifications
1. **Spawn ownership must be explicit.** The spawn orchestrator must be the only writer of crew identity, or heuristics will creep back in.
2. **Pending-to-confirmed registration flow must be defined.** If `sessionId` arrives asynchronously, the plan needs a merge/correlation step.
3. **Primary-session policy per crew member must be documented.** Concurrent or repeated spawns for the same crew member are otherwise ambiguous.
4. **Unregistered sessions must never be auto-attributed.** Diagnostic only, never inferred into the roster.
5. **Regression coverage must include the exact current failure mode** — all crew live, only Q previously visible.

### Reviewer conclusion
With the above conditions incorporated, this plan is implementable, maintainable, and should actually solve the “only Q shows up” problem instead of cosmetically shifting the bug elsewhere.

In other words: Geordi’s onto the right fix. I’ve merely ensured it won’t eject a warp core halfway through deployment. You're welcome.
