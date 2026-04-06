#!/usr/bin/env node
/**
 * Mission Control Proxy Server — REMOVED IN PHASE 7
 *
 * This file has been removed as part of the OCC Backend Redesign Phase 7.
 *
 * The native gateway client in src/core/gatewayClient/ is now the sole
 * backend integration mechanism. OCC connects directly to the OpenClaw
 * gateway WebSocket without requiring a proxy bridge.
 *
 * Migration Path:
 *   - HTTP API calls → Direct gateway client RPC
 *   - WebSocket events → Native gateway client events
 *   - Session resolution → sessionsStore via gateway events
 *   - Chat → chatStore via gateway events
 *   - Tool activity → toolStore via gateway events
 *
 * @see src/core/gatewayClient/
 * @see src/stores/
 */

console.error('[proxy-server] This component has been removed in Phase 7. Use the native gateway client instead.');
process.exit(1);
