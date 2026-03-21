// OpenClaw Gateway WebSocket Client

import { useGatewayStore } from '../stores/gateway';
import type { FeedEntry, StatusData } from './types';
import { inferCrewFromTask } from '../utils/crew';

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

// Feed Entry Generators for Rich Activity Tracking

function createToolEntry(
  tool: string,
  params: any,
  crewId: string = 'q',
  task?: string
): FeedEntry {
  const crewEmoji = getCrewEmoji(crewId);
  
  // Sanitize and summarize tool invocation
  const summary = summarizeToolInvocation(tool, params);
  
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    crewId,
    crewEmoji,
    type: 'tool',
    content: summary,
    task,
    toolInvocation: {
      tool,
      params: sanitizeParams(params),
      summary,
    },
    status: 'success',
  };
}

/* File operation entry - prepared for future use
function createFileEntry(
  operation: 'read' | 'write' | 'edit',
  path: string,
  crewId: string = 'q',
  task?: string
): FeedEntry {
  const crewEmoji = getCrewEmoji(crewId);
  const fileName = path.split('/').pop() || path;
  
  const verb = operation === 'read' ? 'read' : operation === 'write' ? 'wrote' : 'edited';
  
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    crewId,
    crewEmoji,
    type: 'file',
    content: `${verb} ${fileName}`,
    task,
    fileOperation: {
      operation,
      path,
    },
    status: 'success',
  };
}
*/

/* Process execution entry - prepared for future use
function createProcessEntry(
  command: string,
  workingDir?: string,
  crewId: string = 'q',
  task?: string
): FeedEntry {
  const crewEmoji = getCrewEmoji(crewId);
  const cmd = command.split(' ')[0]; // Just the command name
  
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    crewId,
    crewEmoji,
    type: 'process',
    content: `executed ${cmd}`,
    task,
    processExecution: {
      command: sanitizeCommand(command),
      workingDir,
    },
    status: 'success',
  };
}
*/

function createSpawnEntry(
  crewId: string,
  task?: string
): FeedEntry {
  const taskSummary = task ? `: ${truncate(task, 60)}` : '';
  
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    crewId,
    crewEmoji: getCrewEmoji(crewId),
    type: 'spawn',
    content: `spawned${taskSummary}`,
    task,
    status: 'running',
  };
}

function createCompleteEntry(
  crewId: string,
  status: 'success' | 'error',
  task?: string
): FeedEntry {
  const emoji = status === 'success' ? '✅' : '❌';
  const taskSummary = task ? `: ${truncate(task, 50)}` : '';
  
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    crewId,
    crewEmoji: emoji,
    type: 'complete',
    content: `completed${taskSummary}`,
    task,
    status: status === 'success' ? 'success' : 'error',
  };
}

/* Web search entry - prepared for future use
function createSearchEntry(
  query: string,
  crewId: string = 'q',
  task?: string
): FeedEntry {
  const crewEmoji = getCrewEmoji(crewId);
  
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    crewId,
    crewEmoji,
    type: 'search',
    content: `searched "${truncate(query, 40)}"`,
    task,
    status: 'success',
  };
}
*/

// Helper functions
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

function summarizeToolInvocation(tool: string, params: any): string {
  switch (tool) {
    case 'read':
      return `read ${params.file_path?.split('/').pop() || 'file'}`;
    case 'write':
      return `wrote ${params.path?.split('/').pop() || 'file'}`;
    case 'edit':
      return `edited ${params.file_path?.split('/').pop() || 'file'}`;
    case 'exec':
      return `executed ${params.command?.split(' ')[0] || 'command'}`;
    case 'web_search':
      return `searched web`;
    case 'web_fetch':
      return `fetched page`;
    case 'image':
      return `analyzed image`;
    default:
      return `invoked ${tool}`;
  }
}

function sanitizeParams(params: any): Record<string, any> {
  if (!params || typeof params !== 'object') return {};
  
  // Remove sensitive data, keep only metadata
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (['file_path', 'path', 'url', 'command', 'query'].includes(key)) {
      sanitized[key] = typeof value === 'string' ? truncate(value, 100) : value;
    }
  }
  return sanitized;
}

/* Command sanitization - prepared for future use
function sanitizeCommand(command: string): string {
  // Remove sensitive flags/args, keep just the command structure
  const parts = command.split(' ');
  const safeParts = parts.filter(p => 
    !p.includes('password') && 
    !p.includes('token') && 
    !p.includes('key') &&
    !p.startsWith('-')
  );
  return safeParts.slice(0, 3).join(' '); // Limit to first 3 parts
}
*/

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function extractToolCalls(content: string): Array<{ tool: string; params: any }> {
  const tools: Array<{ tool: string; params: any }> = [];
  
  // Try to parse tool calls from various formats
  // Format 1: exec command="..."
  const execMatch = content.match(/executed?\s+(?:command\s+)?`?([^`\n]+)`?/i);
  if (execMatch) {
    tools.push({ tool: 'exec', params: { command: execMatch[1] } });
  }
  
  // Format 2: read/write/edit file
  const fileMatch = content.match(/(read|wrote|edited)\s+(?:file\s+)?`?([^`\n]+)`?/i);
  if (fileMatch) {
    const operation = fileMatch[1] === 'wrote' ? 'write' : 
                      fileMatch[1] === 'edited' ? 'edit' : 'read';
    tools.push({ tool: operation, params: { file_path: fileMatch[2] } });
  }
  
  // Format 3: search
  const searchMatch = content.match(/search(?:ed)?\s+(?:for\s+)?["']([^"']+)["']/i);
  if (searchMatch) {
    tools.push({ tool: 'web_search', params: { query: searchMatch[1] } });
  }
  
  return tools;
}

