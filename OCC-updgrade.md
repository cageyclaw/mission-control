# OCC Upgrade / Backend Redesign Session Notes

## Purpose
This file captures the full OCC backend redesign plan, the execution process being used, and the exact current status so work can resume cleanly next session.

Project root:
- `/Users/maccagey/.openclaw/workspace/projects/mission-control/`

Primary task list reference:
- `docs/occ-backend-redesign-tasklist.md`

---

# Core Direction

## Product Goal
OCC should remain a custom visual shell / skin over OpenClaw, but its backend/data/chat/session/tool plumbing should be rebuilt to follow the **actual OpenClaw Web UI model**.

## Strategic Decision
Do **not** keep patching the old OCC hybrid architecture.

Keep:
- OCC visual design
- OCC layout / navigation
- OCC branding and UX shell

Replace:
- legacy proxy-centric chat/session plumbing
- status polling as authority for session truth
- heuristic session / crew / tool inference where real gateway data exists
- duplicated competing state authorities

## Source of Truth
The real OpenClaw Web UI running at:
- `http://127.0.0.1:18789/`

Reference artifacts identified during this session:
- `/usr/local/lib/node_modules/openclaw/dist/control-ui/assets/index-DZHn5Bg6.js`
- `/usr/local/lib/node_modules/openclaw/dist/control-ui/assets/index-DZHn5Bg6.js.map`

Important OpenClaw UI code paths traced from source maps:
- `ui/src/ui/gateway.ts`
- `ui/src/ui/app-gateway.ts`
- `ui/src/ui/controllers/sessions.ts`
- `ui/src/ui/controllers/chat.ts`
- `ui/src/ui/app-tool-stream.ts`

---

# Working Process Being Used

## Implementation Workflow
For each phase:
1. **Geordi** implements the phase.
2. **Riker** reviews the phase.
3. If Riker rejects or conditionally rejects:
   - Geordi performs a correction pass.
   - Riker reviews again.
   - Repeat until approved.
4. Once Riker approves:
   - move automatically to the next phase.

## Roles
- **Geordi** = implementation / code changes
- **Riker** = architecture / QA / signoff review

## Rule
No phase is considered complete until **Riker signs off**.

---

# Full Redesign Plan

## Phase 0 — Freeze and Baseline
### Objective
Freeze expansion of the old hybrid backend and document the baseline.

### Deliverables
- freeze notes
- baseline architecture notes
- OpenClaw UI reference paths
- redesign task list baseline

### Status
- **Approved / Complete**

---

## Phase 1 — Native Gateway Client
### Objective
Create a new WebSocket-first native gateway client modeled on real OpenClaw UI transport.

### Intended scope
- direct gateway WS client
- connect.challenge / connect flow
- request/response correlation
- event dispatch
- reconnect/backoff
- bootstrap/config loading

### Final outcome of phase
Implemented in:
- `src/core/gatewayClient/types.ts`
- `src/core/gatewayClient/events.ts`
- `src/core/gatewayClient/bootstrap.ts`
- `src/core/gatewayClient/gatewayClient.ts`
- `src/core/gatewayClient/index.ts`

### Review history
- Phase 1: rejected by Riker
- Phase 1.5: rejected by Riker
- Phase 1.6: approved with caveats

### Notes
The native client became good enough to serve as the transport foundation, but is **not yet the only active path** in the app.

### Status
- **Approved / Complete enough to proceed**

---

## Phase 2 — Session Store Rewrite
### Objective
Make session/context state come from the real OpenClaw session model instead of polling or heuristics.

### Intended scope
- `sessionsStore`
- `sessions.subscribe`
- `sessions.list`
- `sessions.changed` refresh
- normalized sessions by key
- selected/main session state
- crew/session mapping from real session entities

### Final outcome of phase
Implemented new native session authority path with:
- `src/stores/sessionsStore.ts`
- app startup integration
- removal of `/api/status` as session authority on new path

### Review history
- Phase 2: rejected by Riker
- Phase 2.1: rejected by Riker
- Phase 2.2: rejected by Riker
- Phase 2.3: approved by Riker

### Important final note
The blocker was deterministic cold-load subagent/crew mapping. Final fix used:
- `pollSubagents()` as active mapping hydration path
- deferred + deduped authoritative refresh into `sessionsStore`

### Status
- **Approved / Complete enough to proceed**

---

## Phase 3 — Chat Rewrite
### Objective
Replace OCC custom chat plumbing with the real OpenClaw chat flow.

### Intended scope
- native `chat.history`
- native `chat.send`
- native `chat.abort`
- optimistic user append
- run/idempotency tracking
- native `chat` event stream (`delta`, `final`, `aborted`, `error`)
- transcript separated from active stream

### Final outcome of phase
Implemented in:
- `src/stores/chatStore.ts`
- `src/stores/chat.ts` compatibility re-export
- shared singleton gateway client for sessions + chat

### Review outcome
- **Approved with caveats**

