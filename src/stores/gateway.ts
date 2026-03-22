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
  registerSubagent: (sessionKey: string, crewId: string, task?: string) => void;
  updateSubagentStatus: (sessionKey: string, status: SubagentMapping['status']) => void;
  updateActiveTask: (crewId: string, entry: FeedEntry) => void;
  clearFeed: () => void;
  setFeedFilter: (filter: { types?: string[]; crewIds?: string[]; searchQuery?: string }) => void;
  setActiveView: (view: View) => void;
  selectCrew: (id: string | null) => void;

  // System Metrics
  fetchSystemMetrics: () => Promise<void>;
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

  registerSubagent: (sessionKey, crewId, task) => {
    const sessionId = sessionKey.split(':').pop() || sessionKey;
    const mapping: SubagentMapping = {
      sessionId,
      crewId,
      spawnedAt: Date.now(),
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
        timestamp: Date.now(),
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

          const mapping: SubagentMapping = {
            sessionId,
            crewId,
            spawnedAt: Date.now() - (session.age || 0),
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

    // Build crew status with PROPER session matching
    const crewStatusMap = new Map<string, { 
      status: CrewMember['status']; 
      model?: string;
      contextPercent?: number;
      currentTask?: string;
    }>();

    // First: Handle Q (main session) separately
    // Prioritize agent:main:main or webchat sessions, ignore Telegram sessions for Q
    const qSession = sessions
      .filter(s => s.agentId === 'main' && !s.key.includes('subagent'))
      .sort((a, b) => {
        // Prefer agent:main:main or webchat sessions
        const aIsPreferred = a.key === 'agent:main:main' || a.key.includes('webchat');
        const bIsPreferred = b.key === 'agent:main:main' || b.key.includes('webchat');
        if (aIsPreferred && !bIsPreferred) return -1;
        if (!aIsPreferred && bIsPreferred) return 1;
        // Then prefer most recent (lowest age)
        return (a.age || Infinity) - (b.age || Infinity);
      })[0];

    if (qSession) {
      const age = qSession.age || 0;
      let qStatus: CrewMember['status'] = 'offline';
      if (age < 120000) { // 2 minutes = active
        qStatus = 'active';
      } else if (age < 600000) { // 10 minutes = idle
        qStatus = 'idle';
      }

      crewStatusMap.set('q', {
        status: qStatus,
        model: qSession.model,
        contextPercent: qSession.percentUsed ?? undefined,
        currentTask: undefined,
      });
    }

    // Second: Handle subagents using their SPECIFIC sessions
    sessions.forEach(session => {
      if (!session.key.includes('subagent')) return;
      
      const keyUuid = session.key.split(':').pop();
      const sessionId = session.sessionId;
      
      // Look up this SPECIFIC session in the registry
      const mapping = keyUuid ? newMappings.get(keyUuid) : undefined;
      const mappingBySessionId = newMappings.get(sessionId);
      const actualMapping = mapping || mappingBySessionId;
      
      if (!actualMapping) return;
      
      // Determine status based on session age
      const age = session.age || 0;
      let crewStatus: CrewMember['status'] = 'offline';
      
      if (age < 120000) { // 2 minutes = active
        crewStatus = 'active';
      } else if (age < 600000) { // 10 minutes = idle
        crewStatus = 'idle';
      }

      // Check if this is a newly spawned subagent
      if (actualMapping.status === 'spawning') {
        crewStatus = 'active';
      }

      // Only set status for the crew this session ACTUALLY belongs to
      crewStatusMap.set(actualMapping.crewId, {
        status: crewStatus,
        model: session.model,
        contextPercent: session.percentUsed ?? undefined,
        currentTask: actualMapping.task,
      });
    });

    const activeCrew = CREW_MEMBERS.map(c => {
      const crewStatus = crewStatusMap.get(c.id);
      const currentMember = currentActiveCrew.find(m => m.id === c.id);
      
      // Determine if this is a fresh session or we're preserving last known
      const isCurrentlyActive = crewStatus?.status && crewStatus.status !== 'offline';
      
      return {
        ...c,
        status: crewStatus?.status ?? 'offline',
        model: crewStatus?.model ?? currentMember?.model,
        contextPercent: crewStatus?.contextPercent ?? currentMember?.contextPercent,
        currentTask: crewStatus?.currentTask ?? currentMember?.currentTask,
        
        // Preserve last known values when going offline
        lastKnownModel: isCurrentlyActive 
          ? undefined 
          : (crewStatus?.model ?? currentMember?.lastKnownModel ?? currentMember?.model),
        lastKnownContextPercent: isCurrentlyActive 
          ? undefined 
          : (crewStatus?.contextPercent ?? currentMember?.lastKnownContextPercent ?? currentMember?.contextPercent),
        lastSeen: isCurrentlyActive 
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
      qContextData: qSession ? {
        contextPercent: qSession.percentUsed,
        tokensUsed: qSession.totalTokens,
        tokensTotal: qSession.totalTokens + (qSession.remainingTokens || 0),
        tokensRemaining: qSession.remainingTokens || 0,
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
      const response = await fetch('/metrics/api/system/metrics');
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
