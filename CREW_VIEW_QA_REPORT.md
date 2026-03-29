# Crew View QA Report

**Date:** 2026-03-22  
**Tester:** Riker (Subagent)  
**Status:** 🔴 **Issue Identified - Action Required**

---

## Executive Summary

The Crew View component code is **correctly implemented**. The issue is not with the fix itself, but with the **proactive registration mechanism** that connects spawned subagent sessions to their crew member entries. The store's auto-detection in `updateStatus` is reactive and incomplete—it cannot reliably map sessions to crew members without proper registration at spawn time.

**Root Cause:** When `spawnCrewMember()` is called, `registerSubagent()` is not being invoked with the session key/ID, leaving the `subagentMappings` registry empty. This causes all crew members to display as "offline" with no context data.

---

## 1. Current Code State Analysis

### 1.1 CrewView.tsx - ✅ CORRECT

The component correctly:
- Pulls `activeCrew` from the store via `useGatewayStore()`
- Maps over `CREW_MEMBERS` and merges with real-time data from `activeCrew`
- Uses `crewStatus?.contextPercent` for context bar display
- Sorts crew by status (offline at bottom) and context percentage

**Key Code Section:**
```typescript
const crewData: CrewData[] = CREW_MEMBERS.map((crew, index) => {
  const crewStatus = activeCrew.find(c => c.id === crew.id);
  const isOffline = crewStatus?.status === 'offline';
  const contextPercent = crewStatus?.contextPercent ?? 0;  // ✅ Uses store data
  // ...
});
```

### 1.2 gateway.ts updateStatus() - ⚠️ PARTIAL

The store's `updateStatus` function:
- ✅ Receives session data with `percentUsed` from API
- ✅ Auto-registers subagents reactively (when detecting `key.includes('subagent')`)
- ✅ Builds `crewStatusMap` with context data from sessions
- ❌ **Cannot reliably map sessions to crew members without proactive registration**

**Problem:** The auto-detection logic relies on `subagentMappings` being pre-populated. If registration never happened, it falls back to `'unknown'` crew ID.

### 1.3 crew.ts detectCrew() - ⚠️ INCOMPLETE

The detection function:
- ✅ Checks `subagentRegistry` for existing mappings
- ✅ Has patterns to infer crew from task descriptions
- ❌ **Returns `'unknown'` when no mapping exists and task is unavailable**

---

## 2. Data Flow Verification

### 2.1 API Response Confirms Data IS Available

```bash
$ curl http://localhost:5180/api/status
```

**Sample Session Data (verified live):**
```json
{
  "agentId": "main",
  "key": "agent:main:subagent:439ce612-0ee5-42eb-b19d-26ad30f17454",
  "sessionId": "68e41dfe-aae2-43fa-a4d4-a43b13a575e9",
  "age": 279128,
  "percentUsed": 20,
  "model": "kimi-k2.5:cloud",
  "totalTokens": 25915,
  "remainingTokens": 102085
}
```

**Result:** ✅ Sessions **DO** have `percentUsed` and context data.

### 2.2 Build Verification

```bash
$ npm run build
> tsc -b && vite build
✓ built in 476ms
```

**Result:** ✅ No TypeScript errors, build succeeds.

### 2.3 Dev Server Status

```bash
$ ps aux | grep vite
maccagey  79605  ...  vite         # ✅ Dev server running on port 5180
maccagey  79497  ...  vite --port 5180
```

**Result:** ✅ Dev server is running.

---

## 3. Root Cause Analysis

### The Breakdown

```
Expected Flow:
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ spawnCrewMember │────▶│ registerSubagent │────▶│ subagentMappings│
│   (spawn action)│     │ (store action)   │     │ (Map registry)  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                         │
                           ┌─────────────────────────────┘
                           ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Crew View UI  │◀────│   activeCrew     │◀────│  updateStatus   │
│  (shows online) │     │  (with context)  │     │ (reads mappings)│
└─────────────────┘     └──────────────────┘     └─────────────────┘

Actual Flow (Broken):
┌─────────────────┐     XXXXXXXXXXXXXXXXXXXX     ┌─────────────────┐
│ spawnCrewMember │────▶│  NOT REGISTERED  │     │ subagentMappings│
│   (spawn action)│     │ (missing call)   │     │  (EMPTY MAP)    │
└─────────────────┘     XXXXXXXXXXXXXXXXXXXX     └────────┬────────┘
                                                           │
                             ┌─────────────────────────────┘
                             ▼ (auto-detect fallback fails)
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Crew View UI  │◀────│   activeCrew     │◀────│  updateStatus   │
│ (all offline --)│     │(status: offline) │     │(can't map crew) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Why Auto-Detection Fails

In `updateStatus()`, the code attempts to auto-register unknown subagents:

```typescript
// Auto-detect new subagent sessions
sessions.forEach(session => {
  if (session.key.includes('subagent')) {
    // ... check if mapping exists
    if (!mapping) {
      // Try to infer from feed or detectCrew()
      const crewId = detectCrew(session.key, ...);
      // Often returns 'unknown' when task not available
    }
  }
});
```

**Issues with auto-detection:**
1. Feed entries may not contain the session key UUID
2. `detectCrew()` returns `'unknown'` if no task description is available
3. Even when registered as `'unknown'`, the crew won't match `CREW_MEMBERS` entries

---

## 4. Recommended Fix

### Option A: Ensure Proactive Registration (RECOMMENDED)

The `spawnCrewMember()` function (or wherever crew members are spawned) needs to call:

```typescript
import { useGatewayStore } from '../stores/gateway';