function handleEvent(event: any) {
  const store = useGatewayStore.getState();

  switch (event.event) {
    case 'agent': {
      const payload = event.payload;
      const crewId = event.agentId || event.sessionKey?.split(':')[0] || 'q';
      
      // Check for tool calls in the payload
      if (payload?.toolCalls && Array.isArray(payload.toolCalls)) {
        for (const toolCall of payload.toolCalls) {
          const entry = createToolEntry(
            toolCall.tool,
            toolCall.params,
            crewId,
            payload.task
          );
          store.addFeedEntry(entry);
        }
      }
      
      // Check for explicit tool execution
      if (payload?.tool && payload?.params) {
        const entry = createToolEntry(
          payload.tool,
          payload.params,
          crewId,
          payload.task
        );
        store.addFeedEntry(entry);
        break;
      }
      
      // Regular message content
      const content = extractContent(payload);
      if (content) {
        // Try to extract tool calls from content for legacy compatibility
        const toolCalls = extractToolCalls(content);
        if (toolCalls.length > 0) {
          for (const tc of toolCalls) {
            const entry = createToolEntry(tc.tool, tc.params, crewId, payload?.task);
            store.addFeedEntry(entry);
          }
        } else {
          // Regular message
          const entry: FeedEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            crewId,
            crewEmoji: getCrewEmoji(crewId),
            type: 'message',
            content: content.slice(0, 120),
            task: payload?.task,
          };
          store.addFeedEntry(entry);
        }
      }
      break;
    }

    case 'chat': {
      const payload = event.payload;
      const crewId = event.agentId || 'q';
      if (payload?.state === 'final' || payload?.state === 'delta') {
        const content = extractChatContent(payload);
        if (content) {
          // Don't add empty chat events
          if (content.trim()) {
            const entry: FeedEntry = {
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              crewId,
              crewEmoji: '💬',
              type: 'message',
              content: content.slice(0, 120),
            };
            store.addFeedEntry(entry);
          }
        }
      }
      break;
    }

    case 'presence': {
      console.log('[MC] Presence update:', event.payload);
      break;
    }

    case 'cron': {
      const crewId = event.agentId || 'q';
      const entry: FeedEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        crewId,
        crewEmoji: '⏰',
        type: 'cron',
        content: `cron ${event.payload?.event ?? 'update'}`,
      };
      store.addFeedEntry(entry);
      break;
    }

    // Handle subagent lifecycle events
    case 'subagent': {
      const payload = event.payload;
      if (payload?.event === 'spawn') {
        // Subagent was spawned
        const { sessionKey, task, agentId } = payload;
        
        // Try to determine crew from task or agentId
        let crewId = agentId;
        if (!crewId && task) {
          // Check if task mentions a specific crew member
          const taskLower = task.toLowerCase();
          if (taskLower.includes('spawn riker') || taskLower.includes('riker')) crewId = 'riker';
          else if (taskLower.includes('spawn data') || taskLower.includes('data')) crewId = 'data';
          else if (taskLower.includes('spawn geordi') || taskLower.includes('geordi')) crewId = 'geordi';
          else if (taskLower.includes('spawn spark') || taskLower.includes('spark')) crewId = 'spark';
          else if (taskLower.includes('spawn troi') || taskLower.includes('troi')) crewId = 'troi';
          else if (taskLower.includes('spawn barclay') || taskLower.includes('barclay')) crewId = 'barclay';
          else crewId = inferCrewFromTask(task) || 'unknown';
        }

        store.registerSubagent(sessionKey, crewId, task);
        
        // Add spawn entry to feed
        const spawnEntry = createSpawnEntry(crewId, task);
        store.addFeedEntry(spawnEntry);
        
        console.log(`[MC] Subagent spawned: ${crewId}`, sessionKey.substring(0, 40) + '...');
      }
      
      if (payload?.event === 'complete') {
        // Subagent completed
        const { sessionKey, status } = payload;
        const sessionId = sessionKey?.split(':')?.pop() || '';
        const mapping = store.subagentMappings.get(sessionId);
        const crewId = mapping?.crewId || 'unknown';
        
        store.updateSubagentStatus(sessionKey, 'completed');
        
        // Add completion entry to feed
        const completeEntry = createCompleteEntry(
          crewId,
          status === 'success' ? 'success' : 'error',
          mapping?.task
        );
        store.addFeedEntry(completeEntry);
        
        console.log(`[MC] Subagent completed: ${crewId} (${status})`);
      }
      break;
    }

    // Handle session lifecycle events
    case 'session': {
      const payload = event.payload;
      if (payload?.event === 'created' && payload?.sessionKey?.includes('subagent')) {
        console.log('[MC] Session created:', payload.sessionKey);
        // Could trigger a status refresh here
      }
      break;
    }

    default: {
      console.log('[MC] Unhandled event:', event.event, event.payload);
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
