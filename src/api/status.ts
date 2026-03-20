// Health polling — healthz and readyz via Vite proxy

import { useGatewayStore } from '../stores/gateway';
import type { GatewayHealth, GatewayReady, StatusData } from './types';

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startHealthPolling() {
  if (pollTimer) return;
  pollHealthz();
  pollStatus(); // Also poll for full status
  pollTimer = setInterval(() => {
    pollHealthz();
    pollStatus();
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
    const res = await fetch('/healthz');
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
    const readyRes = await fetch('/readyz');
    const ready: GatewayReady = await readyRes.json();
    useGatewayStore.getState().updateReady(ready);
  } catch {
    useGatewayStore.getState().updateHealth({ ok: false, status: 'offline' });
  }
}

// Poll full status via proxy server (since WebSocket requires operator scope)
async function pollStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const status: StatusData = await res.json();
    useGatewayStore.getState().updateStatus(status);
    console.log('[MC] Status updated via proxy');
  } catch (e) {
    console.log('[MC] Status proxy unavailable, running with limited data');
  }
}
