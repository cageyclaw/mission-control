import { create } from 'zustand';
import type {
  GatewayHealth,
  GatewayReady,
  Session,
  MemoryStatus,
  SecurityAudit,
  ModelInfo,
  CrewMember,
  FeedEntry,
  View,
  CostSnapshot,
  StatusData,
} from '../api/types';
import { getConfiguredCrewMembers, type SubagentMapping } from '../utils/crew';
import { startSpawnRegistryBridgePolling, useCrewRegistryStore } from './crewRegistryStore';
import { requestAuthoritativeSessionsRefresh } from './authoritativeRefresh';

interface GatewayStore {
  // Connection
  connected: boolean;
  gatewayHealth: GatewayHealth | null;
  gatewayReady: GatewayReady | null;

  // Sessions
  sessions: Session[];
  activeCrew: CrewMember[];

  // Subagent tracking
  subagentMappings: Map<string, SubagentMapping>;

  // Active tasks
  activeTasks: Map<string, FeedEntry>; // crewId -> current task entry

  // Memory
  memory: MemoryStatus | null;

  // Security
  security: SecurityAudit | null;

  // Models
  models: ModelInfo[];

  // Channels
  channels: string[];

  // Activity feed
  feed: FeedEntry[];
  maxFeedEntries: number;
  feedFilter: {
    types?: string[];
    crewIds?: string[];
    searchQuery?: string;
  };

  // UI state
  activeView: View;
  selectedCrewId: string | null;

  // Cost
  dailyCost: number;
  costHistory: CostSnapshot[];

  // Q Context Data
  qContextData: {
    contextPercent: number;
    tokensUsed: number;
    tokensTotal: number;
    tokensRemaining: number;
  } | null;

  // Actions
  setConnected: (connected: boolean) => void;
  updateHealth: (health: GatewayHealth) => void;
  updateReady: (ready: GatewayReady) => void;
  updateStatus: (status: StatusData) => void;
  addFeedEntry: (entry: FeedEntry) => void;
  updateFeedEntry: (id: string, updates: Partial<FeedEntry>) => void;
  registerSubagent: (sessionKey: string, crewId: string, task?: string, sessionAge?: number, spawnTimestamp?: number) => void;
  updateSubagentStatus: (sessionKey: string, status: SubagentMapping['status']) => void;
  updateActiveTask: (crewId: string, entry: FeedEntry) => void;
  clearFeed: () => void;
  setFeedFilter: (filter: { types?: string[]; crewIds?: string[]; searchQuery?: string }) => void;
  setActiveView: (view: View) => void;
  selectCrew: (id: string | null) => void;
}

interface CrewRuntimeStatus {
  status: CrewMember['status'];
  model?: string;
  contextPercent?: number;
  currentTask?: string;
  updatedAt: number;
}

const ACTIVE_WINDOW_MS = 120000;
const IDLE_WINDOW_MS = 600000;
const ACTIVE_VIEW_STORAGE_KEY = 'occ.activeView';

function getInitialView(): View {
  if (typeof window === 'undefined') return 'home';

  try {
    const stored = window.localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
    return stored === 'home' || stored === 'crew' || stored === 'system' || stored === 'chat' ? stored : 'home';
  } catch {
    return 'home';
  }
}

function getSessionUpdatedAt(session: Session): number {
  if (typeof session.updatedAt === 'number' && Number.isFinite(session.updatedAt) && session.updatedAt > 0) {
    return session.updatedAt;
  }

  const age = typeof session.age === 'number' && Number.isFinite(session.age) ? session.age : 0;
  return Date.now() - Math.max(age, 0);
}

