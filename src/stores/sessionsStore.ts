import { create } from 'zustand';
import type { CrewMember, Session } from '../api/types';
import { getCrewConfig, getCrewMembersBase, onCrewConfigChanged } from '../config/crewConfig';
import { useCrewRegistryStore } from './crewRegistryStore';
import { createNativeGatewayClient, type GatewayConnectionState } from '../core/gatewayClient';
import { useGatewayStore } from './gateway';
import { flushPendingAuthoritativeSessionsRefresh } from './authoritativeRefresh';
import type { GatewayEventFrame } from '../core/gatewayClient/types';

type SessionMap = Record<string, Session>;
type SessionActivityMap = Record<string, number>;

const IDLE_THRESHOLD_MS = 120000;

interface SessionsStore {
  initialized: boolean;
  connecting: boolean;
  connected: boolean;
  error: string | null;
  sessionsByKey: SessionMap;
  sessionActivityByKey: SessionActivityMap;
  sessionKeys: string[];
  selectedSessionKey: string | null;
  mainSessionKey: string | null;
  lastSyncedAt: number | null;

  initialize: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  selectSession: (sessionKey: string | null) => void;

  getSessions: () => Session[];
  getSessionsForCrew: (crewId: string) => Session[];
  getCrewDisplayState: () => CrewMember[];
}

const gatewayClient = createNativeGatewayClient();
let wiringInitialized = false;
let reconnectResyncInFlight: Promise<void> | null = null;
let configReloadSubscriptionWired = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeSession(raw: unknown): Session | null {
  if (!isRecord(raw)) return null;

  // Some gateways wrap each session payload under a `session` object.
  const candidate = isRecord(raw.session) ? raw.session : raw;

  const numberValue = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  const stringValue = (value: unknown): string => (typeof value === 'string' ? value : '');

  const key = stringValue(candidate.key) || stringValue(candidate.sessionKey);
  if (!key.trim()) return null;

  const sessionId =
    stringValue(candidate.sessionId)
    || stringValue(candidate.id)
    || stringValue(candidate.session_id)
    || key;

  return {
    agentId: stringValue(candidate.agentId) || stringValue(candidate.agent) || 'unknown',
    key,
    kind: stringValue(candidate.kind),
    sessionId,
    label: stringValue(candidate.label),
    displayName: stringValue(candidate.displayName) || stringValue(candidate.display_name),
    parentSessionKey: stringValue(candidate.parentSessionKey) || stringValue(candidate.parent_session_key),
    spawnedBy: stringValue(candidate.spawnedBy) || stringValue(candidate.spawned_by),
    subagentRole: stringValue(candidate.subagentRole) || stringValue(candidate.subagent_role),
    status: stringValue(candidate.status),
    startedAt: numberValue(candidate.startedAt) || numberValue(candidate.started_at),
    endedAt: numberValue(candidate.endedAt) || numberValue(candidate.ended_at),
    runtimeMs: numberValue(candidate.runtimeMs) || numberValue(candidate.runtime_ms),
    updatedAt: numberValue(candidate.updatedAt) || numberValue(candidate.updated_at),
    age: numberValue(candidate.age),
    inputTokens: numberValue(candidate.inputTokens) || numberValue(candidate.input_tokens),
    outputTokens: numberValue(candidate.outputTokens) || numberValue(candidate.output_tokens),
    cacheRead: numberValue(candidate.cacheRead) || numberValue(candidate.cache_read),
    cacheWrite: numberValue(candidate.cacheWrite) || numberValue(candidate.cache_write),
    totalTokens: numberValue(candidate.totalTokens) || numberValue(candidate.total_tokens),
    remainingTokens: numberValue(candidate.remainingTokens) || numberValue(candidate.remaining_tokens),
    percentUsed: (() => {
      // Use provided percentUsed if available
      const provided = numberValue(candidate.percentUsed) || numberValue(candidate.percent_used);
      if (provided > 0) return provided;
      
      // Calculate from totalTokens and contextTokens
      const total = numberValue(candidate.totalTokens) || numberValue(candidate.total_tokens);
      const context = numberValue(candidate.contextTokens) || numberValue(candidate.context_tokens);
      if (context > 0) {
        return Math.min(100, Math.round((total / context) * 100));
      }
      return 0;
    })(),
    model: stringValue(candidate.model),
    contextTokens: numberValue(candidate.contextTokens) || numberValue(candidate.context_tokens),
    flags: Array.isArray(candidate.flags) ? candidate.flags.filter((v): v is string => typeof v === 'string') : [],
  };
}

