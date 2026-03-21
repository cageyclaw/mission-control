# Mission Control Agent Tracking - Test Report
**Date:** 2026-03-21  
**Tested By:** Riker (Subagent cac5118f-7ea8-4ac7-8d96-bca94d162244)

---

## ✅ What Works

### 1. Proxy Server
- **Status:** ✅ Operational
- **Endpoint:** `http://localhost:5181/api/status`
- **Response Time:** ~500ms
- **JSON Validation:** Correct - parses `openclaw status --json` output successfully
- **Error Handling:** Fixed stderr suppression with `2>/dev/null`

### 2. Main Session Detection
- **Session Key:** `agent:main:main` → Correctly detected as **Q**
- **Telegram Sessions:** `agent:main:telegram:*` → Correctly detected as **Q**
- **Active Status:** Sessions with `age < 120000ms` correctly marked as `active`

### 3. Subagent Registry System
- **Registration:** Works via `registerSubagent(sessionKey, crewId, task)`
- **Key Extraction:** Properly extracts UUID from sessionKey via `.split(':').pop()`
- **Auto-registration:** Fallback to 'unknown' when no spawn entry found

### 4. Activity Feed Infrastructure
- Feed entry creation works (spawn, complete, tool, message types)
- Type icons and colors mapped correctly
- Time formatting (`formatTimeAgo`) works as expected
- Task truncation (80 char limit) implemented

### 5. Crew Status Mapping
- Properly maps crew members to status based on session age
- Context percentage displays correctly
- Token counts extracted from session data

---

## ❌ What Doesn't Work / Bugs Found

### Bug 1: Session ID Mismatch (CRITICAL)
**Issue:** OpenClaw uses TWO different identifiers for subagents:
1. **Session Key last segment:** `agent:main:subagent:cac5118f-7ea8-4ac7-8d96-bca94d162244` → `cac5118f-7ea8-4ac7-8d96-bca94d162244`
2. **Session ID field:** `bd5359a9-1d89-4ad0-b74b-6864ee5794d9`

**Impact:** 
- WebSocket `subagent.spawn` event uses the **key's UUID** (`cac5118f...`)
- Status poll's `session.key` contains the SAME key UUID
- BUT `session.sessionId` field contains a DIFFERENT UUID!

**Current Behavior:**
- Register with key UUID: `cac5118f...` 
- Registry stores: `cac5118f...` → riker
- Status lookup uses `session.key.split(':').pop()`: `cac5118f...` ✓ (matches!)
- **Actually works for matching!**

**BUT Edge Case:** If any code uses `session.sessionId` instead of `session.key.split(':').pop()`, lookup will fail.

**Verification:** Tested - the current implementation correctly uses `session.key.split(':').pop()` which matches the registered key.

### Bug 2: Auto-Registration Overwrites Manual Registrations
**Location:** `src/stores/gateway.ts:updateStatus()`

**Issue:** The auto-detection in `updateStatus()` registers sessions with `crewId: 'unknown'` even if a manual registration already exists with the correct crew ID.

```typescript
// Line ~138: Checks if sessionId exists in registry
if (sessionId && !newMappings.has(sessionId)) {
  // This check uses session.key's last segment
```

**But:** If WebSocket `subagent.spawn` event hasn't arrived yet when status poll happens, auto-registration happens first with 'unknown', then WebSocket tries to register with correct crew ID.

**Fix Suggestion:** In `registerSubagent`, allow overwriting 'unknown' entries:
```typescript
registerSubagent: (sessionKey, crewId, task) => {
  const sessionId = sessionKey.split(':').pop() || sessionKey;
  const existing = get().subagentMappings.get(sessionId);
  
  // Allow overwriting 'unknown' or 'spawning' entries
  if (existing && existing.crewId !== 'unknown' && existing.status === 'active') {
    return; // Don't overwrite active known entries
  }
  // ... rest of registration
}
```

### Bug 3: Stale Subagent Sessions Accumulate
**Issue:** The `subagentMappings` Map in the store never cleans up old completed sessions.

**Impact:** Over time, memory usage grows. Old sessions from days ago remain in the registry.

**Fix Suggestion:** Add cleanup logic:
```typescript
// In updateStatus or on a timer
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
for (const [id, mapping] of subagentMappings) {
  if (Date.now() - mapping.spawnedAt > MAX_AGE_MS) {
    subagentMappings.delete(id);
  }
}
```

### Bug 4: Feed Entry Deduplication Weak
**Location:** `addFeedEntry` in `src/stores/gateway.ts`

