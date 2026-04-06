# Store Architecture — Phase 7 (Complete)

## Overview

The OCC store architecture now follows a **single source of truth** model:

- **Gateway-native state** → WebSocket events → event-driven stores
- **No proxy server** → Direct gateway WebSocket connection
- **No status polling** → Events drive all state changes
- **Fewer ports** → Only gateway WebSocket (18789) required

## Data Source Map

| Data | Source | Store |
|------|--------|-------|
| **Sessions** | Gateway events | `sessionsStore.ts` |
| **Chat messages** | Gateway events | `chatStore.ts` |
| **Tool runs** | Gateway events | `toolStore.ts` |
| **Gateway connection** | WebSocket lifecycle | `systemStore.ts` |
| **Gateway health** | `health` RPC endpoint | `systemStore.ts` |
| **Channels** | `status` RPC endpoint | `systemStore.ts` |
| **Host CPU/Memory/Disk** | Metrics sidecar | `hostMetricsStore.ts` |

## Architecture Changes (Phase 7)

### Removed Components
- ❌ `proxy-server.mjs` — No longer needed
- ❌ `/api/status` polling — Status comes from gateway events
- ❌ `/api/chat/session` endpoint — Sessions from gateway events
- ❌ Heuristic crew detection — Registry-based from gateway
- ❌ `express` and `ws` dependencies — No proxy server

### Current State
- ✅ One WebSocket to gateway
- ✅ One coherent state model
- ✅ No status polling
- ✅ Simpler codebase
- ✅ Native OpenClaw client behavior

## Store Responsibilities

### sessionsStore.ts
Session lifecycle, crew state, session selection. Pure event-driven.
Receives session data from gateway `sessions.list` RPC and `sessions.changed` events.

### chatStore.ts
Chat messages, streaming state, history. Pure event-driven.
Receives chat data from `chat` events via native gateway client.

### toolStore.ts
Tool activity tracking. Pure event-driven.
Receives tool data from `tool` events via native gateway client.

### systemStore.ts
Gateway-native system state:
- Connection state (from WebSocket lifecycle)
- Health status (from `health` RPC)
- Ready state (from hello/ready events)
- Channels (from `status` RPC, polled every 30s)

### hostMetricsStore.ts
Host OS metrics from optional sidecar:
- CPU usage
- Memory usage
- Disk usage
- Load average

### activityFeedStore.ts
Computed feed projection from sessions/chat/tool stores.
Read-only — never generates synthetic events.

## Phase 7 Migration Guide

### What Changed

| Old (Proxy) | New (Native) |
|-------------|--------------|
| `proxy-server.mjs` | `src/core/gatewayClient/` |
| `resolveProxyUrl('/api/status')` | `systemStore.ts` |
| `resolveProxyUrl('/api/chat/session')` | `sessionsStore.ts` |
| `inferCrewFromTask()` | Registry from gateway events |
| Polling | WebSocket events |
| 2 ports (5181/5182) | 1 port (18789) |

### For Component Developers

```typescript
// Before (Proxy)
import { fetchChatSession } from '../api/chat';
const session = await fetchChatSession();

// After (Native)
import { useSessionsStore } from '../stores/sessionsStore';
const sessionKey = useSessionsStore(state => state.mainSessionKey);
```

```typescript
// Before (Proxy polling)
import { startHealthPolling } from '../api/status';
startHealthPolling();

// After (Native events)
import { useSystemStore } from '../stores/systemStore';
const health = useSystemStore(state => state.health);
```

## Success Criteria

✅ Native gateway client connects successfully  
✅ Sessions load from gateway events  
✅ Chat works via native WebSocket  
✅ Tool activity displays from real events  
✅ Activity feed derives from stores  
✅ System view shows gateway health correctly  
✅ No mandatory proxy server required  
✅ Build passes, app runs correctly

## UI Data Source Labels

All System/Diagnostics panels show data source:
- **Gateway** — Native gateway data (WebSocket events)
- **Sidecar** — Host metrics (optional polling)
