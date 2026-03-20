// OpenClaw Gateway WebSocket Client

import { useGatewayStore } from '../stores/gateway';
import type { FeedEntry, StatusData } from './types';

// Gateway connection config
const GATEWAY_URL = 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = 'ZOv3tXtMhz6rfzNgg_vfIH21qWdOi9PdytyHnASDwOA';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = 800;
let pendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void; timer: ReturnType<typeof setTimeout> }>();

let connectId: string | null = null;

export function connectGateway() {
  const store = useGatewayStore.getState();

  if (ws?.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(GATEWAY_URL);

  ws.addEventListener('open', () => {
    console.log('[MC] WebSocket open, marking as connected and waiting for challenge...');
    store.setConnected(true); // WebSocket is open
  });

  ws.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data);
    } catch (e) {
      console.error('[MC] Parse error:', e);
    }
  });

  ws.addEventListener('close', (event) => {
    console.log('[MC] WebSocket closed:', event.code, event.reason);
    // Don't immediately mark as offline - let health polling handle it
    // store.setConnected(false);
    connectId = null;
    scheduleReconnect();
  });

  ws.addEventListener('error', (error) => {
    console.error('[MC] WebSocket error:', error);
    // Don't immediately mark as offline - let health polling handle it
    // store.setConnected(false);
    connectId = null;
  });
}

function handleMessage(data: any) {
  const store = useGatewayStore.getState();

  // Challenge → send connect
  if (data.type === 'event' && data.event === 'connect.challenge') {
    console.log('[MC] Received challenge, marking as connected and sending connect...');
    store.setConnected(true); // WebSocket is working if we got challenge
    sendConnect();
    return;
  }

  // Response to our requests
  if (data.type === 'res') {
    console.log('[MC] Got response:', data.id, 'ok:', data.ok, 'error:', data.error);
    const pending = pendingRequests.get(data.id);
    
    // Check if this is the connect response
    if (data.id === connectId && data.ok) {
      console.log('[MC] Connected to gateway!');
      store.setConnected(true);
      backoff = 800;
      connectId = null;
      // Try to fetch status (may fail if no operator scope)
      fetchStatus().catch(() => {
        console.log('[MC] Status fetch failed - running in event-only mode');
      });
    }
    
    // Handle pending request resolution
    if (pending) {
      clearTimeout(pending.timer);
      pendingRequests.delete(data.id);
      if (data.ok) {
        pending.resolve(data.payload);
      } else {
        pending.reject(new Error(data.error?.message ?? 'request failed'));
      }
    }
    
    return;
  }

  // Any other event means we're connected
  if (data.type === 'event') {
    if (!store.connected) {
      console.log('[MC] Received event, marking as connected');
      store.setConnected(true);
    }
    handleEvent(data);
    return;
  }
}

function sendConnect() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  connectId = crypto.randomUUID();
  console.log('[MC] Sending connect with id:', connectId);
  const payload = {
    type: 'req',
    id: connectId,
    method: 'connect',
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'openclaw-control-ui',
        version: '0.1.0',
        platform: 'web',
      },
      role: 'control',
      scopes: [],
      caps: [],
      commands: [],
      permissions: {},
      auth: { token: GATEWAY_TOKEN },
      locale: 'en-US',
      userAgent: 'mission-control/0.1.0',
    },
  };
  console.log('[MC] Connect payload:', JSON.stringify(payload, null, 2));
  ws.send(JSON.stringify(payload));
}

function handleEvent(event: any) {
  const store = useGatewayStore.getState();

  switch (event.event) {
    case 'agent': {
      const payload = event.payload;
      const content = extractContent(payload);
      if (content) {
        const entry: FeedEntry = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          crewId: 'q',
          crewEmoji: '🧠',
          content,
          type: payload?.toolCalls ? 'tool' : 'message',
        };
        store.addFeedEntry(entry);
      }
      break;
    }

    case 'chat': {
      const payload = event.payload;
      if (payload?.state === 'final' || payload?.state === 'delta') {
        const content = extractChatContent(payload);
        if (content) {
          const entry: FeedEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            crewId: 'q',
            crewEmoji: '💬',
            content: content.slice(0, 120),
            type: 'message',
          };
          store.addFeedEntry(entry);
        }
      }
      break;
    }

    case 'presence': {
      console.log('[MC] Presence update:', event.payload);
      break;
    }

    case 'cron': {
      const entry: FeedEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        crewId: 'q',
        crewEmoji: '⏰',
        content: `Cron: ${event.payload?.event ?? 'update'}`,
        type: 'message',
      };
      store.addFeedEntry(entry);
      break;
    }
  }
}

function extractContent(payload: any): string | null {
  if (!payload) return null;
  if (typeof payload.text === 'string' && payload.text.trim()) {
    return payload.text.slice(0, 120);
  }
  if (Array.isArray(payload.content)) {
    const text = payload.content.find((c: any) => c.type === 'text')?.text;
    return text?.trim()?.slice(0, 120) ?? null;
  }
  return null;
}

function extractChatContent(payload: any): string | null {
  if (!payload?.message) return null;
  const msg = payload.message;
  if (typeof msg.text === 'string') return msg.text;
  if (Array.isArray(msg.content)) {
    const text = msg.content.find((c: any) => c.type === 'text')?.text;
    return text ?? null;
  }
  return null;
}

async function fetchStatus() {
  try {
    const status = await sendRequest('status', {});
    if (status) {
      console.log('[MC] Status received:', Object.keys(status));
      useGatewayStore.getState().updateStatus(status as StatusData);
    }
  } catch (e) {
    console.error('[MC] Status fetch failed:', e);
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    console.log('[MC] Reconnecting in', backoff, 'ms...');
    connectGateway();
    backoff = Math.min(backoff * 1.7, 15000);
  }, backoff);
}

export function disconnectGateway() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
}

export function sendRequest(method: string, params: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('Not connected'));
      return;
    }

    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Request timeout'));
    }, 15000);

    pendingRequests.set(id, { resolve, reject, timer });

    ws.send(JSON.stringify({ type: 'req', id, method, params }));
  });
}

// Poll status every 10 seconds
let statusInterval: ReturnType<typeof setInterval> | null = null;

export function startStatusPolling() {
  if (statusInterval) return;
  statusInterval = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      fetchStatus();
    }
  }, 10000);
}

export function stopStatusPolling() {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
}
