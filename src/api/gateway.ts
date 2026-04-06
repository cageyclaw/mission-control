/**
 * Legacy Gateway Adapter — REMOVED IN PHASE 7
 *
 * This file has been removed. The native gateway client in
 * src/core/gatewayClient/ is now the sole gateway interface.
 *
 * Migration Path:
 *   - Gateway connection → createNativeGatewayClient() in gatewayClient/
 *   - Events → Native event bus with onEvent()
 *   - Requests → Native request() method
 *   - Connection state → systemStore or gatewayClient.onState()
 *
 * @see src/core/gatewayClient/
 * @see src/stores/systemStore.ts
 */

export const LEGACY_GATEWAY_ADAPTER_REMOVED = 'Phase 7: Use native gateway client';
