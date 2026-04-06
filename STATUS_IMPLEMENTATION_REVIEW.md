# Status Implementation Review

## Summary
Geordi **partially implemented** status colors for Bridge Crew. The OpenClaw session status is now being parsed and stored, and `CrewCard.tsx` was updated to color cards by crew status instead of context risk.

However, the implementation is **not complete end-to-end**:
- the app still uses only the existing crew statuses (`active | idle | offline | error`)
- `timeout` is being collapsed into `idle`
- `done` is being collapsed into `offline`
- only `CrewCard` was updated to use the new color mapping
- other UI surfaces still render `offline` as gray, not blue
- crew attribution depends on explicit registration / session-label matching, so many sessions will never get mapped to a crew member at all

That explains the user report:
- **Q = green** → working
- **Geordi = yellow** → likely correct from current code because `timeout` is mapped to `idle`
- **everyone else = gray** → expected with the current incomplete implementation, because they are falling back to `offline` in most UI surfaces or are not being attributed to a crew member

---

## Files Geordi Actually Modified

Based on recent file timestamps and current uncommitted changes, the status-color work touched at least these files:

### Directly related to the status-color feature
1. `src/stores/sessionsStore.ts` **(new/untracked)**
2. `src/stores/crewRegistryStore.ts` **(new/untracked)**
3. `src/components/crew/CrewCard.tsx`
4. `src/api/types.ts`
5. `src/utils/crew.ts`

### Related supporting files already in the runtime path
6. `src/App.tsx` — sessions store initialization is now wired on app startup
7. `src/config/crewConfig.ts` — defines crew members and fallback models used by the new stores
8. `src/stores/gateway.ts` — still participates in crew display state and contains older/parallel status logic
9. `src/components/crew/CrewRoster.tsx` — still renders offline as gray via `status-dot--offline`
10. `src/styles/occ.css` — defines roster/status-dot colors; offline remains gray here
11. `src/stores/__tests__/crewRegistry.test.ts` — regression test for registered vs unregistered subagents

---

## What Was Implemented

## 1) Session normalization in `sessionsStore.ts`
`normalizeSession()` now extracts OpenClaw session fields including:
- `label`
- `displayName`
- `parentSessionKey`
- `spawnedBy`
- `subagentRole`
- `status`
- `startedAt`
- `endedAt`
- `runtimeMs`

This is the core plumbing needed to read OpenClaw statuses like:
- `running`
- `done`
- `failed`
- `killed`
- `timeout`

## 2) Session → crew registration in `crewRegistryStore.ts`
A new registry store tracks spawned/reconciled crew sessions with:
- requested model
- active model
- fallback info
- OpenClaw status
- internal crew registration status

Important mapping logic in `autoRegisterFromSession()`:
- `failed` → `error`
- `killed` → `error`
- `running` → `active`
- `timeout` → `idle`
- `done` → `completed`

It also persists `openclawStatus` separately.

## 3) Crew display status in `sessionsStore.ts`
`inferStatus()` maps OpenClaw session status into the existing UI status model:
- `failed` / `killed` → `error`
- `done` → `offline`
- `timeout` → `idle`
- everything else → `active` or `idle` based on recent activity

## 4) Crew card colors in `CrewCard.tsx`
The left border and status text color were changed from **context-risk coloring** to **status coloring**:
- `active` → green
- `idle` → yellow
- `error` → red
- `offline` → blue
- default → gray

That part is clearly the feature Geordi was implementing.

## 5) Type updates in `api/types.ts`
The `Session` type now supports status/lifecycle fields, and `CrewMember` now supports:
- `requestedModel`
- `fallbackActive`
- `fallbackCount`

---

## Is Status Extraction Working Correctly?

## Short answer
**Partly.** The raw extraction from OpenClaw sessions looks reasonable, but the **mapping and UI presentation are incomplete**.

## What is working
- Session payloads can now carry `status`
- `sessionsStore.normalizeSession()` reads those fields correctly
- `crewRegistryStore.autoRegisterFromSession()` preserves `openclawStatus`
- `CrewCard` uses status-driven colors
- Registered subagent sessions can show correct active/idle/error/offline-derived display states

