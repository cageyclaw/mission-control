/**
 * Activity Feed Store — Phase 5 Implementation
 *
 * The activity feed is a READ-ONLY PROJECTION of normalized gateway state.
 * It is NOT a source of truth. Truth lives in:
 *   - sessionsStore: session lifecycle, crew state
 *   - chatStore: chat messages
 *   - toolStore: tool activity runs
 *
 * Feed entries are computed/ephemeral — never persisted, always derived.
 * Components subscribe via hooks that recompute when source stores change.
 *
 * Architecture Principles:
 *   - Feed is a view, not the source of truth
 *   - No synthetic event generation
 *   - No feed-driven session/crew inference
 *   - Use sessionsStore.getCrewDisplayState() for crew state
 */

import { create } from 'zustand';
import { useMemo } from 'react';
import type {
  FeedEntry,
  FeedEntryType,
  CrewMember,
  ChatMessage,
  ChatToolRun,
} from '../api/types';
import { getConfiguredCrewMembers } from '../utils/crew';
import { useCrewRegistryStore } from './crewRegistryStore';
import { useSessionsStore } from './sessionsStore';
import { useChatStore } from './chatStore';
import { useToolStore } from './toolStore';

// ============================================================================
// Feed Entry Type Definitions
// ============================================================================

export interface FeedFilter {
  types?: FeedEntryType[];
  crewIds?: string[];
  searchQuery?: string;
  timeRange?: '1h' | '24h' | '7d' | 'all';
}

export interface ComputedFeedEntry extends FeedEntry {
  // Computed fields for display
  displayTimestamp: number; // Normalized timestamp for sorting
  source: 'session' | 'chat' | 'tool'; // Source domain for debugging

  // Grouping fields (set by groupConsecutiveEntries)
  isGrouped?: boolean;
  groupCount?: number;
}

// ============================================================================
// Pure Selector Functions (State → Feed Entries)
// ============================================================================

/**
 * Build feed entries from session lifecycle events.
 * Derives spawn/complete events from actual session state changes.
 */
function computeSessionFeedEntries(
  sessions: ReturnType<typeof useSessionsStore.getState>['getSessions']
): ComputedFeedEntry[] {
  const entries: ComputedFeedEntry[] = [];
  const sessionsList = sessions();

  // Group sessions by crew to detect lifecycle events
  const sessionsByCrew = new Map<string, typeof sessionsList>();
  for (const session of sessionsList) {
    // Extract crew ID from session using same logic as sessionsStore
    const crewId = extractCrewIdFromSession(session);
    if (!crewId) continue;

    const crewSessions = sessionsByCrew.get(crewId) || [];
    crewSessions.push(session);
    sessionsByCrew.set(crewId, crewSessions);
  }

  // Generate spawn entries for active subagent sessions
  for (const [crewId, crewSessions] of sessionsByCrew) {
    if (crewId === 'q') continue; // Skip main Q session spawns

    const crew = getConfiguredCrewMembers().find((c) => c.id === crewId);
    if (!crew) continue;

    for (const session of crewSessions) {
      const isSubagent = session.key.includes('subagent');
      if (!isSubagent) continue;

      // Session spawn event (use session age to estimate spawn time)
      const age = typeof session.age === 'number' ? session.age : 0;
      const spawnTime = session.updatedAt
        ? session.updatedAt - age
        : Date.now() - age;

      entries.push({
        id: `spawn:${session.sessionId}`,
        timestamp: spawnTime,
        displayTimestamp: spawnTime,
        crewId: crew.id,
        crewEmoji: crew.emoji,
        type: 'spawn',
        content: `Spawned subagent session`,
        status: inferSessionStatus(session) === 'active' ? 'running' : 'success',
        source: 'session',
      });

      // Session completion/error entry if terminal state
      const status = inferSessionStatus(session);
      if (status === 'error') {
        entries.push({
          id: `error:${session.sessionId}`,
          // Note: Date.now() fallback makes this technically impure, but acceptable for UI
          timestamp: session.updatedAt || Date.now(),
          displayTimestamp: session.updatedAt || Date.now(),
          crewId: crew.id,
          crewEmoji: '❌',
          type: 'error',
          content: `Session error: ${session.kind || 'unknown error'}`,
          status: 'error',
          source: 'session',
        });
      } else if (status === 'offline' || status === 'idle') {
        // Session completed successfully (terminal state without error)
        entries.push({
          id: `complete:${session.sessionId}`,
          // Note: Date.now() fallback makes this technically impure, but acceptable for UI
          timestamp: session.updatedAt || Date.now(),
          displayTimestamp: session.updatedAt || Date.now(),
          crewId: crew.id,
          crewEmoji: crew.emoji,
          type: 'complete',
          content: `Completed subagent task`,
          status: 'success',
          source: 'session',
        });
      }
    }
  }

  return entries;
}

