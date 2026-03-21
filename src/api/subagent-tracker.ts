/**
 * Subagent Tracker Module
 * 
 * Tracks subagent spawn/completion events and updates the Mission Control dashboard.
 * This module intercepts subagent lifecycle events and maps them to crew members.
 */

import { useGatewayStore } from '../stores/gateway';
import { inferCrewFromTask, getSubagentMapping } from '../utils/crew';

/**
 * Track a subagent spawn event
 * Call this when spawning a subagent via sessions_spawn
 */
export function trackSubagentSpawn(
  sessionKey: string,
  task?: string,
  agentIdHint?: string
): void {
  const store = useGatewayStore.getState();

  // Determine crew from task or agent hint
  let crewId = agentIdHint || inferCrewFromTask(task);

  // If still unknown, check if we can parse from task more broadly
  if (!crewId && task) {
    const taskLower = task.toLowerCase();
    // Check for explicit crew mentions
    if (taskLower.includes('riker')) crewId = 'riker';
    else if (taskLower.includes('data')) crewId = 'data';
    else if (taskLower.includes('geordi')) crewId = 'geordi';
    else if (taskLower.includes('spark')) crewId = 'spark';
    else if (taskLower.includes('troi')) crewId = 'troi';
    else if (taskLower.includes('barclay')) crewId = 'barclay';
  }

  // Default to 'unknown' if we can't determine
  if (!crewId) {
    crewId = 'unknown';
    console.log('[SubagentTracker] Could not determine crew for task:', task?.substring(0, 50));
  }

  // Register in the store - the feed entry is created by gateway.ts
  store.registerSubagent(sessionKey, crewId, task);

  console.log(`[SubagentTracker] Tracked ${crewId} spawn:`, sessionKey.substring(0, 40) + '...');
}

/**
 * Track a subagent completion event
 * Call this when a subagent announces completion
 */
export function trackSubagentComplete(
  sessionKey: string,
  status: 'completed' | 'failed' | 'timeout' = 'completed'
): void {
  const store = useGatewayStore.getState();

  // Update status to completing
  store.updateSubagentStatus(sessionKey, 'completing');

  // Get the mapping to determine crew
  const mapping = getSubagentMapping(sessionKey);
  const crewId = mapping?.crewId || 'unknown';

  // Add completion to feed - Note: completion entry is already added by gateway.ts
  // This is for tracking purposes only
  const statusText = status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'timed out';
  console.log(`[SubagentTracker] Tracked ${crewId} completion (${statusText})`);

  // Mark as completed
  store.updateSubagentStatus(sessionKey, 'completed');

  console.log(`[SubagentTracker] Tracked ${crewId} completion (${status}):`, sessionKey.substring(0, 40) + '...');
}

/**
 * Parse an internal subagent announce event
 * This handles the runtime-generated completion events
 */
export function handleSubagentAnnounce(event: {
  source?: string;
  sessionKey?: string;
  sessionId?: string;
  status?: string;
  result?: string;
}): void {
  if (event.source !== 'subagent') return;

  const sessionKey = event.sessionKey || '';
  const status = event.status?.includes('success') ? 'completed' : 
                 event.status?.includes('error') ? 'failed' : 
                 event.status?.includes('timeout') ? 'timeout' : 'completed';

  trackSubagentComplete(sessionKey, status);
}

/**
 * Hook for components to track their own subagent spawns
 * Usage: const { trackSpawn } = useSubagentTracker();
 */
export function useSubagentTracker() {
  return {
    trackSpawn: trackSubagentSpawn,
    trackComplete: trackSubagentComplete,
  };
}
