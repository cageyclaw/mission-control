/**
 * Subagent Tracker Module — Phase 7 (Deprecated)
 *
 * This module provided subagent tracking functionality during the transition
 * from hybrid architecture to native gateway client.
 *
 * In Phase 7+, subagent tracking is handled by:
 *   - sessionsStore.ts — Receives session lifecycle events from gateway
 *   - activityFeedStore.ts — Computes feed entries from gateway events
 *   - toolStore.ts — Receives tool activity from gateway events
 *
 * This module is kept for backward compatibility but all functions are
 * no-ops. The subagent lifecycle is now fully managed by the gateway client.
 *
 * @deprecated Use stores/sessionsStore.ts and stores/activityFeedStore.ts instead
 */

/**
 * Track a subagent spawn event
 * @deprecated Gateway events now automatically handle subagent tracking
 */
export function trackSubagentSpawn(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sessionKey: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _task?: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _agentIdHint?: string
): void {
  // Phase 7: No-op — subagent tracking is now handled by gateway events
  // via sessionsStore.ts
  console.log('[SubagentTracker] trackSubagentSpawn is deprecated in Phase 7');
}

/**
 * Track a subagent completion event
 * @deprecated Gateway events now automatically handle subagent tracking
 */
export function trackSubagentComplete(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sessionKey: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _status: 'completed' | 'failed' | 'timeout' = 'completed'
): void {
  // Phase 7: No-op — subagent tracking is now handled by gateway events
  console.log('[SubagentTracker] trackSubagentComplete is deprecated in Phase 7');
}

/**
 * Parse an internal subagent announce event
 * @deprecated Gateway events now automatically handle subagent tracking
 */
export function handleSubagentAnnounce(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _event: {
    source?: string;
    sessionKey?: string;
    sessionId?: string;
    status?: string;
    result?: string;
  }
): void {
  // Phase 7: No-op — subagent tracking is now handled by gateway events
  console.log('[SubagentTracker] handleSubagentAnnounce is deprecated in Phase 7');
}

/**
 * Hook for components to track their own subagent spawns
 * @deprecated Use sessionsStore hooks instead
 */
export function useSubagentTracker() {
  console.warn('[SubagentTracker] useSubagentTracker is deprecated in Phase 7');
  return {
    trackSpawn: trackSubagentSpawn,
    trackComplete: trackSubagentComplete,
  };
}