/**
 * Build feed entries from chat messages.
 * Creates message entries for user and assistant messages.
 */
function computeChatFeedEntries(
  transcript: ChatMessage[],
  sessionKey: string | null
): ComputedFeedEntry[] {
  const entries: ComputedFeedEntry[] = [];

  // Get the crew context for this chat session
  const sessionCrewId = sessionKey ? extractCrewIdFromSessionKey(sessionKey) : 'q';
  const crew =
    getConfiguredCrewMembers().find((c) => c.id === sessionCrewId) ||
    ({ id: 'q', name: 'Q', emoji: '🧠' } as CrewMember);

  for (const message of transcript) {
    // Skip system messages for the feed
    if (message.role === 'system') continue;

    const isUser = message.role === 'user';
    const entryType: FeedEntryType = 'message';

    entries.push({
      id: `msg:${message.id}`,
      timestamp: message.createdAt,
      displayTimestamp: message.createdAt,
      crewId: isUser ? 'user' : crew.id,
      crewEmoji: isUser ? '👤' : crew.emoji,
      type: entryType,
      content: truncate(message.text, 200),
      status: message.status === 'error' ? 'error' : 'success',
      source: 'chat',
    });
  }

  return entries;
}

/**
 * Build feed entries from tool activity runs.
 * Creates tool entries for active and completed tool runs.
 */
function computeToolFeedEntries(
  runs: ChatToolRun[],
  sessionKey: string | null
): ComputedFeedEntry[] {
  const entries: ComputedFeedEntry[] = [];

  // Get crew context from session key
  const sessionCrewId = sessionKey ? extractCrewIdFromSessionKey(sessionKey) : 'q';
  const crew =
    getConfiguredCrewMembers().find((c) => c.id === sessionCrewId) ||
    ({ id: 'q', name: 'Q', emoji: '🧠' } as CrewMember);

  for (const run of runs) {
    const toolName = run.toolName || 'tool';
    const status = run.status === 'running' ? 'running' : run.status === 'error' ? 'error' : 'success';

    // Determine entry type based on tool
    let entryType: FeedEntryType = 'tool';
    if (toolName === 'read' || toolName === 'write' || toolName === 'edit') {
      entryType = 'file';
    } else if (toolName === 'exec') {
      entryType = 'process';
    } else if (toolName === 'web_search' || toolName === 'web_fetch') {
      entryType = 'search';
    }

    // Build content from tool invocation
    const content = buildToolContent(toolName, run.input);

    entries.push({
      id: `tool:${run.id}`,
      timestamp: run.startedAt,
      displayTimestamp: run.startedAt,
      crewId: crew.id,
      crewEmoji: crew.emoji,
      type: entryType,
      content,
      status,
      toolInvocation: {
        tool: toolName,
        params: sanitizeToolInput(run.input),
        summary: content,
      },
      source: 'tool',
    });

    // Add completion entry if tool finished
    if (run.finishedAt && run.status !== 'running') {
      // The tool entry itself represents the completion, no separate entry needed
    }
  }

  return entries;
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractCrewIdFromSession(session: { key: string; agentId: string; sessionId?: string }): string | null {
  const registry = useCrewRegistryStore.getState();
  const registration = registry.getRegistrationBySession(session.sessionId, session.key);
  if (registration) return registration.crewId;

  // Main-session policy: only non-subagent main session maps to Q.
  if (session.key.includes(':main') && !session.key.includes('subagent')) return 'q';

  // Never auto-attribute unregistered subagent sessions.
  return null;
}

function extractCrewIdFromSessionKey(sessionKey: string): string {
  const registry = useCrewRegistryStore.getState();
  const sessionId = sessionKey.split(':').pop() || sessionKey;
  const registration = registry.getRegistrationBySession(sessionId, sessionKey);
  if (registration) return registration.crewId;

  if (sessionKey.includes(':main') && !sessionKey.includes('subagent')) return 'q';
  return 'q';
}

function inferSessionStatus(session: {
  kind: string;
  flags: string[];
  age?: number;
}): 'active' | 'idle' | 'error' | 'offline' {
  const statusText = [session.kind, ...session.flags].join(' ').toLowerCase();

  if (statusText.includes('error') || statusText.includes('failed')) return 'error';
  if (statusText.includes('active') || statusText.includes('running') || statusText.includes('stream')) {
    return 'active';
  }
  if (statusText.includes('idle') || statusText.includes('waiting')) return 'idle';

  const age = typeof session.age === 'number' ? session.age : Number.POSITIVE_INFINITY;
  if (age <= 120000) return 'active';
  if (age <= 600000) return 'idle';
  return 'offline';
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function buildToolContent(toolName: string, input: unknown): string {
  const params = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};

  switch (toolName) {
    case 'read': {
      const path = typeof params.file_path === 'string' ? params.file_path : String(params.path || 'file');
      return `read ${path.split('/').pop() || path}`;
    }
    case 'write': {
      const path = typeof params.path === 'string' ? params.path : 'file';
      return `wrote ${path.split('/').pop() || path}`;
    }
    case 'edit': {
      const path = typeof params.file_path === 'string' ? params.file_path : 'file';
      return `edited ${path.split('/').pop() || path}`;
    }
    case 'exec': {
      const command = typeof params.command === 'string' ? params.command : 'command';
      return `executed ${command.split(' ')[0] || command}`;
    }
    case 'web_search': {
      const query = typeof params.query === 'string' ? params.query : 'web';
      return `searched "${truncate(query, 40)}"`;
    }
    case 'web_fetch': {
      const url = typeof params.url === 'string' ? params.url : 'page';
      return `fetched ${truncate(url, 40)}`;
    }
    case 'image': {
      return 'analyzed image';
    }
    default:
      return `invoked ${toolName}`;
  }
}

function sanitizeToolInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};

  const params = input as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    // Only include safe parameter keys
    if (['file_path', 'path', 'url', 'command', 'query'].includes(key)) {
      sanitized[key] = typeof value === 'string' ? truncate(value, 100) : value;
    }
  }

  return sanitized;
}

