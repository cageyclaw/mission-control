# Geordi/Data Crew View Debug Report

## Problem Summary
Geordi and Data show context in their info panels (CrewDetail) but don't appear in Crew View with context bars. Q and Riker work correctly.

## Root Cause

**Dual UUID Mismatch in Subagent Registration**

OpenClaw uses TWO different UUIDs for subagent sessions:
1. **Key UUID**: Extracted from `session.key` (e.g., `agent:main:subagent:896a09e8-beb6-42b2-ac24-1d5793fe0c9d`)
2. **Session ID**: From `session.sessionId` (e.g., `076df148-45fe-472b-a5a3-77fc7786e20b`)

These are often DIFFERENT values, but the registration code assumes they're the same.

## Specific Code Issue

**File**: `src/stores/gateway.ts`  
**Function**: `registerSubagent` (lines ~117-140)

```typescript
registerSubagent: (sessionKey, crewId, task) => {
    const sessionId = sessionKey.split(':').pop() || sessionKey;  // ← Key UUID
    const mapping: SubagentMapping = {
      sessionId,  // ← This stores the Key UUID
      crewId,
      spawnedAt: Date.now(),
      task,
      status: 'spawning',
    };
    set(state => ({
      subagentMappings: new Map(state.subagentMappings).set(sessionId, mapping),  // ← Only registered under Key UUID
    }));
    ...
}
```

**The Problem**: This only registers the mapping under the Key UUID, NOT the actual Session ID.

**File**: `src/stores/gateway.ts`  
**Function**: `updateStatus` (lines ~258-290)

```typescript
sessions.forEach(session => {
    if (!session.key.includes('subagent')) return;
    
    const keyUuid = session.key.split(':').pop();     // ← Key UUID
    const sessionId = session.sessionId;                // ← Session ID (DIFFERENT!)
    
    // Look up this SPECIFIC session in the registry
    const mapping = keyUuid ? newMappings.get(keyUuid) : undefined;        // ← May find this
    const mappingBySessionId = newMappings.get(sessionId);                   // ← Won't find this!
    const actualMapping = mapping || mappingBySessionId;
    
    if (!actualMapping) return;  // ← Returns early if neither found!
    ...
})
```

## Why Info Panel Works but Crew View Doesn't

**CrewDetail (Info Panel)** - Uses `detectCrew()`:
```typescript
const crewSessions = sessions.filter(s => {
    const crew = detectCrew(s.key);  // ← Uses MODULE-LEVEL registry in crew.ts
    return crew?.id === selectedCrewId;
});
```

- `detectCrew()` in `crew.ts` has its OWN `subagentRegistry` Map
- It's populated via `registerSubagentWithDualIds()` during auto-registration in `updateStatus`
- This dual-registration works properly because it handles both UUIDs

**CrewView** - Uses `activeCrew` from store:
```typescript
const { activeCrew } = useGatewayStore();
// activeCrew is built from crewStatusMap in updateStatus
// which relies on subagentMappings from the store
```

- `activeCrew` is built from `crewStatusMap` in `updateStatus`
- `crewStatusMap` is populated by looking up `subagentMappings` (the store's Map)
- The store's Map only has Key UUID entries, not Session ID entries
- When the Session ID differs from the Key UUID, the lookup fails
- The session gets filtered out before setting `crewStatusMap`

## Why Riker Works but Geordi/Data Don't

Likely explanation:
- For some subagents (Riker, possibly Q), the Key UUID and Session ID happen to be the same, or
- The timing of auto-registration vs manual registration results in different lookup success, or  
- Riker was auto-registered via the fallback logic in `updateStatus` before `trackSubagentSpawn` was called

## Fix Recommendation

**Option 1: Modify `registerSubagent` to accept both UUIDs (Recommended)**

Change the function signature and implementation in `src/stores/gateway.ts`:

```typescript
registerSubagent: (sessionKey: string, crewId: string, task?: string, sessionId?: string) => {
    const keyUuid = sessionKey.split(':').pop() || sessionKey;
    const actualSessionId = sessionId || keyUuid;
    
    const mapping: SubagentMapping = {
      sessionId: actualSessionId,
      crewId,
      spawnedAt: Date.now(),
      task,
      status: 'spawning',
    };
    
    set(state => {
      const mappings = new Map(state.subagentMappings);
      // Register under BOTH UUIDs for dual lookup compatibility
      mappings.set(keyUuid, mapping);
      if (actualSessionId !== keyUuid) {
        mappings.set(actualSessionId, mapping);
      }
      return { subagentMappings: mappings };
    });
    ...
}
```

**Option 2: Pass both IDs in `trackSubagentSpawn`**

Modify `src/api/subagent-tracker.ts`:

```typescript
export function trackSubagentSpawn(
  sessionKey: string,
  task?: string,
  agentIdHint?: string,
  sessionId?: string  // Add this parameter
): void {
    ...
    store.registerSubagent(sessionKey, crewId, task, sessionId);
}
```

And update the caller to pass `sessionId` if available.

**Option 3: Use `registerSubagentWithDualIds` in `trackSubagentSpawn`**

Replace the store's `registerSubagent` call with the utility function:

```typescript
import { registerSubagentWithDualIds } from '../utils/crew';

export function trackSubagentSpawn(
  sessionKey: string,
  task?: string,
  agentIdHint?: string
): void {
    ...
    // Extract key UUID
    const keyUuid = sessionKey.split(':').pop() || sessionKey;
    // If we have sessionId, use dual registration
    const sessionId = /* get sessionId if available */;
    if (sessionId && sessionId !== keyUuid) {
        registerSubagentWithDualIds(keyUuid, sessionId, crewId, task);
    } else {
        store.registerSubagent(sessionKey, crewId, task);
    }
}
```

## Verification Steps

1. Add logging to confirm the dual UUID theory:
```typescript
// In updateStatus, add logging:
sessions.forEach(session => {
    if (session.key.includes('subagent')) {
        const keyUuid = session.key.split(':').pop();
        const sessionId = session.sessionId;
        console.log('[DEBUG] Subagent session:', {
            keyUuid,
            sessionId,
            match: keyUuid === sessionId,
            keyInMappings: newMappings.has(keyUuid),
            sessionIdInMappings: newMappings.has(sessionId)
        });
    }
});
```

2. Verify the fix by checking that both UUIDs are present in `subagentMappings` after registration.

## Summary

The bug is that `registerSubagent` only registers under the Key UUID, but `updateStatus` looks up by either Key UUID OR Session ID. When these differ (which they do for Geordi/Data), the Session ID lookup fails, the session is skipped, and the crew member never gets added to `crewStatusMap`, making them invisible in Crew View.

The info panel works because it uses `detectCrew()` which uses the module-level registry that IS properly dual-registered via `registerSubagentWithDualIds`.