function getSessionTimestamp(session: Session): number {
  return session.endedAt || session.updatedAt || session.startedAt || Date.now();
}

function hasMeaningfulSessionChange(previous: Session | undefined, next: Session): boolean {
  if (!previous) return true;
  return (
    previous.updatedAt !== next.updatedAt
    || previous.status !== next.status
    || previous.runtimeMs !== next.runtimeMs
    || previous.totalTokens !== next.totalTokens
    || previous.inputTokens !== next.inputTokens
    || previous.outputTokens !== next.outputTokens
  );
}

function reconcileAuthoritativeCrewRegistrations(sessions: Session[]): void {
  const registry = useCrewRegistryStore.getState();
  for (const session of sessions) {
    registry.autoRegisterFromSession(session);
  }
}

function extractSessionFromChangedEvent(frame: GatewayEventFrame): Session | null {
  const payload = frame.payload;
  if (!isRecord(payload)) return null;
  return normalizeSession(payload);
}

function extractSessionsPayload(payload: unknown): Session[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeSession).filter((s): s is Session => !!s);
  }

  if (!isRecord(payload)) return [];

  const direct = payload.sessions;
  if (Array.isArray(direct)) {
    return direct.map(normalizeSession).filter((s): s is Session => !!s);
  }

  const recent = isRecord(payload.recent) ? payload.recent.sessions : undefined;
  if (Array.isArray(recent)) {
    return recent.map(normalizeSession).filter((s): s is Session => !!s);
  }

  return [];
}

function mapSessionToCrewId(session: Session): string | null {
  const registry = useCrewRegistryStore.getState();
  const reg = registry.getRegistrationBySession(session.sessionId, session.key);
  if (reg) return reg.crewId;

  // Q is explicitly represented as main session from config.
  const mainCrew = getCrewConfig().crew.find((c) => c.isMainSession);
  if (mainCrew && session.key.includes(':main') && !session.key.includes('subagent')) {
    return mainCrew.id;
  }

  // Never auto-attribute unregistered subagents.
  return null;
}

function inferStatus(session: Session, lastActiveAt?: number): CrewMember['status'] {
  const normalized = (session.status || '').toLowerCase();
  if (normalized === 'failed') return 'error';
  if (normalized === 'killed') return 'stopped';
  if (normalized === 'done') return 'completed';
  if (normalized === 'timeout' || normalized.includes('timeout') || normalized.includes('timed')) return 'timed-out';
  if (normalized === 'running') return 'active';

  const baseline = lastActiveAt || session.updatedAt || session.startedAt || 0;
  return (Date.now() - baseline) < IDLE_THRESHOLD_MS ? 'active' : 'idle';
}