// ============================================================================
// Feed Processing Utilities
// ============================================================================

function sortAndDeduplicateEntries(entries: ComputedFeedEntry[]): ComputedFeedEntry[] {
  // Sort by timestamp descending
  const sorted = [...entries].sort((a, b) => b.displayTimestamp - a.displayTimestamp);

  // Deduplicate by ID (keep first occurrence)
  const seen = new Set<string>();
  return sorted.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function filterEntries(entries: ComputedFeedEntry[], filter: FeedFilter): ComputedFeedEntry[] {
  return entries.filter((entry) => {
    // Type filter
    if (filter.types?.length && !filter.types.includes(entry.type)) {
      return false;
    }

    // Crew filter
    if (filter.crewIds?.length && !filter.crewIds.includes(entry.crewId)) {
      return false;
    }

    // Search filter
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const content = entry.content.toLowerCase();
      const task = entry.task?.toLowerCase() || '';
      if (!content.includes(query) && !task.includes(query)) {
        return false;
      }
    }

    // Time range filter
    if (filter.timeRange && filter.timeRange !== 'all') {
      const now = Date.now();
      const ranges: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      const cutoff = now - (ranges[filter.timeRange] || 0);
      if (entry.timestamp < cutoff) {
        return false;
      }
    }

    return true;
  });
}

function groupConsecutiveEntries(entries: ComputedFeedEntry[]): ComputedFeedEntry[] {
  const grouped: ComputedFeedEntry[] = [];
  let lastCrewId: string | null = null;

  for (const entry of entries) {
    if (entry.crewId === lastCrewId && entry.type === 'tool') {
      // Group tool invocations from same crew
      const lastEntry = grouped[grouped.length - 1];
      if (lastEntry && !lastEntry.isGrouped) {
        lastEntry.isGrouped = true;
        lastEntry.groupCount = 1;
      }
      if (lastEntry) {
        lastEntry.groupCount = (lastEntry.groupCount || 1) + 1;
      }
    } else {
      grouped.push({ ...entry });
    }
    lastCrewId = entry.crewId;
  }

  return grouped;
}

// ============================================================================
// Store Definition
// ============================================================================

interface ActivityFeedStore {
  // Configuration
  maxEntries: number;

  // Filter state (UI only, not persisted)
  filter: FeedFilter;

  // Actions
  setFilter: (filter: FeedFilter) => void;
  setMaxEntries: (max: number) => void;
}

export const useActivityFeedStore = create<ActivityFeedStore>((set) => ({
  maxEntries: 100,
  filter: {},

  setFilter: (filter) => set({ filter }),
  setMaxEntries: (maxEntries) => set({ maxEntries }),
}));

// ============================================================================
// Hooks for Components (React integration)
// ============================================================================

/**
 * Hook to get computed feed entries from all source stores.
 * This is the primary hook for the ActivityFeed component.
 */
