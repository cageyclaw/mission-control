# OpenClaw UI Reference Paths for OCC Redesign

Date: 2026-03-30
Purpose: Pin the real OpenClaw UI implementation references OCC should mirror for backend behavior.

## Runtime Bundle References

Validated local bundle artifacts (for this installed OpenClaw version):
- `/usr/local/lib/node_modules/openclaw/dist/control-ui/assets/index-DZHn5Bg6.js`
- `/usr/local/lib/node_modules/openclaw/dist/control-ui/assets/index-DZHn5Bg6.js.map`

> Note: `index-*.js` and `index-*.js.map` asset hashes change between OpenClaw versions/builds.
> Treat the filename hash as version-specific and re-locate the current bundle when updating OpenClaw.

## Canonical Source Paths (from source map)

Use these paths as behavioral references during OCC backend rewrite:
- `../../../ui/src/ui/gateway.ts`
- `../../../ui/src/ui/app-gateway.ts`
- `../../../ui/src/ui/controllers/sessions.ts`
- `../../../ui/src/ui/controllers/chat.ts`
- `../../../ui/src/ui/app-tool-stream.ts`

## Why These Matter

- `gateway.ts` / `app-gateway.ts`:
  - WebSocket connection lifecycle
  - connect challenge/connect handshake behavior
  - request/response/event frame handling
- `controllers/sessions.ts`:
  - session subscribe/list/refresh model
  - session state lifecycle from gateway events
- `controllers/chat.ts`:
  - chat.history/chat.send/chat.abort flow
  - stream handling and message reconciliation model
- `app-tool-stream.ts`:
  - separation of tool stream state from plain chat transcript

## OCC Mapping Rule

For Phases 1–4, OCC should map its backend behavior to these references first, then adapt into OCC stores/view-models.

Visual layer remains OCC-specific; transport/state semantics should be OpenClaw-native.
