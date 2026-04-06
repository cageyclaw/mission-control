# OCC Backend Redesign Task List

## Goal
Rebuild OCC's backend/data integration to follow the actual OpenClaw Web UI model while keeping OCC's visual design and UX shell.

## Non-Goals
- Do not preserve current OCC proxy/chat/status plumbing just because it exists.
- Do not keep heuristic session/tool/feed inference when the real gateway provides authoritative data.
- Do not invent OCC-specific backend protocols unless temporarily needed for migration.

## Guiding Principle
**Keep the OCC skin. Replace the plumbing underneath it.**

---

# Phase 0 — Freeze and Baseline

## Objective
Stop expanding the current hybrid architecture and create a stable baseline before replacement begins.

## Tasks
- [x] Freeze new feature work on current proxy-based backend logic
- [x] Mark current proxy/chat/session plumbing as legacy in notes/docs
- [x] Capture a snapshot of current file structure and critical backend files
- [x] Document the real OpenClaw UI reference files and code paths

## Reference Files
- `/usr/local/lib/node_modules/openclaw/dist/control-ui/assets/index-DZHn5Bg6.js`
- `/usr/local/lib/node_modules/openclaw/dist/control-ui/assets/index-DZHn5Bg6.js.map`
- OpenClaw UI source paths from source map:
  - `../../../ui/src/ui/gateway.ts`
  - `../../../ui/src/ui/app-gateway.ts`
  - `../../../ui/src/ui/controllers/sessions.ts`
  - `../../../ui/src/ui/controllers/chat.ts`
  - `../../../ui/src/ui/app-tool-stream.ts`

## Deliverable
Short architecture baseline note committed into docs.

---

# Phase 1 — Native Gateway Client

## Objective
Create a single WebSocket-first OpenClaw gateway client modeled after the real OpenClaw Web UI.

## Tasks
- [x] Create a new `src/core/gatewayClient/` module
- [x] Implement direct browser/Electron WebSocket connection logic
- [x] Implement `connect.challenge` / `connect` handshake flow
- [x] Implement request/response correlation by request id
- [x] Implement event dispatch by gateway event name
- [x] Implement reconnect and backoff behavior
- [x] Implement bootstrap/config loading before connect

## Instructions
- Mirror the behavior of OpenClaw's real `gateway.ts`
- Do not mix this logic into React components or Zustand stores
- Keep this layer transport-focused only
- Support the real gateway RPC/event frame model directly

## Must Support
- `sessions.subscribe`
- `sessions.list`
- `chat.history`
- `chat.send`
- `chat.abort`
- `health`
- event routing for `sessions.changed`, `chat`, `agent`, `presence`, etc.

## Deliverable
A standalone native gateway client that can connect, authenticate, request, and receive events.

---

# Phase 2 — Session Store Rewrite

## Objective
Make session/context state come from the real OpenClaw session model instead of heuristics or polling authority.

## Tasks
- [ ] Create `src/stores/sessionsStore.ts`
- [ ] On connect, call `sessions.subscribe`
- [ ] Load initial session list using `sessions.list`
- [ ] Refresh sessions on `sessions.changed`
- [ ] Normalize session data by key
- [ ] Track `selectedSessionKey`, `mainSessionKey`, and `sessionsByKey`
- [ ] Derive OCC crew display state from real session data
- [ ] Remove heuristic session inference logic

## Instructions
- Treat the gateway as the source of truth
- Do not infer session identity from activity feed snippets or text parsing
- Map real session entities to OCC visual crew personas in selectors/view-models only
- Preserve OCC's look while changing the data model underneath

## Replace/Retire
- Heuristic `detectCrew` style session truth
- session authority from `/api/status` polling
- manual subagent/session inference if real session entities already exist

## Deliverable
Stable session/context model driven by gateway sessions subscription and refresh events.

---

# Phase 3 — Chat Rewrite

## Objective
Replace OCC's custom chat plumbing with the real OpenClaw chat flow.