export function useComputedFeedEntries(): ComputedFeedEntry[] {
  // Subscribe to source stores
  const sessionsState = useSessionsStore();
  const chatState = useChatStore();
  const toolState = useToolStore();

  // Compute entries from all sources
  const entries = useMemo(() => {
    // Session lifecycle entries
    const sessionEntries = computeSessionFeedEntries(
      sessionsState.getSessions
    );

    // Chat message entries
    const chatEntries = computeChatFeedEntries(
      chatState.transcript,
      chatState.sessionKey
    );

    // Tool activity entries
    const toolEntries = computeToolFeedEntries(
      toolState.getRunsForSession(chatState.sessionKey),
      chatState.sessionKey
    );

    // Combine and process
    const allEntries = [...sessionEntries, ...chatEntries, ...toolEntries];
    return sortAndDeduplicateEntries(allEntries);
  }, [
    sessionsState.sessionsByKey,
    sessionsState.sessionKeys,
    chatState.transcript,
    chatState.sessionKey,
    toolState.byId,
    toolState.idsBySession,
    // crewState omitted — recomputes via sessionsState.sessionsByKey/sessionKeys already
  ]);

  return entries;
}

/**
 * Hook to get filtered and grouped feed entries.
 * Uses the store filter settings.
 */
export function useFilteredFeedEntries(): ComputedFeedEntry[] {
  const entries = useComputedFeedEntries();
  const filter = useActivityFeedStore((state) => state.filter);

  return useMemo(() => {
    const filtered = filterEntries(entries, filter);
    return groupConsecutiveEntries(filtered);
  }, [entries, filter]);
}

/**
 * Hook to get active tasks from running sessions/tools.
 * Derives from real store state, not synthetic events.
 */
export function useActiveTasks(): Array<{
  crewId: string;
  crewEmoji: string;
  task: string;
  startedAt: number;
}> {
  const sessionsState = useSessionsStore();
  const toolState = useToolStore();
  const chatState = useChatStore();

  return useMemo(() => {
    const tasks: Array<{
      crewId: string;
      crewEmoji: string;
      task: string;
      startedAt: number;
    }> = [];

    const crewState = sessionsState.getCrewDisplayState();

    // Active crew members with active status
    for (const crew of crewState) {
      if (crew.status !== 'active') continue;

      // Get sessions for this crew
      const crewSessions = sessionsState.getSessionsForCrew(crew.id);
      const activeSession = crewSessions.find((s) => {
        const age = typeof s.age === 'number' ? s.age : Infinity;
        return age < 120000; // Active within last 2 minutes
      });

      if (activeSession) {
        tasks.push({
          crewId: crew.id,
          crewEmoji: crew.emoji,
          task: crew.currentTask || `Active session (${activeSession.model || 'unknown'})`,
          startedAt: activeSession.updatedAt
            ? activeSession.updatedAt - (activeSession.age || 0)
            : Date.now() - (activeSession.age || 0),
        });
      }
    }

    // Running tool activities
    if (chatState.sessionKey) {
      const runs = toolState.getRunsForSession(chatState.sessionKey);
      for (const run of runs) {
        if (run.status === 'running') {
          const sessionCrewId = extractCrewIdFromSessionKey(chatState.sessionKey);
          const crew =
            getConfiguredCrewMembers().find((c) => c.id === sessionCrewId) ||
            ({ id: 'q', emoji: '🧠' } as CrewMember);

          tasks.push({
            crewId: crew.id,
            crewEmoji: crew.emoji,
            task: `Running ${run.toolName || 'tool'}`,
            startedAt: run.startedAt,
          });
        }
      }
    }

    return tasks;
  }, [
    sessionsState.sessionsByKey,
    sessionsState.sessionKeys,
    toolState.byId,
    toolState.idsBySession,
    chatState.sessionKey,
  ]);
}

/**
 * Hook to get feed entry count by type.
 * Useful for filter badges.
 */
export function useFeedCountsByType(): Record<FeedEntryType, number> {
  const entries = useComputedFeedEntries();

  return useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      counts[entry.type] = (counts[entry.type] || 0) + 1;
    }
    return counts as Record<FeedEntryType, number>;
  }, [entries]);
}

/**
 * Hook to get the latest feed entry timestamp.
 * Useful for "last activity" indicators.
 */
export function useLastActivityTimestamp(): number | null {
  const entries = useComputedFeedEntries();

  return useMemo(() => {
    if (entries.length === 0) return null;
    return entries[0].timestamp;
  }, [entries]);
}

// ============================================================================
// Legacy Compatibility (for gradual migration)
// ============================================================================

/**
 * Compatibility shim that provides the old FeedEntry[] interface.
 * Maps ComputedFeedEntry to FeedEntry for existing components.
 */
export function useLegacyFeedEntries(): FeedEntry[] {
  const entries = useFilteredFeedEntries();

  return useMemo(() => {
    // Strip computed fields to match legacy FeedEntry type
    return entries.map(({ displayTimestamp, source, ...entry }) => ({
      ...entry,
    }));
  }, [entries]);
}
