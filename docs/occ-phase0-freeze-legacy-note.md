# OCC Backend Redesign — Phase 0 Freeze & Legacy Note

Date: 2026-03-30
Owner: OCC backend redesign stream
Status: **ACTIVE** (Phase 0 baseline)

## Freeze Decision

Effective immediately, **no new feature work** should be added to the current proxy-based backend path.

This freeze applies to:
- `proxy-server.mjs` behavior expansion
- proxy-specific chat protocol changes
- new logic that increases coupling between OCC UI state and `/api/status` polling
- additional session/tool inference heuristics on top of current hybrid plumbing

Allowed during freeze:
- bug fixes needed to keep the current build usable
- documentation, baseline capture, and migration prep
- implementation work for the new native gateway client path (Phase 1+)

## Legacy Classification (Current Plumbing)

The following are now classified as **legacy backend plumbing** and targeted for replacement:

- Proxy transport and event normalization
  - `proxy-server.mjs`
  - `src/api/chat.ts` (`chatProxyClient`, proxy websocket coupling)
- Hybrid status authority and inferred session truth
  - `src/api/status.ts`
  - `src/stores/gateway.ts`
  - `src/utils/crew.ts`
  - `src/utils/feed.ts`
- Proxy-coupled chat/session wiring
  - `src/stores/chat.ts`
  - `src/components/chat/*` (data contract level, not visual shell)

## Practical Rule for Contributors

If a backend-related change is requested, default to one of:
1. Put it in docs as migration intent, or
2. Implement it on the new native gateway architecture path,

and **do not** deepen the legacy proxy/hybrid path unless required for stability.
