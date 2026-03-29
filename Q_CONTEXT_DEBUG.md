# Q Context Debug Report

## Problem
Q's context percentage (10%) is not showing in Crew View, but Riker's (17%) does. The `qContextData` store field may be working, but Q's entry in `activeCrew` shows 0% context.

## Code Path Analysis

### Location of Q Session Handling
File: `src/stores/gateway.ts`, `updateStatus` function

### Step 1: Finding Q's Session (Line 229-239)
```typescript
const qSession = sessions
  .filter(s => s.agentId === 'main' && !s.key.includes('subagent'))
  .sort((a, b) => {
    // Prefer agent:main:main or webchat sessions
    const aIsPreferred = a.key === 'agent:main:main' || a.key.includes('webchat');
    const bIsPreferred = b.key === 'agent:main:main' || b.key.includes('webchat');
    if (aIsPreferred && !bIsPreferred) return -1;
    if (!aIsPreferred && bIsPreferred) return 1;
    // Then prefer most recent (lowest age)
    return (a.age || Infinity) - (b.age || Infinity);
  })[0];
```

### Step 2: Setting Q in crewStatusMap (Line 241-256)
```typescript
if (qSession) {
  const age = qSession.age || 0;
  let qStatus: CrewMember['status'] = 'offline';
  if (age < 120000) { // 2 minutes = active
    qStatus = 'active';
  } else if (age < 600000) { 10 minutes = idle
    qStatus = 'idle';
  }

  crewStatusMap.set('q', {
    status: qStatus,
    model: qSession.model,
    contextPercent: qSession.percentUsed ?? undefined,  // <-- Sets context here
    currentTask: undefined,
  });
}
```

### Step 3: Building activeCrew (Line 276-285)
```typescript
const activeCrew = CREW_MEMBERS.map(c => {
  const status = crewStatusMap.get(c.id);
  return {
    ...c,
    status: status?.status ?? 'offline',
    model: status?.model,
    contextPercent: status?.contextPercent,  // <-- Should come from crewStatusMap
    currentTask: status?.currentTask,
  };
});
```

### Step 4: Setting qContextData (Line 314-319)
```typescript
set({
  sessions,
  activeCrew,
  ...
  qContextData: qSession ? {
    contextPercent: qSession.percentUsed,  // <-- Direct from qSession
    tokensUsed: qSession.totalTokens,
    tokensTotal: qSession.totalTokens + (qSession.remainingTokens || 0),
    tokensRemaining: qSession.remainingTokens || 0,
  } : null,
});
```

## Root Cause Identified: Session Selection Logic

### THE BUG: Sorting Prioritization Logic

The `qSession` selection uses sorting that **prefers** `agent:main:main` or `webchat` sessions over `telegram` sessions:

```typescript
const aIsPreferred = a.key === 'agent:main:main' || a.key.includes('webchat');
```

**The Problem:**
1. Q's actual session key is `agent:main:telegram:direct:8158771978`
2. This is NOT preferred (doesn't match 'agent:main:main' or 'webchat')
3. If there's ANY other session with `agent:main:main` (like a stale session) OR a `webchat` session, it will be picked INSTEAD
4. That stale session may have `percentUsed: 0` or `percentUsed: undefined`

## Evidence

Q's context (10%) exists in the actual session, but the sorting may be picking a different session that:
- Has `agent:main:main` key (a default/stale session)
- Or has `webchat` in the key
- This alternative session has `percentUsed: 0` or undefined

## Suggested Fix

**Option 1: Remove the preferential sorting for Q**
Q should just use the most recent main session, regardless of channel:

```typescript
const qSession = sessions
  .filter(s => s.agentId === 'main' && !s.key.includes('subagent'))
  .sort((a, b) => (a.age || Infinity) - (b.age || Infinity))[0];
```

**Option 2: Prioritize the actual requesting session**
If you have access to which session made the request, use that directly:

```typescript
// Get the current session key from somewhere (request context, etc.)
const currentSessionKey = getCurrentSessionKey(); // You'd need to implement this
const qSession = sessions
  .filter(s => s.agentId === 'main' && !s.key.includes('subagent'))
  .sort((a, b) => {
    // Prioritize the actual current session
    if (a.key === currentSessionKey) return -1;
    if (b.key === currentSessionKey) return 1;
    // Then by age
    return (a.age || Infinity) - (b.age || Infinity);
  })[0];
```

**Option 3: Filter out sessions with 0 tokens or old sessions**
```typescript
const qSession = sessions
  .filter(s => s.agentId === 'main' 
    && !s.key.includes('subagent')
    && s.totalTokens > 0)  // Only sessions with actual usage
  .sort((a, b) => (a.age || Infinity) - (b.age || Infinity))[0];
```

## Immediate Debugging Step

Add logging to confirm which session is being selected:

```typescript
const qSession = sessions
  .filter(s => s.agentId === 'main' && !s.key.includes('subagent'))
  .sort((a, b) => { ... })[0];

console.log('[GatewayStore] Q session candidates:', 
  sessions.filter(s => s.agentId === 'main' && !s.key.includes('subagent'))
    .map(s => ({ key: s.key, age: s.age, percentUsed: s.percentUsed, totalTokens: s.totalTokens }))
);
console.log('[GatewayStore] Selected Q session:', qSession ? {
  key: qSession.key,
  percentUsed: qSession.percentUsed,
  totalTokens: qSession.totalTokens,
} : null);
```

## Summary

| Component | Data Source |
|-----------|-------------|
| `qContextData` | Uses `qSession.percentUsed` directly |
| `activeCrew` Q entry | Uses `crewStatusMap.get('q').contextPercent` |

**Both use the same `qSession` variable**, so if `qContextData` works and `activeCrew` doesn't, the issue is likely:
1. `qSession` is sometimes undefined when `crewStatusMap.set('q', ...)` runs
2. OR there's a race condition where `activeCrew` is overwritten elsewhere
3. OR `qSession.percentUsed` is `undefined` at the time of assignment

**Most likely cause:** The sorting logic picks a stale/preferred session over the active telegram session.

## Recommended Fix

**Simplest fix** - remove the channel preference logic for Q:

```typescript
// Line 229-239: Replace the sort with simple age-based sorting
const qSession = sessions
  .filter(s => s.agentId === 'main' && !s.key.includes('subagent'))
  .sort((a, b) => (a.age || Infinity) - (b.age || Infinity))[0];
```

This ensures Q always shows the most recently active main session's context data.