## What is not fully correct
### A) `timeout` is not preserved as its own display state
It is immediately collapsed into `idle`:
- registry: `timeout` → `idle`
- display store: `timeout` → `idle`

So Geordi may be **yellow**, but the system no longer knows “this is timeout” at the UI layer.

### B) `done` is not preserved as its own display state
It is collapsed into `offline` in `sessionsStore.inferStatus()`.
That means the blue color is really “offline/completed”, not strictly “done”.

### C) The UI text does not match timeout semantics
`CrewCard` shows:
- `idle` => `[IDLE]`

So a timed-out session appears yellow, but will likely display as **IDLE**, not **TIMEOUT**. That is a behavior mismatch.

### D) Crew attribution is fragile
`mapSessionToCrewId()` only maps a session if:
1. it is explicitly registered in `crewRegistryStore`, or
2. it is the main Q session, or
3. `autoRegisterFromSession()` can infer crew from `session.label`

But `autoRegisterFromSession()` only runs when:
- `session.parentSessionKey` exists, and
- `session.label` matches a crew `id` or `name`

If either condition fails, the session never gets attached to a crew member.

That is the biggest reason many crew show gray/offline.

---

## Why Is Geordi Showing Yellow (timeout)?

## Current behavior
This is coming from the mapping logic itself.

In `sessionsStore.ts`:
- `timeout` → `idle`

In `CrewCard.tsx`:
- `idle` → yellow

So if Geordi’s OpenClaw session status is actually `timeout`, then **yellow is the expected result under the current code**.

## Is that correct or a bug?
### Color: mostly correct
If the intended visual mapping was:
- `timeout` → yellow

then the **color result is correct**.

### Semantics: incomplete / buggy
Because `timeout` is converted to `idle`, the app loses the distinction between:
- agent is waiting / idle
- agent timed out / stalled

So the card color may be right, but the underlying state model is **too lossy**.

**Conclusion:**
- Geordi being yellow is **not a rendering bug** if his session really timed out.
- But the implementation is still **incomplete**, because timeout is being treated as generic idle instead of a first-class status.

---

## Why Are Other Crew Showing Gray Instead of Their Actual Status?

There are **two separate reasons**.

## 1) Many sessions are probably not being attributed to crew at all
The new system intentionally avoids guessing. That’s fine in principle, but it means any session without explicit registration or matching label is ignored.

If a crew member has no mapped session, `buildCrewDisplayState()` returns:
- `offline`, or
- `error` only if the registry already says error

So unmapped crew fall back to offline.

## 2) Offline is still gray in other UI surfaces
Even though `CrewCard.tsx` maps `offline` to blue, the rest of the UI still treats offline as gray.

Example:
- `CrewRoster.tsx` uses `status-dot status-dot--${member.status}`
- `src/styles/occ.css` defines `.status-dot--offline` as gray (`var(--occ-text-dim)`)

So depending on where the user is looking:
- **CrewCard view**: offline = blue
- **Roster / status dot view**: offline = gray

This is almost certainly why the user reports “all other crew show gray”.

**So gray is not necessarily their actual OpenClaw status.** It usually means:
- no mapped session, or
- completed session collapsed to offline, and
- UI surface still renders offline as gray

---

## Is the Implementation Complete or Partial?

**Partial. Definitely partial.**

## Completed pieces
- session lifecycle fields added to `Session`
- status extraction added
- crew registry introduced
- explicit registration / reconciliation logic added
- `CrewCard` switched from context-risk colors to status colors
- fallback model display added

## Incomplete / broken pieces
- no first-class `timeout` display status
- no first-class `done/completed` display status
- `CrewMember['status']` still only supports `active | idle | offline | error`
- `CrewCard` color rules were updated, but other status UI was not
- `CrewRoster` / `status-dot--offline` still render gray
- status labels do not distinguish timeout from idle
- session attribution depends on explicit registration or exact label matching, so many real sessions will not map
- there are now **two overlapping status pipelines**:
  - `src/stores/gateway.ts` has older status inference
  - `src/stores/sessionsStore.ts` has newer authoritative status inference