## Tasks
- [ ] Create `src/stores/chatStore.ts` around native gateway client calls
- [ ] On session select, load `chat.history`
- [ ] On send, call `chat.send`
- [ ] Implement optimistic local user message append
- [ ] Track `runId` / idempotency key per send
- [ ] Stream assistant text from `chat` events (`delta`, `final`, `aborted`, `error`)
- [ ] Implement `chat.abort`
- [ ] Reconcile final state with persisted history as needed

## Instructions
- Follow the real OpenClaw UI behavior from `controllers/chat.ts`
- Keep transcript state separate from streaming state
- Do not invent OCC-specific websocket message schemas
- Do not use the existing proxy chat protocol as the long-term model

## State Model
- persisted message history
- current stream text
- pending user message
- active run id
- abort/error state

## Deliverable
A native OpenClaw chat implementation running inside OCC's existing visual shell.

---

# Phase 4 — Tool Activity Rewrite

## Objective
Use the real gateway tool/lifecycle event stream instead of synthetic or text-parsed tool activity.

## Tasks
- [ ] Create `src/stores/toolStore.ts`
- [ ] Ingest `agent` tool-stream events and/or real tool session events
- [ ] Normalize tool activity by session/run/tool-call id
- [ ] Track tool name, state, timestamps, summaries, results
- [ ] Render live tool activity rail/cards from normalized store data
- [ ] Segment streamed chat text around tool activity if needed

## Instructions
- Mirror the real OpenClaw UI separation between chat text stream and tool stream
- Do not parse assistant prose as the primary tool source
- Do not filter tool events by client-only run ids if upstream uses server engine ids

## Deliverable
Tool activity UI backed by native gateway tool events.

---

# Phase 5 — Activity Feed Rewrite ✅ COMPLETE

## Objective
Make the OCC activity feed a projection of normalized gateway/session/chat/tool state instead of a separate inferred truth system.

## Tasks
- [x] Redesign feed generation as selectors/view-models from normalized stores
  - Created `src/stores/activityFeedStore.ts` with pure selector functions
  - `computeSessionFeedEntries()` - derives spawn/error events from session state
  - `computeChatFeedEntries()` - derives message events from chat transcript
  - `computeToolFeedEntries()` - derives tool/file/process/search events from tool runs
- [x] Build feed entries from real session events, chat events, and tool events
  - Feed entries computed from `sessionsStore`, `chatStore`, `toolStore`
  - Entries are ephemeral/computed, never persisted
  - Deduplication and sorting handled in selector layer
- [x] Remove feed-driven session/crew inference
  - Uses `sessionsStore.getCrewDisplayState()` for crew state
  - Uses `sessionsStore.getSessionsForCrew()` for crew-specific sessions
  - No session detection from feed content parsing
- [x] Remove synthetic event generation where native events exist
  - Deleted synthetic spawn/complete generation from `gateway.ts`
  - Tool events come from actual gateway tool stream
  - Chat events come from actual chat transcript
- [x] Ensure feed remains visually OCC while technically grounded in real gateway data
  - Updated `ActivityFeed.tsx` to use new computed feed hooks
  - Preserved LCARS styling and visual language
  - Maintained grouping, filtering, and active tasks panel

## Implementation Details

### New Store: `src/stores/activityFeedStore.ts`
```typescript
// Core hooks for components
useComputedFeedEntries()     // All entries from all sources
useFilteredFeedEntries()     // Entries with filter/grouping applied
useActiveTasks()             // Currently running tasks
useFeedCountsByType()        // Counts for filter badges
useLastActivityTimestamp()   // Latest activity time
```

### Architecture Principles Enforced
- Feed is a **read-only view** — no state mutations from feed logic
- Session/tool/chat truth lives in **dedicated domain stores**
- Use **selectors** to compute feed entries from store state
- Feed entries are **ephemeral/computed**, not persisted

### Updated Components
- `ActivityFeed.tsx` - Now uses `useFilteredFeedEntries()` and `useActiveTasks()`
- Preserves all LCARS visual styling
- No visual changes to user experience

