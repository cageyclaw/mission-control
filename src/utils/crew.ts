import type { CrewMember } from '../api/types';
import { getCrewMembersBase } from '../config/crewConfig';
import { useCrewRegistryStore } from '../stores/crewRegistryStore';

export { spawnCrew } from './spawnCrew';
export type { SpawnCrewOptions, SpawnCrewResult } from './spawnCrew';

export function getConfiguredCrewMembers(): CrewMember[] {
  return getCrewMembersBase();
}

// Backward-compatible export; prefer getConfiguredCrewMembers() for runtime freshness.
export const CREW_MEMBERS: CrewMember[] = getConfiguredCrewMembers();

export interface SubagentMapping {
  sessionId: string;
  crewId: string;
  spawnedAt: number;
  task?: string;
  status: 'spawning' | 'active' | 'completing' | 'completed';
}

// Compatibility helpers now route to explicit registry.
export function registerSubagent(sessionKey: string, crewId: string, task?: string): SubagentMapping {
  const sessionId = sessionKey.split(':').pop() || sessionKey;
  const spawnedAt = Date.now();
  const registry = useCrewRegistryStore.getState();
  registry.registerPendingSpawn({ crewId, sessionKey, task, spawnedAt });
  registry.confirmRegistration({ sessionId, sessionKey });

  return {
    sessionId,
    crewId,
    spawnedAt,
    task,
    status: 'spawning',
  };
}

export function registerSubagentWithDualIds(
  keyUuid: string,
  sessionId: string,
  crewId: string,
  task?: string
): SubagentMapping {
  const spawnedAt = Date.now();
  const registry = useCrewRegistryStore.getState();
  registry.registerPendingSpawn({ crewId, sessionKey: keyUuid, task, spawnedAt });
  registry.confirmRegistration({ sessionId, sessionKey: keyUuid });

  return {
    sessionId,
    crewId,
    spawnedAt,
    task,
    status: 'spawning',
  };
}

export function updateSubagentStatus(sessionKey: string, status: SubagentMapping['status']): void {
  const sessionId = sessionKey.split(':').pop() || sessionKey;
  const mappedStatus = status === 'completing'
    ? 'idle'
    : status === 'active'
      ? 'active'
      : status === 'completed'
        ? 'completed'
        : 'spawning';
  useCrewRegistryStore.getState().updateRegistration(sessionId, { status: mappedStatus });
}

export function getSubagentMapping(sessionKey: string): SubagentMapping | undefined {
  const sessionId = sessionKey.split(':').pop() || sessionKey;
  const reg = useCrewRegistryStore.getState().getRegistrationBySession(sessionId, sessionKey);
  if (!reg) return undefined;
  return {
    sessionId: reg.sessionId,
    crewId: reg.crewId,
    spawnedAt: reg.spawnedAt,
    task: reg.task,
    status: reg.status === 'completed' ? 'completed' : reg.status === 'idle' ? 'active' : 'spawning',
  };
}

export function getAllSubagentMappings(): SubagentMapping[] {
  return Object.values(useCrewRegistryStore.getState().bySessionId).map((reg) => ({
    sessionId: reg.sessionId,
    crewId: reg.crewId,
    spawnedAt: reg.spawnedAt,
    task: reg.task,
    status: reg.status === 'completed' ? 'completed' : reg.status === 'idle' ? 'active' : 'spawning',
  }));
}

export function cleanupCompletedSubagents(): void {
  // no-op for explicit registry (cleanup handled by lifecycle/status updates)
}

export function inferCrewFromTask(_task?: string): string | null {
  return null;
}

export function detectCrew(_sessionKey: string): CrewMember | null {
  return null;
}

export function getStatusColor(status: CrewMember['status']): string {
  switch (status) {
    case 'active': return '#22c55e';
    case 'idle':
    case 'timed-out': return '#eab308';
    case 'completed': return '#3b82f6';
    case 'stopped':
    case 'error': return '#ef4444';
    default: return '#6b7280';
  }
}

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

  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function stardate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return `${year}.${dayOfYear.toString().padStart(3, '0')}.${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
}

export function getDisplayValues(crewMember: CrewMember): {
  displayModel: string | undefined;
  displayContextPercent: number;
  displayStatus: CrewMember['status'];
} {
  const displayModel = crewMember.model ?? crewMember.lastKnownModel;
  const displayContextPercent = crewMember.contextPercent ?? crewMember.lastKnownContextPercent ?? 0;

  return { displayModel, displayContextPercent, displayStatus: crewMember.status };
}
