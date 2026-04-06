/**
 * Chat API via Proxy — REMOVED IN PHASE 7
 *
 * This file has been removed. Chat functionality is now handled natively
 * by the gateway client in src/core/gatewayClient/ and the chatStore.
 *
 * Migration Path:
 *   - Import chat hooks from: stores/chatStore.ts
 *   - Use useChatStore() for chat state and operations
 *   - Session resolution → sessionsStore
 *   - WebSocket connection → gatewayClient.connect()
 *
 * @see src/stores/chatStore.ts
 * @see src/core/gatewayClient/
 */

export const CHAT_API_VIA_PROXY_REMOVED = 'Phase 7: Use chatStore and native gateway client';
