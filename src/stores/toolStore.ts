import { create } from 'zustand';
import type { ChatToolRun, ChatToolRunStatus } from '../api/types';
import { createNativeGatewayClient, type GatewayEventFrame } from '../core/gatewayClient';

interface ToolRunEntity extends ChatToolRun {
  sessionKey: string;
  updatedAt: number;
}

interface ToolStore {
  initialized: boolean;
  initializing: boolean;
  byId: Record<string, ToolRunEntity>;
  idsBySession: Record<string, string[]>;

  initialize: () => Promise<void>;
  disconnect: () => void;
  clearSession: (sessionKey: string) => void;
  getRunsForSession: (sessionKey: string | null) => ChatToolRun[];
}

const gatewayClient = createNativeGatewayClient();
let wiringInitialized = false;
let unlistenAgent: (() => void) | null = null;
let unlistenChat: (() => void) | null = null;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getSessionKey(frame: GatewayEventFrame): string | null {
  return asString(frame.sessionKey) ?? asString(asRecord(frame.payload)?.sessionKey);
}

function getRunId(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const run = asRecord(payload.run);
  return asString(payload.runId) ?? asString(payload.id) ?? asString(run?.id);
}

function toStatus(phase: string): ChatToolRunStatus {
  if (phase === 'error') return 'error';
  if (phase === 'result' || phase === 'done' || phase === 'complete' || phase === 'completed' || phase === 'final') {
    return 'success';
  }
  return 'running';
}

function upsertRun(input: {
  sessionKey: string;
  runId: string | null;
  toolCallId: string;
  toolName?: string;
  phase?: string;
  args?: unknown;
  output?: unknown;
  error?: string;
  ts?: number;
}) {
  const now = Date.now();
  const updatedAt = input.ts ?? now;
  // Normalize phase for consistent storage and status calculation
  const phase = (input.phase ?? 'update').toLowerCase();
  const status = toStatus(phase);
  // Entity ID uses sessionKey:toolCallId only; runId is tracked as metadata
  // This prevents duplicate entities if runId arrives after initial tool event
  const entityId = `${input.sessionKey}:${input.toolCallId}`;

  useToolStore.setState((state) => {
    const existing = state.byId[entityId];
    const startedAt = existing?.startedAt ?? updatedAt;

    const next: ToolRunEntity = {
      id: entityId,
      sessionKey: input.sessionKey,
      runId: input.runId ?? existing?.runId ?? undefined,
      toolName: input.toolName ?? existing?.toolName,
      status,
      input: input.args !== undefined ? input.args : existing?.input,
      output: input.output !== undefined ? input.output : existing?.output,
      // Clear any previous error when tool succeeds; preserve on error for context
      error: status === 'success' ? undefined : (input.error ?? existing?.error),
      startedAt,
      finishedAt: status === 'running' ? undefined : (existing?.finishedAt ?? updatedAt),
      updatedAt,
    };

    const byId = { ...state.byId, [entityId]: next };
    const sessionIds = state.idsBySession[input.sessionKey] ?? [];
    const idsBySession = {
      ...state.idsBySession,
      [input.sessionKey]: sessionIds.includes(entityId) ? sessionIds : [...sessionIds, entityId],
    };

    return { byId, idsBySession };
  });
}

function consumeToolStreamEvent(frame: GatewayEventFrame): void {
  const sessionKey = getSessionKey(frame);
  if (!sessionKey) return;

  const payload = asRecord(frame.payload);
  if (!payload) return;

  const stream = asString(payload.stream)?.toLowerCase();
  const data = asRecord(payload.data);

  if (stream !== 'tool' && !(data && asString(data.toolCallId))) {
    return;
  }

  const toolCallId = asString(data?.toolCallId) ?? asString(data?.tool_call_id);
  if (!toolCallId) return;

  const rawPhase = asString(data?.phase) ?? 'update';
  // Normalize phase for consistent storage and status calculation
  const phase = rawPhase.toLowerCase();
  const toolName = asString(data?.name) ?? asString(data?.toolName) ?? asString(data?.tool_name) ?? 'tool';
  const runId = asString(payload.runId) ?? asString(data?.runId) ?? getRunId(payload);

  const output = (() => {
    if (phase === 'result' || phase === 'done' || phase === 'complete' || phase === 'completed' || phase === 'final') {
      return data?.result;
    }
    if (phase === 'error') {
      return data?.partialResult;
    }
    return data?.partialResult;
  })();

  upsertRun({
    sessionKey,
    runId,
    toolCallId,
    toolName,
    phase,
    args: data?.args,
    output,
    error: asString(data?.error) ?? undefined,
    ts: asNumber(payload.ts) ?? asNumber(data?.ts) ?? Date.now(),
  });
}

function settleRunningToolsForSession(sessionKey: string, status: ChatToolRunStatus): void {
  useToolStore.setState((state) => {
    const ids = state.idsBySession[sessionKey] ?? [];
    if (ids.length === 0) return state;

    const byId = { ...state.byId };
    let changed = false;
    const now = Date.now();

    for (const id of ids) {
      const entity = byId[id];
      if (!entity || entity.status !== 'running') continue;
      byId[id] = {
        ...entity,
        status,
        finishedAt: entity.finishedAt ?? now,
        updatedAt: now,
        ...(status === 'error' && !entity.error ? { error: 'Run terminated before tool completion' } : {}),
      };
      changed = true;
    }

    if (!changed) return state;
    return { ...state, byId };
  });
}

function handleChatLifecycle(frame: GatewayEventFrame): void {
  const sessionKey = getSessionKey(frame);
  if (!sessionKey) return;

  const payload = asRecord(frame.payload);
  const state = asString(payload?.state)?.toLowerCase();
  if (state === 'final') {
    settleRunningToolsForSession(sessionKey, 'success');
  } else if (state === 'aborted' || state === 'error') {
    settleRunningToolsForSession(sessionKey, 'error');
  }
}

export const useToolStore = create<ToolStore>((set, get) => ({
  initialized: false,
  initializing: false,
  byId: {},
  idsBySession: {},

  initialize: async () => {
    if (get().initialized || get().initializing) return;
    set({ initializing: true });

    if (!wiringInitialized) {
      unlistenAgent = gatewayClient.onEvent('agent', consumeToolStreamEvent);
      unlistenChat = gatewayClient.onEvent('chat', handleChatLifecycle);
      wiringInitialized = true;
    }

    set({ initialized: true, initializing: false });
  },

  disconnect: () => {
    if (unlistenAgent) {
      unlistenAgent();
      unlistenAgent = null;
    }
    if (unlistenChat) {
      unlistenChat();
      unlistenChat = null;
    }
    wiringInitialized = false;

    set({ initialized: false, initializing: false, byId: {}, idsBySession: {} });
  },

  clearSession: (sessionKey) => {
    set((state) => {
      const ids = state.idsBySession[sessionKey] ?? [];
      if (ids.length === 0) return state;

      const byId = { ...state.byId };
      for (const id of ids) delete byId[id];

      const idsBySession = { ...state.idsBySession };
      delete idsBySession[sessionKey];
      return { ...state, byId, idsBySession };
    });
  },

  getRunsForSession: (sessionKey) => {
    if (!sessionKey) return [];
    const state = get();
    const ids = state.idsBySession[sessionKey] ?? [];
    return ids
      .map((id) => state.byId[id])
      .filter((run): run is ToolRunEntity => !!run)
      .map((run) => ({
        id: run.id,
        runId: run.runId,
        toolName: run.toolName,
        status: run.status,
        input: run.input,
        output: run.output,
        error: run.error,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      }));
  },
}));
