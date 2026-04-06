# OCC Backend Redesign — Phase 7 Complete

## Summary

Phase 7 of the OCC Backend Redesign is complete. The old hybrid backend systems have been removed, leaving OCC as a native OpenClaw client with a simplified, unified architecture.

## Files Removed/Modified

### Removed as Core Architecture (replaced with stubs)

| File | Status | Notes |
|------|--------|-------|
| `proxy-server.mjs` | Replaced with stub | Proxy server removed; app connects directly to gateway |
| `src/utils/feed.ts` | Replaced with stub | Feed now computed in activityFeedStore.ts |
| `src/api/chat.ts` | Replaced with stub | Chat via native gateway client in chatStore.ts |
| `src/api/status.ts` | Replaced with stub | Status from systemStore.ts gateway events |
| `src/api/gateway.ts` | Replaced with stub | Legacy adapter; use core/gatewayClient/ |

### Modified for Simplification

| File | Changes |
|------|---------|
| `src/utils/crew.ts` | Removed legacy heuristic detection; simplified to registry-based mapping |
| `src/api/control.ts` | Removed proxy-dependent code; now uses gateway/Electron IPC |
| `src/api/subagent-tracker.ts` | Deprecated; functions are now no-ops (gateway handles tracking) |
| `src/config.ts` | `proxyBaseUrl` deprecated; `resolveProxyUrl()` returns empty string |
| `src/App.tsx` | Removed `startHealthPolling`/`stopHealthPolling` calls |
| `package.json` | Removed `express` and `ws` dependencies; simplified scripts |
| `scripts/start-occ.mjs` | Deprecated; now delegates to Vite directly |
| `src/stores/README.md` | Updated for Phase 7 architecture |

### Removed Dependencies

```json
// From package.json dependencies:
- "express": "^4.21.2"
- "ws": "^8.20.0"
```

### Updated Package Scripts

```json
// Before:
"dev": "node scripts/start-occ.mjs dev",
"dev:with-proxy": "node scripts/start-occ.mjs dev",
"preview": "node scripts/start-occ.mjs preview",
"preview:with-proxy": "node scripts/start-occ.mjs preview",

// After:
"dev": "vite",
"preview": "vite preview",
```

### Updated Electron Build Config

```json
// Removed from build.files:
- "proxy-server.mjs"

// Removed from asarUnpack:
- "proxy-server.mjs"
- "node_modules/ws/**/*"
```

## Architecture Changes

### Before Phase 7 (Hybrid)
```
Browser <-> Proxy Server (5181/5182) <-> Gateway (18789)
           (HTTP + WebSocket)       (WebSocket)
```

### After Phase 7 (Native)
```
Browser <-> Gateway (18789)
         (WebSocket)
```

## Success Criteria Verification

✅ **Native gateway client connects successfully**  
The native gateway client in `src/core/gatewayClient/` connects directly to the OpenClaw gateway.

✅ **Sessions load from gateway events**  
`sessionsStore.ts` receives sessions from gateway `sessions.list` RPC and `sessions.changed` events.

✅ **Chat works via native WebSocket**  
`chatStore.ts` uses `gatewayClient.chatSend()` and listens for `chat` events.

✅ **Tool activity displays from real events**  
`toolStore.ts` receives tool runs from gateway `tool` events.

✅ **Activity feed derives from stores**  
`activityFeedStore.ts` computes feed entries as projections of sessions/chat/tool state.

✅ **System view shows gateway health correctly**  
`systemStore.ts` receives health from gateway `health` RPC and connection events.

✅ **No mandatory OCC-specific backend bridge required**  
The proxy server is completely optional; OCC runs with just the native gateway client.

✅ **Build passes without errors**  
`npm run build` completes successfully with TypeScript strict mode.

## Migration Path

### For Existing Code

| Old Pattern | New Pattern |
|-------------|-------------|
| `import { fetchChatSession } from './api/chat'` | `useSessionsStore(state => state.mainSessionKey)` |
| `import { startHealthPolling } from './api/status'` | `useSystemStore(state => state.health)` |
| `import { trackSubagentSpawn } from './api/subagent-tracker'` | Handled automatically by gateway events |
| `resolveProxyUrl('/api/status')` | Direct gateway client RPC |

### For New Development

- **Sessions**: Use `useSessionsStore()` — event-driven from gateway
- **Chat**: Use `useChatStore()` — native gateway client
- **Tools**: Use `useToolStore()` — tool events from gateway
- **Feed**: Use `useFeedEntries()` from `activityFeedStore.ts` — computed projection
- **Health**: Use `useSystemStore()` — gateway health events

## Documentation

- `src/stores/README.md` — Updated store architecture documentation
- Stub files contain migration notes pointing to new APIs

## Build Verification

```bash
cd projects/mission-control
npm run build
# ✓ TypeScript compilation successful
# ✓ Vite build successful
```

## Next Steps

The Phase 7 cleanup is complete. OCC now runs as a native OpenClaw client:
- Single WebSocket connection to gateway
- Event-driven state management
- Simpler codebase with one backend integration model
- No mandatory proxy server

If a thin helper/proxy is needed for specific deployment scenarios (packaging, auth constraints), it can be added as an optional component, but the core architecture is now unified around the native gateway client.
