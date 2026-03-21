/**
 * Feed Entry Utilities
 * 
 * Helper functions for generating rich activity feed entries.
 * These utilities create structured feed entries for different activity types.
 */

import type { FeedEntry, FeedEntryType } from '../api/types';

// Crew emoji mapping
const CREW_EMOJI_MAP: Record<string, string> = {
  q: '🧠',
  data: '🔍',
  geordi: '🔧',
  spark: '⚡',
  riker: '🎯',
  troi: '💝',
  barclay: '🎨',
  unknown: '🤖',
};

/**
 * Get the emoji for a crew member
 */
export function getCrewEmoji(crewId: string): string {
  return CREW_EMOJI_MAP[crewId] || '🤖';
}

/**
 * Truncate a string to a maximum length with ellipsis
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Sanitize tool parameters to remove sensitive data
 */
export function sanitizeToolParams(params: Record<string, any>): Record<string, any> {
  if (!params || typeof params !== 'object') return {};
  
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    // Only include safe parameter keys
    if (['file_path', 'path', 'url', 'command', 'query'].includes(key)) {
      sanitized[key] = typeof value === 'string' ? truncate(value, 100) : value;
    }
  }
  return sanitized;
}

/**
 * Summarize a tool invocation for display
 */
export function summarizeToolInvocation(tool: string, params: Record<string, any>): string {
  switch (tool) {
    case 'read':
      return `read ${params.file_path?.split('/').pop() || 'file'}`;
    case 'write':
      return `wrote ${params.path?.split('/').pop() || 'file'}`;
    case 'edit':
      return `edited ${params.file_path?.split('/').pop() || 'file'}`;
    case 'exec':
      return `executed ${params.command?.split(' ')[0] || 'command'}`;
    case 'web_search':
      return `searched web`;
    case 'web_fetch':
      return `fetched page`;
    case 'image':
      return `analyzed image`;
    case 'sessions_spawn':
      return `spawned subagent`;
    case 'sessions_yield':
      return `yielded session`;
    default:
      return `invoked ${tool}`;
  }
}

/**
 * Create a base feed entry with common fields
 */
function createBaseEntry(
  crewId: string,
  type: FeedEntryType,
  content: string,
  task?: string
): FeedEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    crewId,
    crewEmoji: getCrewEmoji(crewId),
    type,
    content,
    task,
    status: 'success',
  };
}

/**
 * Create a tool invocation feed entry
 */
export function createToolEntry(
  tool: string,
  params: Record<string, any>,
  crewId: string = 'q',
  task?: string
): FeedEntry {
  const summary = summarizeToolInvocation(tool, params);
  
  return {
    ...createBaseEntry(crewId, 'tool', summary, task),
    toolInvocation: {
      tool,
      params: sanitizeToolParams(params),
      summary,
    },
  };
}

/**
 * Create a file operation feed entry
 */
export function createFileEntry(
  operation: 'read' | 'write' | 'edit',
  path: string,
  crewId: string = 'q',
  task?: string
): FeedEntry {
  const fileName = path.split('/').pop() || path;
  const verb = operation === 'read' ? 'read' : operation === 'write' ? 'wrote' : 'edited';
  
  return {
    ...createBaseEntry(crewId, 'file', `${verb} ${fileName}`, task),
    fileOperation: {
      operation,
      path,
    },
  };
}

/**
 * Create a process execution feed entry
 */
export function createProcessEntry(
  command: string,
  workingDir?: string,
  crewId: string = 'q',
  task?: string
): FeedEntry {
  const cmd = command.split(' ')[0];
  
  return {
    ...createBaseEntry(crewId, 'process', `executed ${cmd}`, task),
    processExecution: {
      command,
      workingDir,
    },
  };
}

/**
 * Create a subagent spawn feed entry
 */
export function createSpawnEntry(
  crewId: string,
  task?: string
): FeedEntry {
  const taskSummary = task ? `: ${truncate(task, 60)}` : '';
  
  return {
    ...createBaseEntry(crewId, 'spawn', `spawned${taskSummary}`, task),
    status: 'running',
  };
}

/**
 * Create a task completion feed entry
 */
export function createCompleteEntry(
  crewId: string,
  status: 'success' | 'error',
  task?: string
): FeedEntry {
  const taskSummary = task ? `: ${truncate(task, 50)}` : '';
  
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    crewId,
    crewEmoji: status === 'success' ? '✅' : '❌',
    type: 'complete',
    content: status === 'success' ? `completed${taskSummary}` : `failed${taskSummary}`,
    task,
    status: status === 'success' ? 'success' : 'error',
  };
}

