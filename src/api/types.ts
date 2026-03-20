// OpenClaw Gateway types

export interface GatewayHealth {
  ok: boolean;
  status: string;
}

export interface GatewayReady {
  ready: boolean;
  failing: string[];
  uptimeMs: number;
}

export interface Session {
  agentId: string;
  key: string;
  kind: string;
  sessionId: string;
  updatedAt: number;
  age: number;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  remainingTokens: number;
  percentUsed: number;
  model: string;
  contextTokens: number;
  flags: string[];
}

export interface MemoryStatus {
  agentId: string;
  files: number;
  chunks: number;
  dirty: boolean;
  provider: string;
  model: string;
  cache: { enabled: boolean; entries: number };
  fts: { enabled: boolean; available: boolean };
  vector: { enabled: boolean; available: boolean; dims: number };
}

export interface SecurityAudit {
  summary: {
    critical: number;
    warn: number;
    info: number;
  };
  findings: Array<{
    severity: string;
    title: string;
    description: string;
  }>;
}

export interface AgentInfo {
  id: string;
  workspaceDir: string;
  sessionsCount: number;
  lastActiveAgeMs: number;
}

export interface StatusData {
  runtimeVersion: string;
  sessions: {
    count: number;
    recent: Session[];
  };
  agents: {
    defaultId: string;
    agents: AgentInfo[];
    totalSessions: number;
  };
  memory: MemoryStatus;
  securityAudit: SecurityAudit;
  channelSummary: string[];
  gateway: {
    mode: string;
    reachable: boolean;
    url: string;
  };
  heartbeat: {
    agents: Array<{
      agentId: string;
      enabled: boolean;
      every: string;
    }>;
  };
}

export interface ModelInfo {
  key: string;
  name: string;
  input: string;
  contextWindow: number;
  local: boolean;
  available: boolean;
  tags: string[];
}

export interface CrewMember {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'active' | 'idle' | 'offline' | 'error';
  model?: string;
  currentTask?: string;
  tokens?: number;
  contextPercent?: number;
}

export interface FeedEntry {
  id: string;
  timestamp: number;
  crewId: string;
  crewEmoji: string;
  content: string;
  type: 'tool' | 'message' | 'spawn' | 'completion' | 'error';
}

export type View = 'home' | 'crew' | 'cost' | 'system';

export interface CostSnapshot {
  date: string;
  totalCost: number;
  byModel: Record<string, number>;
}

// Context data for entity Q display
export interface QContextData {
  contextPercent: number;
  tokensUsed: number;
  tokensTotal: number;
  tokensRemaining: number;
}
