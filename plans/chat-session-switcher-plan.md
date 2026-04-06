# OCC Chat Session Switcher — Implementation Plan

## Goal
Enable users to click the active session label at the top of chat and switch to another available session via dropdown, while preserving current chat reliability guarantees (history loading, stream isolation, optimistic sends, and session-aware tool activity).

---

## Current Behavior Summary (from code)
- `chatStore` already listens to `sessionsStore.selectedSessionKey` and auto-switches chat context + loads history when it changes.
- `sessionsStore` already exposes:
  - `selectedSessionKey`
  - `mainSessionKey`
  - `sessionKeys`, `sessionsByKey`, `getSessions()`
  - `selectSession(sessionKey | null)`
- `ChatView` currently pulls chat state only from `useChatStore`; no session selection UI is present.
- `ChatStatusCard` currently displays static `Session` and `Session Key` rows, but no interactive control.

This means most backend/store wiring exists; the missing piece is primarily UI + minor integration glue.

---

## 1) New `SessionSelector` Component

### 1.1 Create component file
**Path:** `src/components/chat/SessionSelector.tsx`

### 1.2 Component responsibilities
- Render current selected session as a clickable trigger (button style).
- Open/close dropdown listing available sessions.
- Call `useSessionsStore.getState().selectSession(sessionKey)` (or hook selector) when user picks one.
- Show meaningful labels instead of raw keys when possible.

### 1.3 Data to read from store
Use `useSessionsStore` selectors for:
- `selectedSessionKey`
- `mainSessionKey`
- `sessionKeys`
- `sessionsByKey`
- `selectSession`

Derive:
- `effectiveSelectedKey = selectedSessionKey ?? mainSessionKey`
- `sessions = sessionKeys.map(k => sessionsByKey[k]).filter(Boolean)`

### 1.4 Dropdown item display format
Per session row:
- Primary: `displayName || label || key`
- Secondary meta (smaller text): `status`, optional model, optional “Main” badge when `key === mainSessionKey`
- Optional truncation for long keys, with full key as `title` tooltip.

### 1.5 Interaction and accessibility
- Trigger is a `<button>` with:
  - `aria-haspopup="listbox"`
  - `aria-expanded`
  - `aria-controls`
- Dropdown uses `role="listbox"`; options use `role="option"` and `aria-selected`.
- Close behavior:
  - on outside click
  - on Escape
  - after selection
- Keyboard:
  - Enter/Space opens
  - Up/Down moves highlighted item (nice-to-have but recommended)

### 1.6 Empty/unavailable states
- If no sessions, render disabled trigger text: `No session available`.
- If sessions list exists but selected key is missing (race condition), fallback to main session label or first available session label in UI only (actual selection still controlled by store).

### 1.7 Styling hooks
Add class names (example):
- `occ-session-selector`
- `occ-session-selector__trigger`
- `occ-session-selector__menu`
- `occ-session-selector__option`
- `occ-session-selector__option--active`
- `occ-session-selector__meta`

(Implement in existing chat stylesheet/module where `ChatStatusCard` styles live.)

---

## 2) Modify `ChatStatusCard` to Integrate Selector

### 2.1 Add optional interactive mode props
Update `ChatStatusCardProps` with:
- `showSessionSelector?: boolean` (default `false` for safe rollout)

Alternative: always render selector and remove old session key row; but phased rollout is safer.

### 2.2 Replace static session key row
Current rows:
- Gateway status row
- Session status row
- Session key row (static)

Plan:
- Keep Gateway and Session status rows.
- Replace `Session Key` value with `<SessionSelector />` when interactive mode enabled.
- Keep static fallback text when selector disabled.

### 2.3 Keep error/hint logic intact
Do not alter:
- `lastError` status region
- reconnect hint behavior (`!connected && !lastError`)

### 2.4 UX wording update
Change label text from `Session Key` to `Active Session` when selector is visible (clearer intent).

---

## 3) Enhance `ChatView` for Session Context

### 3.1 Pull selected session details for context UI
In `ChatView.tsx`, read from `useSessionsStore`:
- `selectedSessionKey`
- `mainSessionKey`
- `sessionsByKey`

Derive active session object:
- `activeSessionKey = selectedSessionKey ?? mainSessionKey ?? sessionKey` (chat store key as final fallback)
- `activeSession = activeSessionKey ? sessionsByKey[activeSessionKey] : null`

### 3.2 Enable selector in status card
Pass flag/props into `ChatStatusCard`:
- `showSessionSelector={true}`

