import type { CrewMember } from '../api/types';

export const CREW_MEMBERS: CrewMember[] = [
  { id: 'q', name: 'Q', emoji: '🧠', role: 'Commander', status: 'offline' },
  { id: 'data', name: 'Data', emoji: '🔍', role: 'Research', status: 'offline' },
  { id: 'geordi', name: 'Geordi', emoji: '🔧', role: 'Code', status: 'offline' },
  { id: 'spark', name: 'Spark', emoji: '⚡', role: 'Quick Code', status: 'offline' },
  { id: 'riker', name: 'Riker', emoji: '🎯', role: 'QA/Review', status: 'offline' },
  { id: 'troi', name: 'Troi', emoji: '💝', role: 'Marketing', status: 'offline' },
  { id: 'barclay', name: 'Barclay', emoji: '🎨', role: 'Art/UX', status: 'offline' },
];

// Subagent tracking registry
export interface SubagentMapping {
  sessionId: string;
  crewId: string;
  spawnedAt: number;
  task?: string;
  status: 'spawning' | 'active' | 'completing' | 'completed';
}

// In-memory registry of subagent session UUIDs to crew members
// NOTE: This is the module-level registry that should be used for cross-cutting lookups
// The store also maintains a subagentMappings Map that is kept in sync via registerSubagent
const subagentRegistry = new Map<string, SubagentMapping>();

/**
 * Register a subagent session when it's spawned
 */
export function registerSubagent(
  sessionKey: string,
  crewId: string,
  task?: string
): SubagentMapping {
  const sessionId = sessionKey.split(':').pop() || sessionKey;
  const mapping: SubagentMapping = {
    sessionId,
    crewId,
    spawnedAt: Date.now(),
    task,
    status: 'spawning',
  };
  subagentRegistry.set(sessionId, mapping);
  
  // Also register with the Key UUID (the one from the session.key field)
  // OpenClaw uses TWO different UUIDs:
  // - Key UUID: agent:main:subagent:896a09e8-beb6-42b2-ac24-1d5793fe0c9d
  // - Session ID: 076df148-45fe-472b-a5a3-77fc7786e20b
  // We need to map both for proper detection
  const keyUuid = sessionKey.split(':').pop();
  if (keyUuid && keyUuid !== sessionId) {
    subagentRegistry.set(keyUuid, mapping);
  }
  
  console.log(`[Crew] Registered ${crewId} for session ${sessionId.substring(0, 8)}...`);
  return mapping;
}

/**
 * Register a subagent using BOTH UUIDs from OpenClaw status data
 * This ensures lookups work regardless of which UUID is used
 */
export function registerSubagentWithDualIds(
  keyUuid: string,  // from session.key (e.g., agent:main:subagent:896a09e8-...)
  sessionId: string, // from session.sessionId (e.g., 076df148-...)
  crewId: string,
  task?: string
): SubagentMapping {
  const mapping: SubagentMapping = {
    sessionId,
    crewId,
    spawnedAt: Date.now(),
    task,
    status: 'spawning',
  };
  
  // Register under both UUIDs for maximum compatibility
  subagentRegistry.set(sessionId, mapping);
  subagentRegistry.set(keyUuid, mapping);
  
  console.log(`[Crew] Registered ${crewId} under dual IDs: ${sessionId.substring(0, 8)} and ${keyUuid.substring(0, 8)}`);
  return mapping;
}

/**
 * Update subagent status
 */
export function updateSubagentStatus(
  sessionKey: string,
  status: SubagentMapping['status']
): void {
  const sessionId = sessionKey.split(':').pop() || sessionKey;
  const mapping = subagentRegistry.get(sessionId);
  if (mapping) {
    mapping.status = status;
    console.log(`[Crew] Updated ${mapping.crewId} status to ${status}`);
  }
}

/**
 * Get subagent mapping for a session
 */
export function getSubagentMapping(sessionKey: string): SubagentMapping | undefined {
  const sessionId = sessionKey.split(':').pop() || sessionKey;
  return subagentRegistry.get(sessionId);
}

/**
 * Get all subagent mappings as an array
 */
export function getAllSubagentMappings(): SubagentMapping[] {
  return Array.from(new Set(subagentRegistry.values()));
}

/**
 * Clear completed subagents from registry (call periodically to prevent bloat)
 */
export function cleanupCompletedSubagents(maxAgeMs: number = 3600000): void {
  const now = Date.now();
  const toDelete: string[] = [];
  
  subagentRegistry.forEach((mapping, key) => {
    if (mapping.status === 'completed' && (now - mapping.spawnedAt) > maxAgeMs) {
      toDelete.push(key);
    }
  });
  
  toDelete.forEach(key => subagentRegistry.delete(key));
  
  if (toDelete.length > 0) {
    console.log(`[Crew] Cleaned up ${toDelete.length / 2} completed subagent(s)`);
  }
}

/**
 * Infer crew ID from task description
 */
export function inferCrewFromTask(task?: string): string | null {
  if (!task) return null;

  const taskLower = task.toLowerCase();
  const patterns: [RegExp, string][] = [
    [/\b(research|investigate|find|search|analyze data|study)\b/i, 'data'],
    [/\b(code|implement|build|develop|fix bug|refactor|program)\b/i, 'geordi'],
    [/\b(quick|fast|simple|one-liner|rapid|short)\b/i, 'spark'],
    [/\b(review|audit|qa|check|verify|test|plan|assess)\b/i, 'riker'],
    [/\b(market|write|content|blog|social|copy|promote)\b/i, 'troi'],
    [/\b(art|design|ux|ui|paint|draw|sketch|image|visual)\b/i, 'barclay'],
  ];

  for (const [pattern, crewId] of patterns) {
    if (pattern.test(taskLower)) return crewId;
  }

  return null;
}