function inferCrewStatusFromSession(session: Session, spawnedStatus?: SubagentMapping['status']): CrewMember['status'] {
  const explicitStatus = [
    (session as Session & { status?: string }).status,
    (session as Session & { state?: string }).state,
    session.kind,
    ...(Array.isArray(session.flags) ? session.flags : []),
    spawnedStatus,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (explicitStatus.includes('error') || explicitStatus.includes('failed') || explicitStatus.includes('crash')) {
    return 'error';
  }

  if (
    explicitStatus.includes('completed') ||
    explicitStatus.includes('complete') ||
    explicitStatus.includes('success') ||
    explicitStatus.includes('finished') ||
    explicitStatus.includes('done') ||
    explicitStatus.includes('timeout')
  ) {
    return 'idle';
  }

  if (
    explicitStatus.includes('active') ||
    explicitStatus.includes('running') ||
    explicitStatus.includes('streaming') ||
    explicitStatus.includes('processing') ||
    explicitStatus.includes('spawning')
  ) {
    return 'active';
  }

  if (explicitStatus.includes('idle') || explicitStatus.includes('waiting')) {
    return 'idle';
  }

  const age = typeof session.age === 'number' && Number.isFinite(session.age) ? session.age : Infinity;
  if (age < ACTIVE_WINDOW_MS) return 'active';
  if (age < IDLE_WINDOW_MS) return 'idle';
  return 'offline';
}

function getAuthoritativeQSession(qSessions: Session[]): Session | undefined {
  if (qSessions.length === 0) return undefined;

  // Prefer the active telegram/direct main session when present.
  const telegramSessions = qSessions.filter(s => s.key.startsWith('agent:main:telegram:'));
  if (telegramSessions.length > 0) {
    return [...telegramSessions].sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0))[0];
  }

  // Fallback: any main-scoped non-subagent session, favoring the one with the most activity.
  const mainScoped = qSessions.filter(s => s.key.startsWith('agent:main:') && !s.key.includes('subagent'));
  if (mainScoped.length > 0) {
    return [...mainScoped].sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0))[0];
  }

  // Last resort: most recently updated.
  return qSessions.reduce((latest, current) =>
    getSessionUpdatedAt(current) > getSessionUpdatedAt(latest) ? current : latest
  );
}

let spawnBridgeBootstrapped = false;

