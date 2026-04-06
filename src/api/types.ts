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
  label?: string;
  displayName?: string;
  parentSessionKey?: string;
  spawnedBy?: string;
  subagentRole?: string;
  status?: 'running' | 'done' | 'failed' | 'killed' | 'timeout' | string;
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  updatedAt: number;
  age?: number;
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
  status: 'active' | 'idle' | 'completed' | 'timed-out' | 'stopped' | 'offline' | 'error';
  model?: string;
  requestedModel?: string;
  fallbackActive?: boolean;
  fallbackCount?: number;
  currentTask?: string;
  tokens?: number;
  contextPercent?: number;
  // Persistent fields for crash monitoring
  lastKnownModel?: string;
  lastKnownContextPercent?: number;
  lastSeen?: number;
}

export type FeedEntryType =
  | 'spawn'        // Subagent spawned
  | 'complete'     // Task completed
  | 'tool'         // Tool invocation (exec, read, write, etc.)
  | 'file'         // File operation (read/write/edit)
  | 'process'      // Process execution
  | 'search'       // Web search
  | 'message'      // Chat message
  | 'cron'         // Cron job
  | 'error'        // Error occurred
  | 'system';      // System event

export interface ToolInvocation {
  tool: string;           // Tool name: exec, read, write, web_search, etc.
  params?: Record<string, unknown>;  // Tool parameters (sanitized)
  summary?: string;       // Human-readable summary
}

export interface FileOperation {
  operation: 'read' | 'write' | 'edit';
  path: string;
  size?: number;
}

export interface ProcessExecution {
  command: string;
  workingDir?: string;
  durationMs?: number;
}

export interface FeedEntry {
  id: string;
  timestamp: number;
  crewId: string;
  crewEmoji: string;
  type: FeedEntryType;
  
  // Primary display content
  content: string;
  
  // Rich activity data
  task?: string;                    // Current task being worked on
  toolInvocation?: ToolInvocation;    // Tool call details
  fileOperation?: FileOperation;      // File operation details
  processExecution?: ProcessExecution; // Process execution details
  
  // Status/progress
  status?: 'pending' | 'running' | 'success' | 'error';
  progress?: number;                // 0-100 for long-running tasks
  
  // Grouping/collapsing
  groupKey?: string;                // Key for grouping similar events
  isGrouped?: boolean;              // Whether this entry is part of a group
  groupCount?: number;              // Number of events in this group
}

export interface FeedFilter {
  types?: FeedEntryType[];
  crewIds?: string[];
  searchQuery?: string;
  timeRange?: '1h' | '24h' | '7d' | 'all';
}

export type View = 'home' | 'crew' | 'system' | 'chat';

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

export type ChatConnectionStatus = 'idle' | 'connecting' | 'connected' | 'degraded' | 'disconnected' | 'error';
export type ChatSessionStatus = 'unknown' | 'available' | 'missing';

export interface ChatSessionResponse {
  ok?: boolean;
  sessionKey?: string | null;
  error?: string;
}

export interface ChatSessionResult {
  ok: boolean;
  sessionKey: string | null;
}

export type ChatMessageStatus = 'streaming' | 'complete' | 'interrupted' | 'error';

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user' | 'system';
  text: string;
  status?: ChatMessageStatus;
  createdAt: number;
}

export type ChatToolRunStatus = 'running' | 'success' | 'error';

export interface ChatToolRun {
  id: string;
  runId?: string;
  toolName?: string;
  status: ChatToolRunStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

export type ChatProxyEvent = {
  type: string;
  [key: string]: unknown;
};
