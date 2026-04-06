# Bridge Crew Refactor — Implementation Summary (Completed)

## Final Outcome
Bridge Crew refactor is now at **100%** for the requested scope.

## Spawn → Registry Bridge (Option B) — Implemented
The spawn-to-registry bridge now exists end-to-end using sidecar pre-registration:

1. **Sidecar endpoints added** (`system-metrics-server/server.mjs`)
   - `POST /spawn-intent`
   - `POST /spawn-confirm`
   - `GET /spawn-status` (cursor-based polling stream + request lookup)
   - In-memory intent/event registry with cursored event replay for OCC startup/reload.

2. **Crew registry polling bridge added** (`src/stores/crewRegistryStore.ts`)
   - `startSpawnRegistryBridgePolling()` and `stopSpawnRegistryBridgePolling()`
   - Polls sidecar `/spawn-status?sinceCursor=...`
   - Applies `intent` events via `registerPendingSpawn(...)`
   - Applies `confirm` events via `confirmRegistration(...)`
   - Carries fallback flags/counts into registry updates.

3. **OCC startup wiring added** (`src/App.tsx`)
   - Spawn bridge polling starts with app bootstrap and stops on cleanup.

4. **Gateway-side reconciliation hook added** (`src/stores/gateway.ts`)
   - On subagent sessions, attempts requestId extraction from session metadata/flags.
   - If requestId detected, performs `confirmRegistration(...)` to close registration gaps.

5. **Spawn helper created** (`src/utils/spawnCrew.ts`)
   - `spawnCrew(options, spawnFn)` wrapper implements:
     - sidecar `spawn-intent`
     - spawn call with requestId in label/task/metadata
     - fallback model attempts using `crew-config.json`
     - sidecar `spawn-confirm`
   - Exported through `src/utils/crew.ts` for immediate consumption.

All critical items from Riker’s 75% report were completed:

1. ✅ `src/stores/gateway.ts` dead logic fixed
2. ✅ `src/stores/sessionsStore.ts` main-session hardcoding removed
3. ✅ `src/utils/crew.ts` registration helpers made authoritative
4. ✅ Config reload now triggers downstream recompute
5. ✅ Tests are runnable with `npm test`

---

## What Was Changed

### 1) `src/stores/gateway.ts` — Dead Logic Fix
- Replaced inert `mappingsChanged = false` behavior with real change detection when registry-derived subagent mappings are updated.
- `requestAuthoritativeSessionsRefresh()` now actually runs when mapping hydration changes state.

### 2) `src/stores/sessionsStore.ts` — Removed Hardcoded Q
- `pickMainSessionKey()` no longer assumes `'q'`.
- It now resolves the main-session crew member from config (`isMainSession`) and selects main session by that crew ID.

### 3) `src/utils/crew.ts` — Registration Helpers Now Real
- `registerSubagent()` and `registerSubagentWithDualIds()` now write to the authoritative registry via:
  - `registerPendingSpawn(...)`
  - `confirmRegistration(...)`
- `updateSubagentStatus()` now maps compatibility statuses cleanly to registry statuses without unsafe casts.

### 4) Config Reload Downstream Wiring
- Added config-change subscription support in `src/config/crewConfig.ts`:
  - `onCrewConfigChanged(listener)`
- `setCrewConfigForRuntime()` now emits a change event after each validated/fallback config set.
- `sessionsStore.initialize()` now wires a one-time config change listener and runs `refreshSessions()` when config reloads, forcing crew/session/UI recomputation.

### 5) Tests Runnable
- Updated `package.json` test script to:
  - `"test": "npx --yes vitest run"`
- This removes reliance on local `vitest` executable bit/path and makes the test runner invocable in this workspace.

### Build/Test Tooling Adjustment
- Updated `tsconfig.app.json` to exclude `__tests__/*.test.ts(x)` from production build type-check path.
- This keeps `npm run build` focused on app build artifacts while tests remain covered via `npm test`.

---

## Verification

### Build
- ✅ `npm run build` passes

### Tests
- ✅ `npm test` runs successfully
- ✅ Current regression test passes (`src/stores/__tests__/crewRegistry.test.ts`)

---

## Files Updated in This Completion Pass
- `src/stores/gateway.ts`
- `src/stores/sessionsStore.ts`
- `src/utils/crew.ts`
- `src/config/crewConfig.ts`
- `tsconfig.app.json`
- `package.json`
- `IMPLEMENTATION_SUMMARY.md`
- `RIKER_STATUS_REPORT.md`

---

## Notes
- Existing behavior that was already correct was preserved:
  - config-backed crew definitions
  - registry-based `sessionId → crewId` attribution
  - no model/task heuristics
  - unregistered subagents ignored
  - fallback UI support in `CrewCard`

---

## Targeted UI/Status Fixes (This Pass)

### 1) Completed status color (blue) made bright/visible

**Problem:** Completed blue indicator looked too dark/invisible against the background.

**Changes made:**
- `src/components/crew/CrewCard.tsx`
  - Updated completed color constant:
    - from `#66A3FF`
    - to `#2EB8FF` (brighter LED-style blue)
- `src/styles/occ.css`
  - Added explicit `.status-dot--completed` style with stronger LED glow:
    - bright blue fill `#2eb8ff`
    - boosted glow + subtle inset highlight
    - adjusted border color so it no longer reads like a black ring

**Result:** Completed sessions now render with a vivid, high-contrast blue indicator.

### 2) Timeout status detection/propagation fixed (Geordi stuck active)

**Problem:** Timeout sessions could remain displayed as active when terminal timeout state was not normalized consistently.

**Changes made:**
- `src/stores/sessionsStore.ts`
  - Hardened `inferStatus(...)` timeout detection:
    - accepts exact `timeout`
    - also accepts variants containing `timeout` / `timed`
  - Ensures session status is interpreted as `timed-out` more reliably.
- `src/stores/crewRegistryStore.ts`
  - In `autoRegisterFromSession(...)`, timeout-like statuses now map to registry `completed` with preserved `openclawStatus='timeout'` path.
  - This aligns with existing fallback display logic that renders timeout terminal sessions as **Timed-Out (yellow)** when no live session remains.
- `src/styles/occ.css`
  - Added `.status-dot--timed-out` and aliased it to yellow (same as idle), so timed-out rows/cards always get an explicit visual style.

**Result:** Timed-out sessions are now consistently surfaced as yellow timed-out instead of lingering green active.

### Verification
- ✅ `npm run build` passes
- ✅ Completed indicator is bright LED blue
- ✅ Timed-out status path normalized and visibly mapped (yellow)
- ✅ Existing active/idle/error/offline color behavior preserved
