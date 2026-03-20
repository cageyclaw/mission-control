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
import { CREW_MEMBERS, detectCrew } from '../utils/crew';

interface GatewayStore {
  // Connection
  connected: boolean;
  gatewayHealth: GatewayHealth | null;
  gatewayReady: GatewayReady | null;

  // Sessions
  sessions: Session[];
  activeCrew: CrewMember[];

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

  // UI state
  activeView: View;
  selectedCrewId: string | null;

  // Cost
  dailyCost: number;
  costHistory: CostSnapshot[];

  // Actions
  setConnected: (connected: boolean) => void;
  updateHealth: (health: GatewayHealth) => void;
  updateReady: (ready: GatewayReady) => void;
  updateStatus: (status: StatusData) => void;
  addFeedEntry: (entry: FeedEntry) => void;
  setActiveView: (view: View) => void;
  selectCrew: (id: string | null) => void;
}

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  // Initial state
  connected: false,
  gatewayHealth: null,
  gatewayReady: null,
  sessions: [],
  activeCrew: CREW_MEMBERS.map(c => ({ ...c, status: 'offline' })),
  memory: null,
  security: null,
  models: [],
  channels: [],
  feed: [],
  maxFeedEntries: 100,
  activeView: 'home',
  selectedCrewId: null,
  dailyCost: 0,
  costHistory: [],

  // Actions
  setConnected: (connected) => set({ connected }),

  updateHealth: (health) => set({ gatewayHealth: health }),

  updateReady: (ready) => set({ gatewayReady: ready }),

  updateStatus: (status) => {
    const sessions = status.sessions?.recent ?? [];

    // Update crew status based on sessions
    const crewStatusMap = new Map<string, CrewMember['status']>();
    sessions.forEach(session => {
      const crew = detectCrew(session.key);
      if (crew) {
        const isActive = session.age < 300000; // active within 5 min
        crewStatusMap.set(crew.id, isActive ? 'active' : 'idle');
      }
    });

    const activeCrew = CREW_MEMBERS.map(c => ({
      ...c,
      status: crewStatusMap.get(c.id) ?? 'offline',
      model: sessions.find(s => detectCrew(s.key)?.id === c.id)?.model,
      contextPercent: sessions.find(s => detectCrew(s.key)?.id === c.id)?.percentUsed,
    }));

    set({
      sessions,
      activeCrew,
      memory: status.memory ?? null,
      security: status.securityAudit ?? null,
      channels: status.channelSummary ?? [],
    });
  },

  addFeedEntry: (entry) => {
    const { feed, maxFeedEntries } = get();
    const newFeed = [entry, ...feed].slice(0, maxFeedEntries);
    set({ feed: newFeed });
  },

  setActiveView: (view) => set({ activeView: view }),

  selectCrew: (id) => set({ selectedCrewId: id }),
}));