function pickMainSessionKey(sessions: Session[]): string | null {
  const mainCrew = getCrewConfig().crew.find((c) => c.isMainSession);
  if (!mainCrew) return null;

  const main = sessions.filter((session) => mapSessionToCrewId(session) === mainCrew.id);
  if (main.length === 0) return null;

  const sorted = [...main].sort((a, b) => {
    const tokenDelta = (b.totalTokens || 0) - (a.totalTokens || 0);
    if (tokenDelta !== 0) return tokenDelta;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  return sorted[0]?.key ?? null;
}

function buildCrewDisplayState(sessions: Session[], sessionActivityByKey: SessionActivityMap): CrewMember[] {
  const crewMembers = getCrewMembersBase();
  const perCrew = new Map<string, Session>();
  for (const session of sessions) {
    const crewId = mapSessionToCrewId(session);
    if (!crewId) continue;
    const existing = perCrew.get(crewId);
    if (!existing || (session.updatedAt || 0) > (existing.updatedAt || 0)) perCrew.set(crewId, session);
  }

  const registry = useCrewRegistryStore.getState();

  return crewMembers.map((member) => {
    const session = perCrew.get(member.id);
    const primaryRegistration = registry.getPrimarySessionByCrewId(member.id);

    if (!session) {
      const fallbackStatus: CrewMember['status'] = (() => {
        switch (primaryRegistration?.status) {
          case 'error':
            return 'error';
          case 'completed':
            return primaryRegistration.openclawStatus === 'timeout' ? 'timed-out' : 'completed';
          case 'idle':
            return 'idle';
          case 'active':
            return 'active';
          case 'offline':
          case 'spawning':
          default:
            return 'offline';
        }
      })();

      return {
        ...member,
        status: fallbackStatus,
        model: primaryRegistration?.modelActive || primaryRegistration?.modelRequested,
        currentTask: primaryRegistration?.task,
      };
    }

    const requestedModel = primaryRegistration?.modelRequested;
    const activeModel = session.model || primaryRegistration?.modelActive;
    const fallbackAllowed = Boolean(
      requestedModel
      && activeModel
      && requestedModel !== activeModel
      && getCrewConfig().crew.find((c) => c.id === member.id)?.fallbackModels?.includes(activeModel)
    );

    return {
      ...member,
      status: inferStatus(session, sessionActivityByKey[session.key]),
      model: activeModel,
      contextPercent: session.percentUsed,
      currentTask: primaryRegistration?.task,
      requestedModel,
      fallbackActive: primaryRegistration?.fallbackActive || fallbackAllowed,
      fallbackCount: primaryRegistration?.fallbackCount ?? (fallbackAllowed ? 1 : 0),
    };
  });
}

function syncGatewayFacade(sessions: Session[], crew: CrewMember[], mainSessionKey: string | null): void {
  const mainSession = mainSessionKey ? sessions.find((session) => session.key === mainSessionKey) : undefined;

  useGatewayStore.setState({
    sessions,
    activeCrew: crew,
    qContextData: mainSession
      ? {
          contextPercent: mainSession.percentUsed ?? 0,
          tokensUsed: mainSession.totalTokens ?? 0,
          tokensTotal: (mainSession.totalTokens ?? 0) + (mainSession.remainingTokens ?? 0),
          tokensRemaining: mainSession.remainingTokens ?? 0,
        }
      : null,
  });
}

function reconcileRegistryLifecycle(sessions: Session[], activity: SessionActivityMap): void {
  const registry = useCrewRegistryStore.getState();
  const crewConfig = getCrewConfig();

  for (const session of sessions) {
    const registration = registry.getRegistrationBySession(session.sessionId, session.key);
    if (!registration) continue;

    const sessionStatus = inferStatus(session, activity[session.key]);
    const mappedStatus = sessionStatus === 'completed' || sessionStatus === 'timed-out'
      ? 'completed'
      : sessionStatus === 'stopped'
        ? 'error'
        : sessionStatus;
    registry.updateRegistration(session.sessionId, {
      status: mappedStatus,
      openclawStatus: ['running', 'done', 'failed', 'killed', 'timeout'].includes((session.status || '').toLowerCase())
        ? (session.status || '').toLowerCase() as 'running' | 'done' | 'failed' | 'killed' | 'timeout'
        : registration.openclawStatus,
      modelActive: session.model || registration.modelActive,
    });

    const requestedModel = registration.modelRequested;
    const activeModel = session.model || registration.modelActive;
    const allowedFallbacks = crewConfig.crew.find((c) => c.id === registration.crewId)?.fallbackModels ?? [];

    if (requestedModel && activeModel && activeModel !== requestedModel && allowedFallbacks.includes(activeModel)) {
      registry.markFallback(session.sessionId, activeModel);
      continue;
    }

    if (registration.fallbackActive && requestedModel && activeModel === requestedModel) {
      registry.updateRegistration(session.sessionId, { fallbackActive: false });
    }
  }
}

export const useSessionsStore = create<SessionsStore>((set, get) => ({
  initialized: false,
  connecting: false,
  connected: false,
  error: null,
  sessionsByKey: {},
  sessionActivityByKey: {},
  sessionKeys: [],
  selectedSessionKey: null,
  mainSessionKey: null,
  lastSyncedAt: null,

  initialize: async () => {
    if (get().initialized || get().connecting) return;

    set({ connecting: true, error: null });

    if (!wiringInitialized) {
      let wasConnected = false;

      gatewayClient.onState((state: GatewayConnectionState) => {
        const connected = state === 'connected';
        set({ connected });
        useGatewayStore.getState().setConnected(connected);

        // On reconnect, re-establish subscription and rehydrate sessions authority.
        if (connected && wasConnected === false && get().initialized) {
          if (!reconnectResyncInFlight) {
            reconnectResyncInFlight = (async () => {
              try {
                await gatewayClient.sessionsSubscribe();
                await get().refreshSessions();
              } finally {
                reconnectResyncInFlight = null;
              }
            })().catch((error) => {
              set({ error: error instanceof Error ? error.message : 'Failed to resync sessions after reconnect' });
            });
          }
        }

        wasConnected = connected;
      });

      gatewayClient.onEvent('sessions.changed', (frame) => {
        const changedSession = extractSessionFromChangedEvent(frame);
        if (changedSession) {
          useCrewRegistryStore.getState().autoRegisterFromSession(changedSession);

          const payload = isRecord(frame.payload) ? frame.payload : undefined;
          const eventSessionKey = typeof payload?.sessionKey === 'string' ? payload.sessionKey : changedSession.key;
          const eventTs = typeof payload?.ts === 'number' && Number.isFinite(payload.ts)
            ? payload.ts
            : Date.now();

          set((state) => ({
            sessionActivityByKey: {
              ...state.sessionActivityByKey,
              [eventSessionKey]: eventTs,
            },
          }));
        }

        get().refreshSessions().catch((error) => {
          set({ error: error instanceof Error ? error.message : 'Failed to refresh sessions' });
        });
      });

      wiringInitialized = true;
    }

    if (!configReloadSubscriptionWired) {
      onCrewConfigChanged(() => {
        if (!get().initialized) return;
        get().refreshSessions().catch((error) => {
          set({ error: error instanceof Error ? error.message : 'Failed to refresh sessions after crew config reload' });
        });
      });
      configReloadSubscriptionWired = true;
    }

    try {
      await gatewayClient.connect();
      await gatewayClient.sessionsSubscribe();
      await get().refreshSessions();
      set({ initialized: true, connecting: false, error: null });
      await flushPendingAuthoritativeSessionsRefresh();
    } catch (error) {
      set({
        connecting: false,
        error: error instanceof Error ? error.message : 'Failed to initialize sessions store',
      });
      throw error;
    }
  },

  refreshSessions: async () => {
    const previousSessionsByKey = get().sessionsByKey;
    const previousActivity = get().sessionActivityByKey;
    const payload = await gatewayClient.sessionsList({ includeGlobal: true, includeUnknown: true, limit: 500 });
    const sessions = extractSessionsPayload(payload);
    reconcileAuthoritativeCrewRegistrations(sessions);

    const sessionsByKey = sessions.reduce<SessionMap>((acc, session) => {
      acc[session.key] = session;
      return acc;
    }, {});

    const sessionKeys = Object.keys(sessionsByKey);

    const sessionActivityByKey = sessions.reduce<SessionActivityMap>((acc, session) => {
      const previous = previousSessionsByKey[session.key];
      const existingActivity = previousActivity[session.key];

      if (hasMeaningfulSessionChange(previous, session)) {
        acc[session.key] = session.updatedAt || Date.now();
      } else if (typeof existingActivity === 'number' && Number.isFinite(existingActivity)) {
        acc[session.key] = existingActivity;
      } else {
        acc[session.key] = getSessionTimestamp(session);
      }

      return acc;
    }, {});

    const mainSessionKey = pickMainSessionKey(sessions);
    const selectedSessionKey = (() => {
      const current = get().selectedSessionKey;
      if (current && sessionsByKey[current]) return current;
      return mainSessionKey;
    })();

    reconcileRegistryLifecycle(sessions, sessionActivityByKey);
    const crewDisplay = buildCrewDisplayState(sessions, sessionActivityByKey);

    set({
      sessionsByKey,
      sessionActivityByKey,
      sessionKeys,
      mainSessionKey,
      selectedSessionKey,
      lastSyncedAt: Date.now(),
      error: null,
    });

    syncGatewayFacade(sessions, crewDisplay, mainSessionKey);
  },

  selectSession: (sessionKey) => {
    if (!sessionKey) {
      set({ selectedSessionKey: null });
      return;
    }

    if (!get().sessionsByKey[sessionKey]) return;
    set({ selectedSessionKey: sessionKey });
  },

  getSessions: () => {
    const state = get();
    return state.sessionKeys.map((key) => state.sessionsByKey[key]).filter((s): s is Session => !!s);
  },

  getSessionsForCrew: (crewId) => {
    const sessions = get().getSessions();
    return sessions.filter((session) => mapSessionToCrewId(session) === crewId);
  },

  getCrewDisplayState: () => buildCrewDisplayState(get().getSessions(), get().sessionActivityByKey),
}));