// Detect crew member from session key or sub-agent label
export function detectCrew(
  sessionKey: string,
  taskHint?: string,
  sessionId?: string // Optional: the session.sessionId from OpenClaw status
): CrewMember | null {
  const key = sessionKey.toLowerCase();

  // Main agent = Q (but not subagents)
  if ((key.includes(':main') && !key.includes('subagent')) || key.includes('telegram:') || key === 'main') {
    return CREW_MEMBERS[0]; // Q
  }

  // Extract Key UUID (last segment of session.key)
  const keyUuid = sessionKey.split(':').pop();

  // Check subagent registry using BOTH UUIDs:
  // 1. Key UUID from session.key (e.g., 896a09e8-beb6-42b2-ac24-1d5793fe0c9d)
  // 2. Session ID from session.sessionId (e.g., 076df148-45fe-472b-a5a3-77fc7786e20b)
  
  if (keyUuid) {
    // Try Key UUID first
    const keyMapping = subagentRegistry.get(keyUuid);
    if (keyMapping) {
      return CREW_MEMBERS.find(c => c.id === keyMapping.crewId) || null;
    }
  }

  if (sessionId) {
    // Try Session ID
    const sessionMapping = subagentRegistry.get(sessionId);
    if (sessionMapping) {
      return CREW_MEMBERS.find(c => c.id === sessionMapping.crewId) || null;
    }
  }

  // Try to infer from task hint if provided
  if (taskHint) {
    const inferredId = inferCrewFromTask(taskHint);
    if (inferredId) {
      // If we can infer, auto-register this session for future lookups
      if (keyUuid && sessionId) {
        registerSubagentWithDualIds(keyUuid, sessionId, inferredId, taskHint);
      } else if (keyUuid) {
        registerSubagent(keyUuid, inferredId, taskHint);
      }
      return CREW_MEMBERS.find(c => c.id === inferredId) || null;
    }
  }

  // Sub-agent with explicit labels in the session key (legacy)
  // This handles older systems where crew names are in the key
  if (key.includes('subagent')) {
    // Try to extract crew name from subagent key patterns
    const crewPatterns: [RegExp, string][] = [
      [/subagent:data:/i, 'data'],
      [/subagent:geordi:/i, 'geordi'],
      [/subagent:spark:/i, 'spark'],
      [/subagent:riker:/i, 'riker'],
      [/subagent:troi:/i, 'troi'],
      [/subagent:barclay:/i, 'barclay'],
    ];

    for (const [pattern, crewId] of crewPatterns) {
      if (pattern.test(key)) {
        // Auto-register for future lookups
        if (keyUuid && sessionId) {
          registerSubagentWithDualIds(keyUuid, sessionId, crewId, taskHint);
        } else if (keyUuid) {
          registerSubagent(keyUuid, crewId, taskHint);
        }
        return CREW_MEMBERS.find(c => c.id === crewId) || null;
      }
    }
  }

  // Unknown subagent - auto-register as 'unknown' so we can track it
  // This prevents the session from being completely invisible
  if (key.includes('subagent') && keyUuid) {
    const inferredFromTask = inferCrewFromTask(taskHint);
    const crewId = inferredFromTask || 'unknown';
    
    if (keyUuid && sessionId) {
      registerSubagentWithDualIds(keyUuid, sessionId, crewId, taskHint);
    } else if (keyUuid) {
      registerSubagent(keyUuid, crewId, taskHint);
    }
    
    // Return the crew member or unknown placeholder
    return CREW_MEMBERS.find(c => c.id === crewId) || 
           { id: 'unknown', name: 'Unknown Agent', emoji: '🤖', role: 'Agent', status: 'active' } as CrewMember;
  }

  return null;
}

// Get status indicator color
export function getStatusColor(status: CrewMember['status']): string {
  switch (status) {
    case 'active': return '#22c55e'; // green
    case 'idle': return '#eab308';   // yellow
    case 'error': return '#ef4444';  // red
    default: return '#6b7280';       // gray
  }
}

// Format uptime from milliseconds
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// Format relative time (e.g., "2m ago", "just now")
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString([], { 
    month: 'short', 
    day: 'numeric' 
  });
}

// Format token count
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// Generate stardate
export function stardate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = now.getHours();
  const minutes = now.getMinutes();
  return `${year}.${dayOfYear.toString().padStart(3, '0')}.${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;
}

// Get display values for crew member (current or last known)
export function getDisplayValues(crewMember: import('../api/types').CrewMember): {
  displayModel: string | undefined;
  displayContextPercent: number;
  displayStatus: import('../api/types').CrewMember['status'];
} {
  const currentModel = crewMember.model;
  const currentContextPercent = crewMember.contextPercent;

  // Use current values if available, otherwise fall back to last known
  const displayModel = currentModel ?? crewMember.lastKnownModel;
  // Use current context if defined (including 0), otherwise fall back to last known
  const displayContextPercent = currentContextPercent !== undefined 
    ? currentContextPercent 
    : (crewMember.lastKnownContextPercent ?? 0);

  return {
    displayModel,
    displayContextPercent,
    displayStatus: crewMember.status
  };
}
