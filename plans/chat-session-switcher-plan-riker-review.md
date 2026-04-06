# OCC Chat Session Switcher Plan — Riker Review

**Reviewer:** Riker  
**Date:** 2026-04-02  
**Plan Author:** Geordi  
**Status:** APPROVED with Minor Notes

---

## Executive Summary

This is a solid plan that correctly identifies the existing store infrastructure and focuses the implementation on UI layer components. The phased rollout strategy is prudent.

---

## Assessment

### 1. OpenClaw Gateway Integration Check ✅

The plan correctly accounts for OpenClaw gateway integration:

| Gateway Capability | Plan Coverage | Status |
|-------------------|---------------|--------|
| Session listing via `sessionsList()` | Section 4.1, 5.1 | ✅ Covered |
| Session subscription via `sessionsSubscribe()` | Implicit via sessionsStore | ✅ Covered |
| Chat history isolation via `chatHistory(sessionKey)` | Section 3, 4.2 | ✅ Covered |
| Message routing via `chatSend(sessionKey, ...)` | Section 4.2 | ✅ Covered |
| Connection resilience | Section 5.1 item 2 | ✅ Covered |

**Note:** The plan appropriately leverages the existing `NativeGatewayClient` implementation which already handles session-keyed operations. No new gateway RPC methods are required.

---

### 2. Completeness Analysis

#### Well-Covered Areas ✅

1. **Store Infrastructure** — Correctly notes that `sessionsStore` and `chatStore` already support switching via the subscription pattern.

2. **UI Component Design** — Comprehensive specs for `SessionSelector` with accessibility requirements.

3. **Accessiblity** — Proper ARIA attributes (`aria-haspopup`, `aria-expanded`, `role="listbox"`) are specified.

4. **Phased Rollout** — The `showSessionSelector` flag in section 2.1 allows safe A/B testing.

5. **Edge Case Handling** — Good coverage of: empty states, session disappearance, rapid switching, streaming interruption.

#### Gaps Identified ⚠️

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| **No mention of loading states during history fetch** | Low | Add UI state for "Loading session history..." spinner/overlay |
| **Keyboard shortcut for session switching not addressed** | Low | Consider `Cmd/Ctrl+Shift+[` and `]` for next/prev session |
| **No session-specific notification/activity badge** | Medium | Sessions may have unread messages; should indicate in dropdown |
| **`sessionsSubscribe()` event handling not mentioned** | Medium | Real-time session list updates (other clients creating sessions) need UI refresh |
| **No persistence of last-selected session on client** | Low | Consider `localStorage` to restore selection on reconnect |

---

### 3. Edge Cases & Risks

#### Well-Identified ✅
- Rapid switching with `historyLoadToken` race protection (5.1.4)
- Selected session disappearing after refresh (5.1.3)
- Streaming response interruption on switch (5.1.5)

#### Additional Risks to Address ⚠️

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Session count grows large (10+ sessions)** | Medium | Add search/filter to dropdown; virtualize if >20 sessions |
| **Session labels collide (same display name)** | Low | Show truncated key suffix in tooltip/menu for disambiguation |
| **Gateway `event` frame with new session arrives** | Medium | Ensure `sessionsStore` handles `session.created` events and updates UI |
| **Mobile viewport truncation** | Medium | Design responsive: full-screen modal on small screens vs dropdown on desktop |
| **Accessibility: focus management** | Medium | Return focus to trigger after dropdown closes (Escape or selection) |

---

### 4. Suggested Improvements

#### Immediate (pre-implementation)
1. **Add loading indicator spec** in Section 3.4 — when switching sessions, show intermediate state while `loadHistoryForSession` resolves.

2. **Add `onSessionChangeStart/onSessionChangeComplete` callbacks** to `SessionSelector` for potential animations or telemetry.

3. **Document event subscription** in Section 4.1 — ensure `sessionsStore.refreshSessions()` is triggered on:
   - `session.created`
   - `session.updated` 
   - `session.terminated` events

4. **Add a "Recent Sessions" section** in dropdown if session list >5 items — prioritize quick access.

#### Post-MVP enhancements (not blocking)
1. Keyboard shortcuts for power users
2. Session pinning/favoriting
3. Session search/filter
4. Session-specific notification badges

---

### 5. Implementation Sequence Validation

Geordi's suggested sequence (Section 6) is sound and low-risk:

```
Component → Integration → Enable → Wording → Tests → QA
```

**One addition:** Consider adding step between 5 and 6 for **accessibility audit** — verify focus management and screen reader behavior.

---

### 6. Acceptance Criteria Validation

All 5 acceptance criteria are clear and testable:

1. ✅ User interaction spec'd
2. ✅ Updated context areas listed
3. ✅ Isolation guarantees covered
4. ✅ Edge case resilience noted
5. ✅ Backward compatibility preserved

**Suggest adding:** "Screen reader announces 'Session changed to <X>' on switch"

---

## Final Verdict

**APPROVED with Minor Notes**

The plan is ready for implementation. The identified gaps are non-blocking enhancements or minor polish items that can be addressed in-flight or as fast-follows.

---

## Action Items for Geordi

1. **Consider adding** loading state spec to Section 3.4 (optional but recommended)
2. **Consider adding** focus management requirements to Section 1.5
3. **Verify** `sessionsStore` subscribes to `session.*` events for real-time list updates
4. **Proceed with implementation** — plan is solid

---

*End of Review*
