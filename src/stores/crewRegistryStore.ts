import { create } from 'zustand';
import { getCrewConfig } from '../config/crewConfig';
import { getSettings } from '../config';
import type { Session } from '../api/types';

export type CrewRegistrationStatus = 'spawning' | 'active' | 'idle' | 'completed' | 'error' | 'offline';

export interface CrewSessionRegistration {
  sessionId: string;
  sessionKey?: string;
  requestId?: string;
  ownerId?: string;
  crewId: string;
  task?: string;
  spawnedAt: number;
  completedAt?: number;
  modelRequested?: string;
  modelActive?: string;
  fallbackModelsTried?: string[];
  fallbackCount: number;
  fallbackActive: boolean;
  status: CrewRegistrationStatus;
  openclawStatus?: 'running' | 'done' | 'failed' | 'killed' | 'timeout';
  errorReason?: string;
  lastSeenAt: number;
  source: 'spawn' | 'reconciled';
}

interface RegisterPendingInput {
  crewId: string;
  requestId?: string;
  sessionKey?: string;
  ownerId?: string;
  task?: string;
  modelRequested?: string;
  spawnedAt?: number;
}

interface ConfirmInput {
  sessionId: string;
  requestId?: string;
  sessionKey?: string;
  ownerId?: string;
  modelActive?: string;
}

interface CrewRegistryState {
  bySessionId: Record<string, CrewSessionRegistration>;
  pendingByRequestId: Record<string, Array<Omit<CrewSessionRegistration, 'sessionId'>>>;
  pendingBySessionKey: Record<string, Array<Omit<CrewSessionRegistration, 'sessionId'>>>;

  registerPendingSpawn: (input: RegisterPendingInput) => void;
  confirmRegistration: (input: ConfirmInput) => void;
  updateRegistration: (sessionId: string, updates: Partial<CrewSessionRegistration>) => void;
  markFallback: (sessionId: string, modelActive: string) => void;
  autoRegisterFromSession: (session: Session) => void;
  getRegistrationBySession: (sessionId?: string, sessionKey?: string) => CrewSessionRegistration | undefined;
  getPrimarySessionByCrewId: (crewId: string) => CrewSessionRegistration | undefined;
}