function extractRequestIdFromSession(session: Session): string | undefined {
  const candidates: string[] = [];
  if (Array.isArray(session.flags)) {
    candidates.push(...session.flags);
  }

  const maybe = session as Session & { requestId?: string; task?: string; label?: string };
  if (typeof maybe.requestId === 'string') candidates.push(maybe.requestId);
  if (typeof maybe.task === 'string') candidates.push(maybe.task);
  if (typeof maybe.label === 'string') candidates.push(maybe.label);

  const merged = candidates.join(' ');
  const uuidMatch = merged.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return uuidMatch?.[0];
}

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  // Initial state
  connected: false,
  gatewayHealth: null,
  gatewayReady: null,
  sessions: [],
  activeCrew: getConfiguredCrewMembers().map(c => ({ ...c, status: 'offline' })),
  subagentMappings: new Map(),
  activeTasks: new Map(),
  memory: null,
  security: null,
  models: [],
  channels: [],
  feed: [],
  maxFeedEntries: 100,
  feedFilter: {},
  activeView: getInitialView(),
  selectedCrewId: null,
  dailyCost: 0,
  costHistory: [],
  qContextData: null,

  // Actions
  setConnected: (connected) => set({ connected }),

  updateHealth: (health) => set({ gatewayHealth: health }),

  updateReady: (ready) => set({ gatewayReady: ready }),

  registerSubagent: (sessionKey, crewId, task, sessionAge, spawnTimestamp) => {
    const sessionId = sessionKey.split(':').pop() || sessionKey;
    const resolvedSpawnTimestamp = spawnTimestamp ?? (Date.now() - (sessionAge || 0));
    // Intentional: registry writes are owned by the spawn orchestrator path only.
    // Gateway store keeps a local compatibility mapping for legacy UI consumers.

    const mapping: SubagentMapping = {
      sessionId,
      crewId,
      spawnedAt: resolvedSpawnTimestamp,
      task,
      status: 'spawning',
    };
    set(state => ({
      subagentMappings: new Map(state.subagentMappings).set(sessionId, mapping),
    }));

    const crew = getConfiguredCrewMembers().find(c => c.id === crewId);
    if (crew) {
      get().addFeedEntry({
        id: crypto.randomUUID(),
        timestamp: resolvedSpawnTimestamp,
        crewId,
        crewEmoji: crew.emoji,
        content: task ? `Spawned: ${task.substring(0, 80)}${task.length > 80 ? '...' : ''}` : 'Spawned',
        type: 'spawn',
      });
    }
  },

  updateSubagentStatus: (sessionKey, status) => {
    const sessionId = sessionKey.split(':').pop() || sessionKey;
    set(state => {
      const mappings = new Map(state.subagentMappings);
      const mapping = mappings.get(sessionId);
      if (mapping) {
        mappings.set(sessionId, { ...mapping, status });
      }
      return { subagentMappings: mappings };
    });
  },

  updateStatus: (status) => {
    if (!spawnBridgeBootstrapped) {
      spawnBridgeBootstrapped = true;
      startSpawnRegistryBridgePolling();
    }

    const sessions = status.sessions?.recent ?? [];
    const { subagentMappings } = get();

    // Get current active crew for last known value preservation
    const { activeCrew: currentActiveCrew } = get();

    // Explicit registration only; never infer unregistered sessions.
    const newMappings = new Map(subagentMappings);
    const registry = useCrewRegistryStore.getState();
    let mappingsChanged = false;

    // Build crew status with deterministic session matching
    const crewStatusMap = new Map<string, CrewRuntimeStatus>();

    // First: Handle Q using the authoritative main Q session for model/context display
    const qSessions = sessions.filter(s => s.agentId === 'main' && !s.key.includes('subagent'));
    
    const qModelSession = getAuthoritativeQSession(qSessions);

    if (qModelSession) {
      crewStatusMap.set('q', {
        status: inferCrewStatusFromSession(qModelSession),
        model: qModelSession.model,
        contextPercent: qModelSession.percentUsed ?? undefined,
        currentTask: undefined,
        updatedAt: getSessionUpdatedAt(qModelSession),
      });
    }

    // Second: Handle subagents using their specific mapped sessions and newest data wins
    sessions.forEach(session => {
      if (!session.key.includes('subagent')) return;

      const keyUuid = session.key.split(':').pop();
      const sessionId = session.sessionId;

      // Look up this specific session in the registry (supports both UUID forms)
      let reg = registry.getRegistrationBySession(sessionId, session.key);
      if (!reg) {
        const requestId = extractRequestIdFromSession(session);
        if (requestId) {
          registry.confirmRegistration({
            sessionId,
            sessionKey: session.key,
            requestId,
            modelActive: session.model,
          });
          reg = registry.getRegistrationBySession(sessionId, session.key);
        }
      }

      if (!reg) return;

      const actualMapping: SubagentMapping = {
        sessionId,
        crewId: reg.crewId,
        spawnedAt: reg.spawnedAt,
        task: reg.task,
        status: reg.status === 'completed' ? 'completed' : 'active',
      };

      if (keyUuid) {
        const previous = newMappings.get(keyUuid);
        if (!previous || JSON.stringify(previous) !== JSON.stringify(actualMapping)) {
          mappingsChanged = true;
        }
        newMappings.set(keyUuid, actualMapping);
      }

      const previousSessionMapping = newMappings.get(sessionId);
      if (!previousSessionMapping || JSON.stringify(previousSessionMapping) !== JSON.stringify(actualMapping)) {
        mappingsChanged = true;
      }
      newMappings.set(sessionId, actualMapping);

      const updatedAt = getSessionUpdatedAt(session);
      const crewStatus: CrewMember['status'] = inferCrewStatusFromSession(session, actualMapping.status);
      const existingStatus = crewStatusMap.get(actualMapping.crewId);

      // Keep the newest session snapshot for each crew member to avoid stale model/status overwrites
      if (existingStatus && existingStatus.updatedAt > updatedAt) {
        return;
      }

      crewStatusMap.set(actualMapping.crewId, {
        status: crewStatus,
        model: session.model || existingStatus?.model,
        contextPercent: session.percentUsed ?? existingStatus?.contextPercent,
        currentTask: actualMapping.task ?? existingStatus?.currentTask,
        updatedAt,
      });
    });

    const activeCrew = getConfiguredCrewMembers().map(c => {
      const crewStatus = crewStatusMap.get(c.id);
      const currentMember = currentActiveCrew.find(m => m.id === c.id);

      const isOnline = crewStatus ? crewStatus.status !== 'offline' : false;

      return {
        ...c,
        status: crewStatus?.status ?? 'offline',
        model: crewStatus?.model,
        contextPercent: crewStatus?.contextPercent,
        currentTask: crewStatus?.currentTask,

        // Preserve last known values when session disappears/offlines (for crash monitoring)
        lastKnownModel: isOnline
          ? undefined
          : (currentMember?.model ?? currentMember?.lastKnownModel),
        lastKnownContextPercent: isOnline
          ? undefined
          : (currentMember?.contextPercent ?? currentMember?.lastKnownContextPercent),
        lastSeen: isOnline
          ? Date.now()
          : (currentMember?.lastSeen ?? Date.now()),
      };
    });

    set({
      sessions,
      activeCrew,
      subagentMappings: newMappings,
      memory: status.memory ?? null,
      security: status.securityAudit ?? null,
      channels: status.channelSummary ?? [],
      qContextData: qModelSession ? {
        contextPercent: qModelSession.percentUsed ?? 0,
        tokensUsed: qModelSession.totalTokens ?? 0,
        tokensTotal: (qModelSession.totalTokens ?? 0) + (qModelSession.remainingTokens || 0),
        tokensRemaining: qModelSession.remainingTokens ?? 0,
      } : null,
    });

    // When mappings hydrate from the active status path, force an authoritative remap.
    // If sessionsStore is not initialized yet, this request is deferred and flushed on init.
    if (mappingsChanged) {
      queueMicrotask(() => {
        requestAuthoritativeSessionsRefresh().catch((error) => {
          console.warn('[GatewayStore] Failed to trigger sessions refresh after mapping hydration:', error);
        });
      });
    }
  },

  addFeedEntry: (entry) => {
    const { feed, maxFeedEntries, activeTasks } = get();
    
    // If this is a spawn or task entry, update activeTasks
    if (entry.type === 'spawn' || (entry.task && entry.status === 'running')) {
      const newActiveTasks = new Map(activeTasks);
      newActiveTasks.set(entry.crewId, entry);
      set({ activeTasks: newActiveTasks });
    }
    
    // If this is a completion, remove from activeTasks
    if (entry.type === 'complete') {
      const newActiveTasks = new Map(activeTasks);
      newActiveTasks.delete(entry.crewId);
      set({ activeTasks: newActiveTasks });
    }
    
    // Add to feed (avoid duplicates for same ID)
    const exists = feed.some(e => e.id === entry.id);
    if (!exists) {
      const newFeed = [entry, ...feed].slice(0, maxFeedEntries);
      set({ feed: newFeed });
    }
  },

  updateFeedEntry: (id, updates) => {
    const { feed } = get();
    const newFeed = feed.map(e => 
      e.id === id ? { ...e, ...updates } : e
    );
    set({ feed: newFeed });
  },

  updateActiveTask: (crewId, entry) => {
    const { activeTasks } = get();
    const newActiveTasks = new Map(activeTasks);
    newActiveTasks.set(crewId, entry);
    set({ activeTasks: newActiveTasks });
  },

  clearFeed: () => {
    set({ feed: [], activeTasks: new Map() });
  },

  setFeedFilter: (filter) => {
    set({ feedFilter: filter });
  },

  setActiveView: (view) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, view);
      } catch {
        // Ignore persistence failures and still update in-memory UI state.
      }
    }
    set({ activeView: view });
  },

  selectCrew: (id) => set({ selectedCrewId: id }),
}));
