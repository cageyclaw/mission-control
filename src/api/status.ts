// Health polling — healthz and readyz via Vite proxy

import { useGatewayStore } from '../stores/gateway';
import { registerSubagentWithDualIds } from '../utils/crew';
import { resolveProxyUrl } from '../config';
import type { GatewayHealth, GatewayReady, StatusData } from './types';

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startHealthPolling() {
  if (pollTimer) return;
  pollHealthz();
  pollStatus(); // Also poll for full status
  pollSubagents(); // Poll recent subagent runs
  pollTimer = setInterval(() => {
    pollHealthz();
    pollStatus();
    pollSubagents(); // Regularly sync with runs.json
  }, 5000);
}

export function stopHealthPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollHealthz() {
  try {
    const res = await fetch(await resolveProxyUrl('/healthz'));
    const health: GatewayHealth = await res.json();
    useGatewayStore.getState().updateHealth(health);
    
    // If health check succeeds, gateway is reachable
    if (health.ok) {
      const store = useGatewayStore.getState();
      if (!store.connected) {
        store.setConnected(true);
      }
    }

    // Also try readyz
    const readyRes = await fetch(await resolveProxyUrl('/readyz'));
    const ready: GatewayReady = await readyRes.json();
    useGatewayStore.getState().updateReady(ready);
  } catch {
    useGatewayStore.getState().updateHealth({ ok: false, status: 'offline' });
  }
}

// Poll full status via proxy server (since WebSocket requires operator scope)
async function pollStatus() {
  try {
    const res = await fetch(await resolveProxyUrl('/api/status'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const status: StatusData = await res.json();
    useGatewayStore.getState().updateStatus(status);
    console.log('[MC] Status updated via proxy');
  } catch (e) {
    console.log('[MC] Status proxy unavailable, running with limited data');
  }
}

// Poll subagent runs from the dedicated endpoint
async function pollSubagents() {
  try {
    const res = await fetch(await resolveProxyUrl('/api/subagents'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    if (data.runs && Array.isArray(data.runs)) {
      const store = useGatewayStore.getState();
      
      data.runs.forEach((run: any) => {
        // Register each subagent run in both the store and utility registry
        const keyUuid = run.sessionId; // This is the key UUID from session.key
        const actualSessionId = run.runId; // Use runId as fallback
        
        // Check if already registered
        const existing = store.subagentMappings.get(keyUuid);
        if (!existing) {
          // Register with dual IDs for maximum compatibility
          registerSubagentWithDualIds(
            keyUuid,
            actualSessionId,
            run.crewId,
            run.task
          );
          
          // Also register in store
          store.registerSubagent(run.sessionKey, run.crewId, run.task);
          
          // Add spawn entry to feed if this is a new run
          const recentSpawn = store.feed.find(e => 
            e.type === 'spawn' && 
            e.crewId === run.crewId &&
            Math.abs(e.timestamp - run.createdAt) < 5000
          );
          
          if (!recentSpawn && run.status === 'running') {
            store.addFeedEntry({
              id: crypto.randomUUID(),
              timestamp: run.createdAt,
              crewId: run.crewId,
              crewEmoji: getCrewEmoji(run.crewId),
              type: 'spawn',
              content: `spawned: ${run.task?.substring(0, 60) || 'Subagent task'}`,
              task: run.task,
              status: 'running',
            });
          }
        }
        
        // Update status if completed
        if (run.status === 'completed' && existing?.status !== 'completed') {
          store.updateSubagentStatus(run.sessionKey, 'completed');
          
          // Add completion entry to feed
          const recentComplete = store.feed.find(e => 
            e.type === 'complete' && 
            e.crewId === run.crewId &&
            Math.abs(e.timestamp - (run.endedAt || Date.now())) < 5000
          );
          
          if (!recentComplete) {
            store.addFeedEntry({
              id: crypto.randomUUID(),
              timestamp: run.endedAt || Date.now(),
              crewId: run.crewId,
              crewEmoji: '✅',
              type: 'complete',
              content: `completed: ${run.task?.substring(0, 60) || 'Task'}`,
              task: run.task,
              status: 'success',
            });
          }
        }
      });
      
      console.log('[MC] Subagent runs synced:', data.runs.length, 'runs');
    }
  } catch (e) {
    console.log('[MC] Subagent endpoint unavailable:', (e as Error).message);
  }
}

function getCrewEmoji(crewId: string): string {
  const emojiMap: Record<string, string> = {
    q: '🧠',
    data: '🔍',
    geordi: '🔧',
    spark: '⚡',
    riker: '🎯',
    troi: '💝',
    barclay: '🎨',
    unknown: '🤖',
  };
  return emojiMap[crewId] || '🤖';
}