function normalizeCrewIdentity(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

function resolveCrewIdFromSessionLabel(session: Session): string | null {
  const sessionLabel = normalizeCrewIdentity(session.label);
  if (!sessionLabel) return null;

  const crewMatch = getCrewConfig().crew.find((member) => (
    normalizeCrewIdentity(member.id) === sessionLabel
    || normalizeCrewIdentity(member.name) === sessionLabel
  ));

  return crewMatch?.id ?? null;
}

function createPending(input: RegisterPendingInput): Omit<CrewSessionRegistration, 'sessionId'> {
  return {
    crewId: input.crewId,
    requestId: input.requestId,
    sessionKey: input.sessionKey,
    ownerId: input.ownerId,
    task: input.task,
    spawnedAt: input.spawnedAt ?? Date.now(),
    modelRequested: input.modelRequested,
    fallbackModelsTried: [],
    fallbackCount: 0,
    fallbackActive: false,
    status: 'spawning',
    lastSeenAt: Date.now(),
    source: 'spawn',
  };
}

function assertCrewId(crewId: string): void {
  const valid = getCrewConfig().crew.some((c) => c.id === crewId);
  if (!valid) {
    throw new Error(`Invalid crewId for registration: ${crewId}`);
  }
}

export const useCrewRegistryStore = create<CrewRegistryState>((set, get) => ({
  bySessionId: {},
  pendingByRequestId: {},
  pendingBySessionKey: {},

  registerPendingSpawn: (input) => {
    assertCrewId(input.crewId);
    const pending = createPending(input);

    set((state) => ({
      pendingByRequestId: input.requestId
        ? {
            ...state.pendingByRequestId,
            [input.requestId]: [...(state.pendingByRequestId[input.requestId] ?? []), pending],
          }
        : state.pendingByRequestId,
      pendingBySessionKey: input.sessionKey
        ? {
            ...state.pendingBySessionKey,
            [input.sessionKey]: [...(state.pendingBySessionKey[input.sessionKey] ?? []), pending],
          }
        : state.pendingBySessionKey,
    }));
  },

  confirmRegistration: (input) => {
    const state = get();
    const fromRequest = input.requestId ? state.pendingByRequestId[input.requestId] ?? [] : [];
    const fromKey = input.sessionKey ? state.pendingBySessionKey[input.sessionKey] ?? [] : [];
    const existing = state.bySessionId[input.sessionId];

    const allCandidates = [...fromRequest, ...fromKey];
    const preferred = allCandidates
      .filter((candidate) => {
        if (input.ownerId && candidate.ownerId && input.ownerId !== candidate.ownerId) return false;
        if (input.requestId && candidate.requestId && input.requestId !== candidate.requestId) return false;
        if (input.sessionKey && candidate.sessionKey && input.sessionKey !== candidate.sessionKey) return false;
        return true;
      })
      .sort((a, b) => (b.spawnedAt || 0) - (a.spawnedAt || 0));

    const base = existing ?? preferred[0] ?? allCandidates.sort((a, b) => (b.spawnedAt || 0) - (a.spawnedAt || 0))[0];
    if (!base) return;

    assertCrewId(base.crewId);

    const merged: CrewSessionRegistration = {
      ...base,
      sessionId: input.sessionId,
      sessionKey: input.sessionKey ?? base.sessionKey,
      requestId: input.requestId ?? base.requestId,
      ownerId: input.ownerId ?? base.ownerId,
      modelActive: input.modelActive ?? base.modelActive,
      status: existing?.status ?? 'active',
      lastSeenAt: Date.now(),
    };

    const pendingByRequestId = { ...state.pendingByRequestId };
    const pendingBySessionKey = { ...state.pendingBySessionKey };

    const matchesMerged = (candidate: Omit<CrewSessionRegistration, 'sessionId'>): boolean => (
      candidate.crewId === merged.crewId
      && candidate.spawnedAt === merged.spawnedAt
      && candidate.requestId === merged.requestId
      && candidate.sessionKey === merged.sessionKey
    );

    if (merged.requestId) {
      const queue = (pendingByRequestId[merged.requestId] ?? []).filter((candidate) => !matchesMerged(candidate));
      if (queue.length === 0) delete pendingByRequestId[merged.requestId];
      else pendingByRequestId[merged.requestId] = queue;
    }

    if (merged.sessionKey) {
      const queue = (pendingBySessionKey[merged.sessionKey] ?? []).filter((candidate) => !matchesMerged(candidate));
      if (queue.length === 0) delete pendingBySessionKey[merged.sessionKey];
      else pendingBySessionKey[merged.sessionKey] = queue;
    }

    set({
      bySessionId: { ...state.bySessionId, [input.sessionId]: merged },
      pendingByRequestId,
      pendingBySessionKey,
    });
  },

  updateRegistration: (sessionId, updates) => {
    set((state) => {
      const current = state.bySessionId[sessionId];
      if (!current) return state;
      const next = {
        ...current,
        ...updates,
        sessionId,
        crewId: current.crewId,
        lastSeenAt: Date.now(),
      };
      return { bySessionId: { ...state.bySessionId, [sessionId]: next } };
    });
  },

  markFallback: (sessionId, modelActive) => {
    set((state) => {
      const current = state.bySessionId[sessionId];
      if (!current) return state;
      const tried = new Set(current.fallbackModelsTried ?? []);
      const isNewFallbackModel = !tried.has(modelActive);
      tried.add(modelActive);
      return {
        bySessionId: {
          ...state.bySessionId,
          [sessionId]: {
            ...current,
            modelActive,
            fallbackActive: true,
            fallbackCount: (current.fallbackCount ?? 0) + (isNewFallbackModel ? 1 : 0),
            fallbackModelsTried: [...tried],
            lastSeenAt: Date.now(),
          },
        },
      };
    });
  },

  autoRegisterFromSession: (session) => {
    if (!session.parentSessionKey) return;

    const crewId = resolveCrewIdFromSessionLabel(session);
    if (!crewId) return;

    assertCrewId(crewId);

    const state = get();
    const existing = state.bySessionId[session.sessionId]
      ?? Object.values(state.bySessionId).find((item) => item.sessionKey === session.key);

    const normalizedStatus: CrewRegistrationStatus = (() => {
      const statusText = (session.status ?? '').toLowerCase();
      if (statusText === 'failed') return 'error';
      if (statusText === 'killed') return 'error';
      if (statusText === 'running') return 'active';
      if (statusText === 'done') return 'completed';
      if (statusText.includes('timeout') || statusText.includes('timed')) return 'completed';
      return existing?.status ?? 'active';
    })();

    const next: CrewSessionRegistration = {
      crewId,
      sessionId: session.sessionId,
      sessionKey: session.key,
      requestId: existing?.requestId,
      ownerId: existing?.ownerId,
      task: existing?.task,
      spawnedAt: existing?.spawnedAt ?? session.startedAt ?? session.updatedAt ?? Date.now(),
      completedAt: normalizedStatus === 'completed' ? (session.endedAt ?? Date.now()) : existing?.completedAt,
      modelRequested: existing?.modelRequested,
      modelActive: session.model || existing?.modelActive,
      fallbackModelsTried: existing?.fallbackModelsTried ?? [],
      fallbackCount: existing?.fallbackCount ?? 0,
      fallbackActive: existing?.fallbackActive ?? false,
      status: normalizedStatus,
      openclawStatus: (session.status?.toLowerCase() as CrewSessionRegistration['openclawStatus']) || existing?.openclawStatus,
      errorReason: existing?.errorReason,
      lastSeenAt: Date.now(),
      source: existing?.source ?? 'reconciled',
    };

    set({ bySessionId: { ...state.bySessionId, [session.sessionId]: next } });
  },

  getRegistrationBySession: (sessionId, sessionKey) => {
    const state = get();
    if (sessionId && state.bySessionId[sessionId]) return state.bySessionId[sessionId];
    if (!sessionKey) return undefined;
    return Object.values(state.bySessionId).find((item) => item.sessionKey === sessionKey);
  },

  getPrimarySessionByCrewId: (crewId) => {
    return Object.values(get().bySessionId)
      .filter((entry) => entry.crewId === crewId)
      .sort((a, b) => (b.lastSeenAt || b.spawnedAt) - (a.lastSeenAt || a.spawnedAt))[0];
  },
}));

interface SpawnBridgeEvent {
  cursor?: number;
  type?: string;
  requestId?: string;
  crewId?: string;
  task?: string;
  modelRequested?: string;
  modelActive?: string;
  ownerId?: string;
  sessionId?: string;
  sessionKey?: string;
  fallbackActive?: boolean;
  fallbackCount?: number;
  createdAt?: number;
  at?: number;
}

let spawnBridgeStarted = false;
let spawnBridgeTimer: ReturnType<typeof setTimeout> | null = null;
let spawnBridgeCursor = 0;

async function pollSpawnBridgeOnce(): Promise<void> {
  const settings = await getSettings();
  const base = (settings.metricsBaseUrl || 'http://127.0.0.1:18790').replace(/\/+$/, '');
  const response = await fetch(`${base}/spawn-status?sinceCursor=${spawnBridgeCursor}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`spawn-status returned HTTP ${response.status}`);
  }

  const payload = await response.json() as { events?: SpawnBridgeEvent[]; latestCursor?: number };
  const events = Array.isArray(payload.events) ? payload.events : [];
  const registry = useCrewRegistryStore.getState();

  for (const event of events) {
    if (event.type === 'intent' && event.crewId) {
      registry.registerPendingSpawn({
        crewId: event.crewId,
        requestId: event.requestId,
        sessionKey: event.sessionKey,
        ownerId: event.ownerId,
        task: event.task,
        modelRequested: event.modelRequested,
        spawnedAt: event.createdAt ?? event.at ?? Date.now(),
      });
      continue;
    }

    if (event.type === 'confirm' && event.sessionId) {
      registry.confirmRegistration({
        sessionId: event.sessionId,
        requestId: event.requestId,
        sessionKey: event.sessionKey,
        ownerId: event.ownerId,
        modelActive: event.modelActive,
      });

      if (event.fallbackActive || (event.fallbackCount ?? 0) > 0) {
        const existing = registry.getRegistrationBySession(event.sessionId, event.sessionKey);
        if (existing) {
          registry.updateRegistration(event.sessionId, {
            fallbackActive: true,
            fallbackCount: Math.max(existing.fallbackCount ?? 0, event.fallbackCount ?? 0),
          });
        }
      }
    }
  }

  spawnBridgeCursor = typeof payload.latestCursor === 'number'
    ? Math.max(spawnBridgeCursor, payload.latestCursor)
    : spawnBridgeCursor;
}

export function startSpawnRegistryBridgePolling(intervalMs = 1500): void {
  if (spawnBridgeStarted) return;
  spawnBridgeStarted = true;

  const tick = async () => {
    if (!spawnBridgeStarted) return;
    try {
      await pollSpawnBridgeOnce();
    } catch (error) {
      console.warn('[CrewRegistry] Spawn bridge poll failed:', error);
    } finally {
      if (spawnBridgeStarted) {
        spawnBridgeTimer = setTimeout(tick, intervalMs);
      }
    }
  };

  void tick();
}

export function stopSpawnRegistryBridgePolling(): void {
  spawnBridgeStarted = false;
  if (spawnBridgeTimer) {
    clearTimeout(spawnBridgeTimer);
    spawnBridgeTimer = null;
  }
}