That split increases the chance of inconsistent behavior.

---

## Recommended Fixes

## Priority 1 — Add first-class crew display statuses
Do not collapse OpenClaw lifecycle into generic idle/offline too early.

Recommended `CrewMember['status']` expansion:
- `active`
- `done`
- `timeout`
- `error`
- `offline`

Suggested mapping:
- `running` → `active`
- `done` → `done`
- `failed` / `killed` → `error`
- `timeout` → `timeout`
- no session / unknown → `offline`

Then color directly from those statuses:
- `active` → green
- `done` → blue
- `error` → red
- `timeout` → yellow
- `offline` → gray

That matches the original requirement exactly.

## Priority 2 — Update all UI surfaces, not just `CrewCard`
At minimum:
- `CrewRoster.tsx`
- any status badge/dot components
- CSS classes in `occ.css`
- detail panels that display crew state

Right now the app has mixed semantics:
- blue offline in cards
- gray offline in roster

That inconsistency is the visible bug.

## Priority 3 — Preserve raw OpenClaw status alongside display status
Keep:
- `openclawStatus` as the source of truth
- `displayStatus` as a derived UI status

Do not reduce `timeout` to `idle` or `done` to `offline` until the last possible moment — ideally not at all.

## Priority 4 — Improve crew attribution
Current attribution is too strict for historical/existing sessions.

Possible improvements:
- parse crew identity from spawn metadata already embedded in tasks (`[crew:geordi request:...]`)
- use requestId/sessionKey reconciliation more aggressively
- allow label parsing of patterns like `"Geordi [req:abcd1234]"`
- consider recovering attribution from registry even when `parentSessionKey` is absent

Right now, unmapped sessions become gray/offline by default, which hides useful state.

## Priority 5 — Consolidate status logic into one store
There are parallel status systems in:
- `src/stores/gateway.ts`
- `src/stores/sessionsStore.ts`

Mission Control should pick one authoritative pipeline. From the current code, `sessionsStore.ts` appears intended to be the new authority. The older gateway inference should be removed or reduced to transport concerns only.

---

## Direct Answers to the Questions

### 1. What files did Geordi actually modify?
Most relevant:
- `src/stores/sessionsStore.ts`
- `src/stores/crewRegistryStore.ts`
- `src/components/crew/CrewCard.tsx`
- `src/api/types.ts`
- `src/utils/crew.ts`

Also involved in runtime behavior:
- `src/App.tsx`
- `src/stores/gateway.ts`
- `src/components/crew/CrewRoster.tsx`
- `src/styles/occ.css`

### 2. What code was added/changed?
- session lifecycle/status extraction added
- crew session registry added
- OpenClaw status mapped into crew display state
- CrewCard border/text color changed from context-risk colors to status colors
- model fallback display added to crew cards

### 3. Is status extraction working correctly?
**Partially.** Raw extraction looks okay, but lifecycle states are collapsed too aggressively and attribution is fragile.

### 4. Why is Geordi showing yellow (timeout) — correct or bug?
**Color is correct under current logic** because `timeout` maps to `idle`, and `idle` is yellow. But it is still **incomplete/buggy semantically** because timeout is not preserved as its own status.

### 5. Why are other crew showing gray instead of their actual status?
Because many sessions are not being attributed to crew members, so they fall back to offline; and other UI surfaces still render offline as gray.

### 6. Is the implementation complete or partial?
**Partial.** The plumbing started, but the status model and UI were not finished consistently.

---

## Bottom Line
Geordi got the hardest plumbing started, then vanished into the cosmic void like a proper engineer mid-upgrade. The result is a **half-wired status system**:
- OpenClaw status is now available
- cards can color by status
- but the display model is lossy
- attribution is incomplete
- and the rest of the UI still uses the old/offline-gray semantics

So yes: the feature exists, but only in a **partial, inconsistent state**.