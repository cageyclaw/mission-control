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
import { CREW_MEMBERS, detectCrew, registerSubagentWithDualIds, cleanupCompletedSubagents, type SubagentMapping } from '../utils/crew';
import { resolveMetricsUrl } from '../config';

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

  // System Metrics
  systemMetrics: {
    cpu: { usage: number; loadAverage: number[] };
    memory: { used: number; total: number; percent: number };
    disk: { used: number; total: number; percent: number };
    timestamp: number;
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

  // System Metrics
  fetchSystemMetrics: () => Promise<void>;
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

  // DEBUG: Log all Q sessions for troubleshooting
  console.log('[DEBUG] getAuthoritativeQSession called with', qSessions.length, 'sessions:');
  qSessions.forEach((s, i) => {
    console.log(`  [${i}] key: ${s.key}, model: ${s.model}, tokens: ${s.totalTokens}, age: ${s.age}`);
  });

  // Find telegram sessions and pick the one with highest token count (most active)
  const telegramSessions = qSessions.filter(s => s.key.startsWith('agent:main:telegram:'));
  if (telegramSessions.length > 0) {
    // Sort by token count descending (most active = most tokens used)
    const sortedByTokens = telegramSessions.sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0));
    console.log('[DEBUG] Selected telegram session by token count:', sortedByTokens[0].key, 'model:', sortedByTokens[0].model);
    return sortedByTokens[0];
  }

  // Fallback: find any main session with highest token count
  const mainScoped = qSessions.filter(s => s.key.startsWith('agent:main:') && !s.key.includes('subagent'));
  if (mainScoped.length > 0) {
    const sortedByTokens = mainScoped.sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0));
    console.log('[DEBUG] Selected main session by token count:', sortedByTokens[0].key, 'model:', sortedByTokens[0].model);
    return sortedByTokens[0];
  }

  // Last resort: most recently updated
  const latest = qSessions.reduce((latest, current) =>
    getSessionUpdatedAt(current) > getSessionUpdatedAt(latest) ? current : latest
  );
  console.log('[DEBUG] Fallback to latest updated session:', latest.key, 'model:', latest.model);
  return latest;
}

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  // Initial state
  connected: false,
  gatewayHealth: null,
  gatewayReady: null,
  sessions: [],
  activeCrew: CREW_MEMBERS.map(c => ({ ...c, status: 'offline' })),
  subagentMappings: new Map(),
  activeTasks: new Map(),
  memory: null,
  security: null,
  models: [],
  channels: [],
  feed: [],
  maxFeedEntries: 100,
  feedFilter: {},
  activeView: 'home',
  selectedCrewId: null,
  dailyCost: 0,
  costHistory: [],
  qContextData: null,
  systemMetrics: null,

  // Actions
  setConnected: (connected) => set({ connected }),

  updateHealth: (health) => set({ gatewayHealth: health }),

  updateReady: (ready) => set({ gatewayReady: ready }),

  registerSubagent: (sessionKey, crewId, task, sessionAge, spawnTimestamp) => {
    const sessionId = sessionKey.split(':').pop() || sessionKey;
    const resolvedSpawnTimestamp = spawnTimestamp ?? (Date.now() - (sessionAge || 0));
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

    // Add spawn entry to activity feed
    const crew = CREW_MEMBERS.find(c => c.id === crewId);
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
    const sessions = status.sessions?.recent ?? [];
    const { subagentMappings, feed } = get();

    // Clean up old completed subagents periodically (once per 5 calls)
    if (Math.random() < 0.2) {
      cleanupCompletedSubagents(3600000); // 1 hour TTL
    }

    // Get current active crew for last known value preservation
    const { activeCrew: currentActiveCrew } = get();

    // Auto-detect new subagent sessions and register them
    const newMappings = new Map(subagentMappings);
    
    sessions.forEach(session => {
      if (session.key.includes('subagent')) {
        const keyUuid = session.key.split(':').pop();
        const sessionId = session.sessionId;
        
        if (keyUuid && !newMappings.has(keyUuid) && !newMappings.has(sessionId)) {
          // Try to infer crew from session context or recent feed
          let crewId: string | null = null;
          let task: string | undefined;
          
          // Check if this session appears in a recent spawn entry
          const recentSpawn = feed.find(e => 
            e.type === 'spawn' && 
            e.timestamp > Date.now() - 60000 && // Within last minute
            e.crewId !== 'unknown'
          );
          if (recentSpawn) {
            crewId = recentSpawn.crewId;
            task = recentSpawn.task;
          }
          
          // If no spawn entry, try to infer from task using detectCrew
          if (!crewId && keyUuid) {
            // detectCrew will auto-register if it can infer a crew
            const pendingCrew = detectCrew(session.key, undefined, sessionId);
            if (pendingCrew && pendingCrew.id !== 'unknown') {
              crewId = pendingCrew.id;
            }
          }
          
          // Fallback: mark as 'unknown' subagent
          if (!crewId) {
            crewId = 'unknown';
          }

          const sessionAge = session.age || 0;
          const spawnTimestamp = Date.now() - sessionAge;
          get().registerSubagent(session.key, crewId, task, sessionAge, spawnTimestamp);

          const mapping: SubagentMapping = {
            sessionId,
            crewId,
            spawnedAt: spawnTimestamp,
            task,
            status: 'active',
          };
          newMappings.set(keyUuid, mapping);
          newMappings.set(sessionId, mapping);
          
          // Also register in the utility registry
          registerSubagentWithDualIds(keyUuid, sessionId, crewId, task);
          
          console.log(`[GatewayStore] Auto-registered ${crewId} for session ${keyUuid.substring(0, 8)}...`);
        }
      }
    });

    // Build crew status with deterministic session matching
    const crewStatusMap = new Map<string, CrewRuntimeStatus>();

    // First: Handle Q using the authoritative main Q session for model/context display
    const qSessions = sessions.filter(s => s.agentId === 'main' && !s.key.includes('subagent'));
    
    // DEBUG: Log all filtered Q sessions
    console.log('[DEBUG] updateStatus: Found', qSessions.length, 'Q sessions (agentId=main, not subagent):');
    qSessions.forEach((s, i) => {
      console.log(`  [${i}] key: ${s.key}, model: ${s.model}, totalTokens: ${s.totalTokens}, age: ${s.age}`);
    });
    
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
      const mappingByKey = keyUuid ? newMappings.get(keyUuid) : undefined;
      const mappingBySessionId = newMappings.get(sessionId);
      const actualMapping = mappingByKey || mappingBySessionId;

      if (!actualMapping) return;

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

    const activeCrew = CREW_MEMBERS.map(c => {
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

  setActiveView: (view) => set({ activeView: view }),

  selectCrew: (id) => set({ selectedCrewId: id }),

  // Fetch system metrics from standalone server
  fetchSystemMetrics: async () => {
    try {
      const response = await fetch(await resolveMetricsUrl('/api/system/metrics'));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const metrics = await response.json();
      set({ systemMetrics: metrics });
    } catch (error) {
      // Silently fail - system metrics server may not be running
      console.log('[SystemMetrics] Fetch failed:', error);
    }
  },
}));