### 3.3 Update empty-state copy (remove “main session only” wording)
Current copy hardcodes main-session language:
- “No active main session...”
- “Chat requires an active main session...”

Update to session-agnostic language:
- “No active session is available...”
- “Select or start a session, then retry.”

### 3.4 Optional: add active session banner
Add lightweight context line near transcript top:
- `Viewing session: <displayName/label/key>`
- Useful confirmation after switching.

### 3.5 Tool panel alignment check
`ToolActivityPanel` already uses `sessionKey` from `chatStore`, which will update after session switch. No logic change needed; verify visually that activity changes with selected session.

---

## 4) Store Integration Points

## 4.1 `sessionsStore` (likely no code changes required)
Existing behavior already supports switching:
- `selectSession()` validates target exists.
- `refreshSessions()` preserves current selection if still valid; otherwise falls back to `mainSessionKey`.

Potential enhancement (optional):
- Add small selector helper for sorted sessions (e.g., most recently updated first) if UI should not mirror raw `sessionKeys` ordering.

### 4.2 `chatStore` (confirm behavior, minimal tweaks)
Existing subscription already does the heavy lifting:
- On session key change:
  - resets transcript/stream/pending state
  - sets `sessionStatus`
  - bumps `historyLoadToken`
  - loads history for new session

Recommended minor hardening:
1. **Preserve user intent on switch while awaiting response**
   - Current behavior clears pending run (good for isolation).
   - Add optional warning UI (in component layer) before switching if `isAwaitingResponse` true.
2. **Status fidelity when selected key invalidates**
   - Already handled by sessions store fallback; verify no transient stale key in UI.

### 4.3 Initialization ordering validation
`chatStore.initialize()` reads selected/main key from sessions store once, then subscription handles updates. Ensure app boot path initializes sessions before/alongside chat (existing behavior likely already does).

---

## 5) Edge Cases + Testing Plan

## 5.1 Functional edge cases
1. **No sessions available**
   - Selector disabled
   - Session status shows `Missing`
   - Composer disabled
2. **Gateway disconnected**
   - Selector still visible (optional) but sending blocked by chat connection checks
   - Existing reconnect hint preserved
3. **Selected session disappears after refresh**
   - `sessionsStore.refreshSessions()` falls back to `mainSessionKey`
   - `chatStore` switches and reloads history automatically
4. **Rapid switching between sessions**
   - `historyLoadToken` should prevent stale history race from overwriting newer selection
5. **Switch during streaming response**
   - Previous stream state should clear on switch
   - New session starts clean and loads its history
6. **Long/ugly keys and missing labels**
   - UI remains legible via truncation + tooltip; fallback label always available

### 5.2 Unit tests (store)
- `sessionsStore.selectSession` rejects unknown key.
- `sessionsStore.refreshSessions` retains valid selected key; falls back when invalid.
- `chatStore` subscription:
  - clears stream/transcript state on session switch
  - calls `loadHistoryForSession(newKey)`
  - ignores chat events from non-active session keys
- `loadHistoryForSession` token race test (older request resolves last but is ignored).

### 5.3 Component tests
- `SessionSelector`:
  - renders active session label
  - opens menu on click
  - selecting option calls `selectSession` with correct key
  - handles empty sessions state
- `ChatStatusCard`:
  - renders selector in interactive mode
  - renders static session key in fallback mode

### 5.4 Integration/E2E checks
1. Open chat, confirm active session shown at top.
2. Switch to another session via dropdown.
3. Verify transcript updates to that session’s history.
4. Send message; confirm message routes to selected session.
5. Switch back; confirm prior session transcript remains intact.
6. Verify tool activity panel follows active chat session.

---

## Suggested Implementation Sequence (Low-Risk)
1. Build `SessionSelector` component + styles.
2. Integrate into `ChatStatusCard` behind `showSessionSelector` prop.
3. Enable prop in `ChatView`.
4. Update chat empty-state wording to remove “main session only” assumptions.
5. Add/adjust tests (component first, then store/integration).
6. Manual QA with live gateway and at least 2 active sessions.

---

## Acceptance Criteria
- User can click active session in chat status area and select another session from dropdown.
- Switching sessions updates:
  - active chat transcript/history
  - message send target
  - tool activity context (already session-keyed)
- No stale transcript bleed between sessions.
- UI remains stable when sessions disappear, gateway disconnects, or rapid switches occur.
- Existing chat error/reconnect behavior is preserved.