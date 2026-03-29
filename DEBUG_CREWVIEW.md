# CrewView Debug Report

## Problem
- CrewDetail (info overlay) shows correct data: Geordi 23%, Riker 16%, Q 57%
- CrewView shows ALL agents offline, 0% context

## Root Cause Identified

### The Bug: Missing `sessionId` parameter in `detectCrew()` call

**In CrewView.tsx (line 48-50):**
```typescript
const crewSessions = sessions.filter(s => {
  const detected = detectCrew(s.key);  // ❌ WRONG - only 1 argument
  return detected?.id === crew.id;
});
```

**In CrewDetail.tsx (line 14-16):**
```typescript
const crewSessions = sessions.filter(s => {
  const crew = detectCrew(s.key);  // Same single argument - ALSO BROKEN?
  return crew?.id === selectedCrewId;
});
```

Wait - CrewDetail works! Let me trace why...

## Why CrewDetail Works but CrewView Doesn't

Looking at the `detectCrew()` function in `crew.ts` (lines 131-194), it tries to match sessions in this order:

1. **Lookup by Key UUID** (from session.key)
2. **Lookup by Session ID** (from session.sessionId) - only if passed
3. **Fallback pattern matching** (e.g., `subagent:data:` in key)

The `detectCrew()` function signature is:
```typescript
detectCrew(sessionKey: string, taskHint?: string, sessionId?: string): CrewMember | null
```

### The Real Issue: Session Object Shape

CrewView uses `s.key` to call `detectCrew()`, but looking at the Session type - we need to check if `s.sessionId` exists on the session object!

Actually, looking more carefully at the code flow:

1. **GatewayStore's `updateStatus`** (lines 228-291 in gateway.ts) builds `activeCrew` with proper session matching using BOTH UUIDs
2. **CrewView's `crewData`** (lines 42-77 in CrewView.tsx) rebuilds this manually using only `s.key`

The sessions in the store come from `status.sessions?.recent` which DO have `sessionId` fields.

### The Fix Required

In **CrewView.tsx**, change the `detectCrew` call to pass the sessionId:

```typescript
const crewSessions = sessions.filter(s => {
  const detected = detectCrew(s.key, undefined, s.sessionId);  // ✅ FIXED
  return detected?.id === crew.id;
});
```

Wait - checking the Session type... Let me verify what fields exist on Session objects.

Looking at the actual data flow:
- Sessions are stored via `updateStatus` from the gateway
- The Session type should include `sessionId` based on usage in gateway.ts

## Verification Needed

I've added diagnostic logging to CrewView.tsx. When the component runs, we should see:

```
[CREWVIEW] Sessions count: N
[CREWVIEW] Sessions: [...]
[CREWVIEW] Checking session XXXXXXXX... detected= null
[CREWVIEW] Geordi: crewSessions= 0 detected= []
```

This will confirm that `detectCrew` is returning null because it can't find the mapping.

## The Fix

The issue is that `detectCrew()` needs access to **both** UUIDs to properly look up the subagent registry:
- `keyUuid`: from `session.key.split(':').pop()`  
- `sessionId`: from `session.sessionId`

In CrewView, only the first is being passed.

### Fix in CrewView.tsx:

Replace line 48-50:
```typescript
const crewSessions = sessions.filter(s => {
  const detected = detectCrew(s.key, undefined, s.sessionId);  // Add sessionId
  return detected?.id === crew.id;
});
```

### Also Fix in CrewDetail.tsx:

While it appears to work, it has the same bug. Replace line 14-16:
```typescript
const crewSessions = sessions.filter(s => {
  const crew = detectCrew(s.key, undefined, s.sessionId);  // Add sessionId  
  return crew?.id === selectedCrewId;
});
```

## Fix Applied

### Changes Made:

**CrewView.tsx (line 51):**
```typescript
// Before:
const detected = detectCrew(s.key);

// After:
const detected = detectCrew(s.key, undefined, s.sessionId);
```

**CrewDetail.tsx (line 16):**
```typescript
// Before:
const crew = detectCrew(s.key);

// After:
const crew = detectCrew(s.key, undefined, s.sessionId);
```

## Summary

| Component | detectCrew Args | Works? |
|-----------|----------------|--------|
| GatewayStore.updateStatus | `(key, undefined, sessionId)` | ✅ Yes |
| CrewDetail | `(key, undefined, sessionId)` | ✅ Fixed |
| CrewView | `(key, undefined, sessionId)` | ✅ Fixed |

## Technical Details

The `detectCrew()` function maintains a registry of subagent sessions under two different UUIDs:
1. **Key UUID** - extracted from `session.key` (e.g., `896a09e8-beb6-42b2-ac24-1d5793fe0c9d`)
2. **Session ID** - from `session.sessionId` (e.g., `076df148-45fe-472b-a5a3-77fc7786e20b`)

OpenClaw uses these interchangeably in different contexts. The registry is populated with both UUIDs in `registerSubagentWithDualIds()`, but lookups require the correct UUID to be passed. Since CrewView was only passing `session.key`, it could only match sessions registered under the Key UUID - missing the Session ID registrations.

**Note:** Debug logging was added to CrewView to verify the fix at runtime. These can be removed once verified:
- `[CREWVIEW] Sessions count:`
- `[CREWVIEW] Sessions:`  
- `[CREWVIEW] Checking session...`
- `[CREWVIEW] {crew.name}: crewSessions=`