```typescript
const exists = feed.some(e => e.id === entry.id);
```

**Issue:** This only prevents exact ID duplicates. But if the same event is received via WebSocket AND status poll with different IDs, duplicate entries appear.

**Recommendation:** Add content-based deduplication for same-timestamp events:
```typescript
const exists = feed.some(e => 
  e.id === entry.id || 
  (e.type === entry.type && 
   e.crewId === entry.crewId && 
   Math.abs(e.timestamp - entry.timestamp) < 1000 &&
   e.content === entry.content)
);
```

---

## 🔍 Edge Cases Discovered

### Edge Case 1: Rapid Subagent Spawning
If multiple subagents spawn within the same minute, the `recentSpawn` lookup in `updateStatus()` may pick the wrong crew:

```typescript
const recentSpawn = feed.find(e => 
  e.type === 'spawn' && 
  e.timestamp > Date.now() - 60000 // Within last minute
);
if (recentSpawn) {
  crewId = recentSpawn.crewId; // Could be wrong spawn!
}
```

**Fix:** Match by sessionId in feed entry if available.

### Edge Case 2: Session Key vs Session ID Confusion
While the current code correctly uses `session.key.split(':').pop()`, the existence of `session.sessionId` creates confusion. Future developers might mistakenly use the wrong field.

**Recommendation:** Add a comment in the code explaining this distinction.

### Edge Case 3: Subagents Completing Before Status Poll
If a subagent completes very quickly (under 10 seconds), it might:
1. Spawn → Register as 'spawning'
2. Complete → Update to 'completed' 
3. Status poll happens → Auto-register as 'active' (because session still exists in OpenClaw)
4. Now shows as active when actually completed

**Fix:** Check session age vs spawn time. If session is older than when we tracked the completion, don't auto-register.

---

## 📊 Test Results Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Proxy Server | ✅ PASS | Stable, returns valid JSON |
| Session Detection | ✅ PASS | Main & Telegram → Q, Subagents → correct crew |
| Status Polling | ✅ PASS | 5s interval, handles errors gracefully |
| WebSocket Events | ⚠️ NEEDS TEST | Code exists but couldn't verify in test environment |
| Activity Feed | ✅ PASS | All entry types render correctly |
| Crew Roster | ✅ PASS | Shows active/idle/offline correctly |
| Subagent Registry | ⚠️ PARTIAL | Works but has accumulation bug |

---

## 🛠️ Recommendations for Improvements

### High Priority
1. **Fix session cleanup** - Add TTL to subagent mappings
2. **Improve deduplication** - Content-based duplicate detection
3. **Add defensive coding** - Handle 'unknown' crew overwrites

### Medium Priority
4. **Add session age tracking** - Show "spawned 2m ago" in UI
5. **Add registry inspection UI** - Debug view showing all tracked subagents
6. **Add retry logic** - If status poll fails, exponential backoff

### Low Priority
7. **Add metrics** - Track how many subagents spawned/completed per day
8. **Add filtering** - Filter feed by crew member
9. **Export functionality** - Export activity log to JSON/CSV

---

## 📝 Final Verdict

**The Mission Control LCARS display is functional and shows who's on duty.**

The core functionality works:
- Main session (Q) shows as active ✅
- Subagent sessions ARE detected and mapped to crew members ✅  
- Activity feed structure is in place ✅
- Crew roster reflects actual session status ✅

**However**, the subagent tracking has edge cases and the registry will accumulate stale sessions over time. The implementation needs cleanup logic and better handling of the session ID vs session key distinction.

**Risk Level:** 🟡 MEDIUM - Works for daily use but will degrade over time without cleanup fixes.

---

## 🔧 Quick Fixes to Apply

```typescript
// Add to src/stores/gateway.ts - in updateStatus or as a new action:

// Cleanup old mappings every hour
const cleanupOldMappings = () => {
  const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
  set(state => {
    const mappings = new Map(state.subagentMappings);
    for (const [id, mapping] of mappings) {
      if (Date.now() - mapping.spawnedAt > MAX_AGE_MS && mapping.status === 'completed') {
        mappings.delete(id);
      }
    }
    return { subagentMappings: mappings };
  });
};

// Add to registerSubagent - prevent overwriting active known entries:
const existing = get().subagentMappings.get(sessionId);
if (existing && existing.crewId !== 'unknown' && existing.status === 'active') {
  return; // Don't overwrite
}
```

**End of Report**

---
*Report generated by Riker subagent for Mission Control QA*