/**
 * Create a web search feed entry
 */
export function createSearchEntry(
  query: string,
  crewId: string = 'q',
  task?: string
): FeedEntry {
  return {
    ...createBaseEntry(crewId, 'search', `searched "${truncate(query, 40)}"`, task),
  };
}

/**
 * Create a message/chat feed entry
 */
export function createMessageEntry(
  content: string,
  crewId: string = 'q',
  task?: string
): FeedEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    crewId,
    crewEmoji: '💬',
    type: 'message',
    content: truncate(content, 120),
    task,
  };
}

/**
 * Create a cron job feed entry
 */
export function createCronEntry(
  eventName: string,
  crewId: string = 'q'
): FeedEntry {
  return {
    ...createBaseEntry(crewId, 'cron', `cron ${eventName}`),
  };
}

/**
 * Create an error feed entry
 */
export function createErrorEntry(
  error: string,
  crewId: string = 'q',
  task?: string
): FeedEntry {
  return {
    ...createBaseEntry(crewId, 'error', truncate(error, 100), task),
    status: 'error',
  };
}

/**
 * Create a system event feed entry
 */
export function createSystemEntry(
  content: string,
  crewId: string = 'q'
): FeedEntry {
  return {
    ...createBaseEntry(crewId, 'system', content),
  };
}

/**
 * Extract tool calls from message content
 * This is useful for parsing legacy or unstructured activity data
 */
export function extractToolCallsFromContent(content: string): Array<{ tool: string; params: Record<string, any> }> {
  const tools: Array<{ tool: string; params: Record<string, any> }> = [];
  
  // Match exec commands
  const execMatch = content.match(/executed?\s+(?:command\s+)?`?([^`\n]+)`?/i);
  if (execMatch) {
    tools.push({ tool: 'exec', params: { command: execMatch[1] } });
  }
  
  // Match file operations
  const fileMatch = content.match(/(read|wrote|edited)\s+(?:file\s+)?`?([^`\n]+)`?/i);
  if (fileMatch) {
    const operation = fileMatch[1] === 'wrote' ? 'write' : 
                      fileMatch[1] === 'edited' ? 'edit' : 'read';
    tools.push({ tool: operation, params: { file_path: fileMatch[2] } });
  }
  
  // Match web searches
  const searchMatch = content.match(/search(?:ed)?\s+(?:for\s+)?["']([^"']+)["']/i);
  if (searchMatch) {
    tools.push({ tool: 'web_search', params: { query: searchMatch[1] } });
  }
  
  return tools;
}

/**
 * Generate a group key for similar feed entries
 * Used for grouping consecutive similar events
 */
export function generateGroupKey(entry: FeedEntry): string {
  return `${entry.crewId}-${entry.type}-${entry.task || 'none'}`;
}

/**
 * Filter feed entries based on criteria
 */
export function filterFeedEntries(
  entries: FeedEntry[],
  filters: {
    types?: FeedEntryType[];
    crewIds?: string[];
    searchQuery?: string;
  }
): FeedEntry[] {
  return entries.filter(entry => {
    if (filters.types?.length && !filters.types.includes(entry.type)) {
      return false;
    }
    if (filters.crewIds?.length && !filters.crewIds.includes(entry.crewId)) {
      return false;
    }
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      return (
        entry.content.toLowerCase().includes(query) ||
        entry.task?.toLowerCase().includes(query) ||
        entry.crewId.toLowerCase().includes(query)
      );
    }
    return true;
  });
}

/**
 * Group consecutive entries from the same crew
 */
export function groupFeedEntries(entries: FeedEntry[]): FeedEntry[] {
  const grouped: FeedEntry[] = [];
  let lastCrewId: string | null = null;
  let groupCount = 0;
  
  for (const entry of entries) {
    if (entry.crewId === lastCrewId && entry.type === 'tool') {
      // Group tool invocations from same crew
      groupCount++;
      const lastEntry = grouped[grouped.length - 1];
      if (lastEntry && !lastEntry.isGrouped) {
        lastEntry.isGrouped = true;
        lastEntry.groupCount = 1;
      }
      if (lastEntry) {
        lastEntry.groupCount = (lastEntry.groupCount || 1) + 1;
      }
    } else {
      groupCount = 0;
      grouped.push({ ...entry });
    }
    lastCrewId = entry.crewId;
  }
  
  return grouped;
}

/**
 * Export feed entries as JSON
 */
export function exportFeedEntries(entries: FeedEntry[]): string {
  return JSON.stringify(entries, null, 2);
}
