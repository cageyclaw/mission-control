# OCC Phase 0 Baseline Snapshot

Date: 2026-03-30
Purpose: Capture concrete pre-redesign structure and critical backend files before replacement work.

## Repository Structure Snapshot (high-level)

Top-level directories at snapshot time:
- `.git/`
- `dist/`
- `docs/`
- `electron/`
- `logs/`
- `node_modules/`
- `public/`
- `release/`
- `scripts/`
- `src/`
- `systemd/`

## Source Tree Snapshot (`src/`)

- `src/App.tsx`
- `src/api/`
  - `chat.ts`
  - `control.ts`
  - `device-auth.ts`
  - `gateway.ts`
  - `status.ts`
  - `subagent-tracker.ts`
  - `types.ts`
- `src/stores/`
  - `chat.ts`
  - `gateway.ts`
- `src/utils/`
  - `crew.ts`
  - `feed.ts`
- `src/components/` (chat/crew/feed/layout/panels/ui/views)

## Critical Backend Files (legacy baseline)

Primary legacy backend files and sizes at snapshot:
- `proxy-server.mjs` — 32,006 bytes
- `src/api/gateway.ts` — 21,430 bytes
- `src/api/status.ts` — 6,746 bytes
- `src/api/chat.ts` — 5,844 bytes
- `src/stores/chat.ts` — 16,254 bytes
- `src/stores/gateway.ts` — 16,221 bytes
- `src/utils/crew.ts` — 11,379 bytes
- `src/utils/feed.ts` — 9,079 bytes

## Baseline Architecture Reality (before redesign)

Current OCC backend behavior is hybrid:
- Gateway connectivity exists (`src/api/gateway.ts`) but is not the sole source of truth
- Chat path is proxy-websocket-centric (`src/api/chat.ts`, `src/stores/chat.ts`)
- Session/crew state relies on status polling + heuristic inference (`src/api/status.ts`, `src/stores/gateway.ts`, `src/utils/crew.ts`)
- Activity feed has synthetic/inferred behavior (`src/utils/feed.ts`)

This snapshot is the reference point for Phase 1 migration planning and validation.