### Caveats noted by Riker
- optimistic send failure handling needed cleanup (addressed during Phase 4 work)
- stale history load race needed cleanup (addressed during Phase 4 work)
- partial output handling on abort/error needed explicit policy (addressed during Phase 4 work)

### Status
- **Approved / Complete enough to proceed**

---

## Phase 4 — Tool Activity Rewrite
### Objective
Use the real gateway tool/lifecycle event stream instead of synthetic or text-parsed tool activity.

### Intended scope
- `toolStore`
- ingest real `agent` / tool-stream events
- normalize tool activity by session/run/tool-call id
- render tool rail/cards from normalized store
- keep tool stream separate from chat text stream

### Geordi implementation completed
Implemented:
- `src/stores/toolStore.ts`
- Chat tool rail/cards wired to native tool store
- Native tool event ingestion from gateway events
- Tool normalization by session/run/toolCall

Also addressed Phase 3 caveat cleanups in this phase:
- optimistic send failure now marks message error
- stale history guarded with token
- aborted/error preserves partial assistant output

### Review status
- **NOT YET REVIEWED / SIGNED OFF**

This is where the session stopped.

---

## Phase 5 — Activity Feed Rewrite
### Objective
Make OCC activity feed a projection of normalized real state instead of inferred synthetic truth.

### Planned scope
- feed generated from session/chat/tool/subagent events
- remove feed-driven session/crew inference
- remove synthetic feed truth where native events exist

### Status
- **Not started**

---

## Phase 6 — System / Diagnostics Cleanup
### Objective
Separate native gateway state from optional polling/host metrics and clean up authority boundaries.

### Planned scope
- system store cleanup
- polling only for secondary / non-streaming metrics
- clear distinction between gateway state and host metrics

### Status
- **Not started**

---

## Phase 7 — Delete Legacy OCC Plumbing
### Objective
Remove the old hybrid backend systems once the native path is proven.

### Planned scope
- remove core reliance on `proxy-server.mjs`
- remove proxy chat protocol
- remove legacy session/status authority assumptions
- remove heuristic glue no longer needed

### Status
- **Not started**

---

## Phase 8 — Packaging Hardening
### Objective
Prepare redesigned OCC for stable packaging and distribution.

### Planned scope
- finalize Electron-first deployment path
- settings persistence
- reconnect/offline UX
- diagnostics/log support
- packaged app hardening

### Status
- **Not started**

---

# Exact Current Status / Resume Point

## Last fully approved phase
- **Phase 3 approved**

## Current phase in progress when session stopped
- **Phase 4 implemented by Geordi, but NOT yet reviewed by Riker**

## Current blocking action needed next session
### Immediate next step:
Spawn **Riker** to review **Phase 4 (Tool Activity Rewrite)**.

If Riker approves:
- proceed automatically to **Phase 5**.

If Riker rejects:
- run a **Phase 4.x correction pass** with Geordi
- loop until Riker approves.

---

# What Geordi Completed in Phase 4

## Files created/changed
- `src/stores/toolStore.ts` **(new)**
- `src/components/chat/ChatView.tsx`
- `src/stores/chatStore.ts`

## Claimed behavior implemented
- native tool store subscribing to real gateway `agent` tool-stream events
- tool activity normalized by:
  - `sessionKey`
  - `runId`
  - `toolCallId`
- tool rail/cards now read from native tool store
- chat store now:
  - initializes tool store
  - guards stale history loads
  - marks optimistic send failures as error
  - preserves partial assistant output on aborted/error

## Build status
- `npm run build` passed after Phase 4 changes

## Pending review caveats for Riker
1. Validate actual live tool event payload shape against environment
2. Confirm old legacy feed/tool inference is no longer the primary source for chat tool activity
3. Decide whether tool history should persist across reconnects or session switches (`toolStore.disconnect()` currently clears in-memory tool state)

---

# Files Created During Planning / Baseline Work

## Planning and baseline docs
- `docs/occ-backend-redesign-tasklist.md`
- `docs/occ-phase0-freeze-legacy-note.md`
- `docs/occ-phase0-baseline-snapshot.md`
- `docs/occ-openclaw-ui-reference-paths.md`
- `docs/occ-backend-architecture-baseline.md`

---

# Recommended Resume Script Next Session

1. Confirm project file exists:
   - `docs/occ-backend-redesign-tasklist.md`
2. Confirm current phase status from this file.
3. Spawn:
   - `Riker-Review-Phase4`
4. If approved:
   - spawn `Geordi-Redesign-Phase5`
5. Continue the same loop:
   - Geordi implements
   - Riker reviews
   - corrections until approved

---

# Short Resume Summary

We stopped after **Geordi completed Phase 4**.

### Approved so far
- Phase 0
- Phase 1 (after correction loops)
- Phase 2 (after correction loops)
- Phase 3

### Pending
- Phase 4 Riker review

### Next action
- **Riker review of Phase 4**

---

# Final Note
Do not resume by patching legacy OCC behavior casually.
Resume using the redesign process already established:
- native OpenClaw model first
- OCC visual shell preserved
- Geordi implementation
- Riker review/signoff loop
