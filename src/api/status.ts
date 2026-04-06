/**
 * Status Polling via Proxy — REMOVED IN PHASE 7
 *
 * This file has been removed. System state is now derived from:
 *   - systemStore.ts — Gateway health and connection state
 *   - sessionsStore.ts — Session and crew state from gateway events
 *   - hostMetricsStore.ts — Host metrics from optional sidecar
 *
 * Migration Path:
 *   - Gateway connection state → useSystemStore()
 *   - Session/crew state → useSessionsStore()
 *   - Health polling → systemStore.refreshHealth()
 *
 * @see src/stores/systemStore.ts
 * @see src/stores/sessionsStore.ts
 * @see src/stores/hostMetricsStore.ts
 */

export const STATUS_POLLING_VIA_PROXY_REMOVED = 'Phase 7: Use systemStore and sessionsStore';
