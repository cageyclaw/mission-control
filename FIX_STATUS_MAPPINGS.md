# FIX_STATUS_MAPPINGS

## What was wrong

The status pipeline was collapsing distinct OpenClaw terminal states too early:

- In `src/stores/sessionsStore.ts`, `status === "done"` was incorrectly mapped to `offline`.
- That same file later translated `offline` back into registry `completed`, which meant the UI never received a real `completed` state.
- In `src/components/crew/CrewCard.tsx`, the color mapping was also wrong:
  - `offline` was painted **blue**
  - there was no explicit `completed` handling
- `timeout` was being treated as generic `idle`, so it was not preserved as a distinct terminal state.
- `killed` was not given a distinct crew display state in the session display pipeline.

## What I changed

### 1. Preserved distinct session states in `src/stores/sessionsStore.ts`

Updated `inferStatus()` so OpenClaw statuses map cleanly to display states:

- `running` → `active`
- `done` → `completed`
- `failed` → `error`
- `killed` → `stopped`
- `timeout` → `timed-out`
- no session / missing session → `offline`

Also updated fallback handling for crew members without an active session so registry state can still surface:

- `completed` remains `completed`
- timed-out completed sessions show as `timed-out`
- errors remain `error`
- otherwise default to `offline`

Registry reconciliation was also updated so:

- `completed` and `timed-out` are stored as registry `completed`
- `stopped` is stored as registry `error`
- `openclawStatus` is preserved for terminal-state detail

### 2. Fixed crew card display in `src/components/crew/CrewCard.tsx`

Updated OCC card colors/text so they match intended semantics:

- `active` → green / `[ACTIVE]`
- `idle` → yellow / `[IDLE]`
- `completed` → blue / `[COMPLETED]`
- `timed-out` → yellow / `[TIMED OUT]`
- `stopped` → red / `[STOPPED]`
- `error` → red / `[ERROR]`
- `offline` → gray / `[OFFLINE]`

This corrects the previous bug where `offline` was displayed in blue.

### 3. Extended shared status typing

Updated `src/api/types.ts` so `CrewMember.status` supports:

- `active`
- `idle`
- `completed`
- `timed-out`
- `stopped`
- `offline`
- `error`

Updated `src/utils/crew.ts` color helper to match the same status meanings.

### 4. Build fix discovered during verification

While verifying, TypeScript build surfaced an unrelated strictness issue in `src/components/views/CostView.tsx` where `session.age` could be `undefined`.

Fixed by safely handling `session.age ?? Infinity`.

## Verification

Verified by building the project successfully with:

```bash
npm run build
```

Build result: **passed**

### Status mapping verification

Based on the new session-to-display mapping:

- Running sessions render as **green** (`active`)
- Completed sessions render as **blue** (`completed`)
- Failed sessions render as **red** (`error`)
- Killed sessions render as **red** (`stopped`)
- Timeout sessions render as **yellow** (`timed-out`)
- No session renders as **gray** (`offline`)

## Files changed

- `src/api/types.ts`
- `src/stores/sessionsStore.ts`
- `src/components/crew/CrewCard.tsx`
- `src/utils/crew.ts`
- `src/components/views/CostView.tsx`