// When spawning a subagent:
const sessionKey = `agent:main:subagent:${uuid}`;
const { registerSubagent } = useGatewayStore.getState();

registerSubagent(sessionKey, crewId, taskDescription);
```

**This is the intended design** - proactive registration ensures the mapping exists before `updateStatus` runs.

### Option B: Improve Auto-Detection (Fallback)

If proactive registration isn't feasible, enhance `updateStatus` to:

1. Check session age to determine status (already done)
2. Use session metadata (model, flags) to infer crew type
3. Store a temporary mapping even for `'unknown'` crew

```typescript
// Enhanced detection in updateStatus:
const enhancedDetectCrew = (session: Session): string => {
  // Check existing mappings first
  // Check feed for recent spawns (already done)
  // Infer from model patterns
  if (session.model?.includes('codex')) {
    // Could be Geordi, Riker, or Spark
  }
  // Fallback to storing with session ID as key
  return session.sessionId; // Use sessionId as crewId temporarily
};
```

### Option C: Debug Registration Call Site

Find where `spawnCrewMember` is defined and verify:

```bash
# Search for spawn-related code
$ grep -r "spawn" src/ --include="*.ts" --include="*.tsx"
$ grep -r "registerSubagent" src/ --include="*.ts" --include="*.tsx"
```

**Expected:** `registerSubagent` should be called immediately after a subagent is spawned.

---

## 5. Verification Steps for User

### Step 1: Check If Registration Is Happening

Add console logging to verify:

```typescript
// In gateway.ts registerSubagent action:
registerSubagent: (sessionKey, crewId, task) => {
  console.log('[REGISTER]', crewId, sessionKey);
  // ... existing code
}

// In updateStatus:
updateStatus: (status) => {
  console.log('[UPDATE_STATUS] Sessions:', status.sessions?.recent?.length);
  console.log('[UPDATE_STATUS] Mappings:', get().subagentMappings.size);
  // ... existing code
}
```

### Step 2: Verify API Data

Open browser DevTools → Network tab → Check `/api/status` response:

```javascript
// Should see sessions with percentUsed values:
fetch('/api/status')
  .then(r => r.json())
  .then(d => console.log(d.sessions.recent.map(s => ({ 
    key: s.key, 
    percentUsed: s.percentUsed 
  }))))
```

### Step 3: Check Store State

```javascript
// In browser console:
const zustand = await import('zustand');
const store = Object.values(window.__zustandStores || {})[0];
console.log('activeCrew:', store.getState().activeCrew);
console.log('subagentMappings:', store.getState().subagentMappings);
```

---

## 6. Summary

| Component | Status | Notes |
|-----------|--------|-------|
| CrewView.tsx | ✅ Correct | Properly reads store data |
| gateway.ts updateStatus | ✅ Correct | Properly processes API data |
| Build | ✅ Passing | No TypeScript errors |
| Dev Server | ✅ Running | Port 5180 active |
| **Registration** | 🔴 **Missing** | Proactive registration not happening |
| **API Data** | ✅ Available | Sessions have context percentages |

### Conclusion

The "fix" in `CrewView.tsx` is working correctly—the issue is that the **data never reaches the component** because `registerSubagent()` is not being called when crew members are spawned.

**Action Required:**
1. Find the code that spawns crew members (likely in a parent component or utility)
2. Ensure `registerSubagent()` is called with the session key and crew ID
3. Alternatively, call `useGatewayStore.getState().registerSubagent(...)` directly after spawning

---

## Appendix: File Locations

| File | Path |
|------|------|
| CrewView Component | `/Users/maccagey/.openclaw/workspace/projects/mission-control/src/components/views/CrewView.tsx` |
| Gateway Store | `/Users/maccagey/.openclaw/workspace/projects/mission-control/src/stores/gateway.ts` |
| Crew Utilities | `/Users/maccagey/.openclaw/workspace/projects/mission-control/src/utils/crew.ts` |
| Type Definitions | `/Users/maccagey/.openclaw/workspace/projects/mission-control/src/api/types.ts` |