### Legacy Deprecation
- Marked `src/utils/feed.ts` as deprecated (kept for backward compatibility)
- Will remove in Phase 7 when legacy plumbing is deleted

## Deliverable
✅ A feed that reflects real state without driving or distorting it.

---

# Phase 6 — System / Diagnostics Cleanup

## Objective
Separate native gateway data from optional secondary polling and system metrics.

## Tasks
- [ ] Create `systemStore` for gateway-native system state
- [ ] Keep optional polling only where the gateway does not provide live events
- [ ] Keep metrics sidecar clearly separate from gateway-native state
- [ ] Distinguish gateway health from host metrics from UI connection state
- [ ] Remove status polling as authoritative source for session/chat/core truth

## Instructions
- Polling is acceptable for host/system metrics and secondary operational diagnostics
- Polling should not be the authority for session/chat/core gateway state
- Clarify labels in UI so users understand what is gateway state vs host state

## Deliverable
A cleaner system/diagnostics model with clear separation of concerns.

---

# Phase 7 — Delete Legacy OCC Plumbing

## Objective
Remove the old hybrid backend systems after the new path is proven.

## Tasks
- [ ] Remove `proxy-server.mjs` as core chat/session architecture
- [ ] Remove proxy-specific `/api/chat/session` path
- [ ] Remove proxy websocket event normalization for chat/tool flows
- [ ] Remove old status-authority assumptions
- [ ] Remove obsolete compatibility shims and duplicate stores
- [ ] Remove heuristic session/tool/subagent glue no longer needed
- [ ] Clean up package scripts and startup model

## Instructions
- Delete only after native gateway client path is fully verified
- Keep optional thin helper/proxy only if required for packaging/auth constraints
- Prefer fewer ports/processes in final product

## Deliverable
A simpler codebase with one coherent backend integration model.

---

# Phase 8 — Packaging Hardening

## Objective
Make the redesigned OCC stable for packaging, support, and distribution.

## Tasks
- [ ] Finalize Electron-first deployment model
- [ ] Persist gateway URL/token/device identity cleanly
- [ ] Build reconnect/offline UX
- [ ] Build diagnostics/log view for supportability
- [ ] Test local same-machine deployment thoroughly
- [ ] Test packaged desktop startup and reconnect behavior
- [ ] If browser mode is still needed, keep a very thin trusted proxy mode only

## Instructions
- Packaged OCC should behave as a native OpenClaw client with OCC visuals
- Minimize required helper services/processes
- Avoid architecture that depends on multiple sidecars just to work locally

## Deliverable
A stable packaged product path with fewer moving parts and fewer failure modes.

---

# Keep vs Delete Summary

## Keep
- OCC visual design
- OCC layout and navigation concepts
- OCC panel structure and branded user experience
- Optional metrics sidecar if useful
- Electron packaging shell

## Replace
- current backend transport layer
- current chat/session plumbing
- current status authority model
- current tool activity model
- current session inference model

## Delete Eventually
- `proxy-server.mjs` as core architecture
- proxy chat protocol
- proxy-specific event normalization
- synthetic status/session truth
- heuristic feed/session inference glue

---

# Recommended Implementation Order
1. Native gateway client
2. Session store rewrite
3. Chat rewrite
4. Tool activity rewrite
5. Activity feed rewrite
6. System/diagnostics cleanup
7. Delete legacy plumbing
8. Packaging hardening

---

# Success Criteria
- OCC opens and reliably shows session/context data using native OpenClaw session flow
- Chat works using `chat.history`, `chat.send`, and native event streams
- Tool activity is sourced from real tool events
- Activity feed is derived from real normalized state
- No mandatory OCC-specific backend bridge is required for packaged desktop use
- OCC looks unique but behaves like a faithful OpenClaw-native client

---

# Final Direction
**Do not keep patching the current hybrid.**

Build OCC as:
- a custom OpenClaw client
- using OpenClaw-native backend behavior
- with OCC's own visual identity on top
