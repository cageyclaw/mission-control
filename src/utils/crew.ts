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

// Detect crew member from session key or sub-agent label
export function detectCrew(sessionKey: string): CrewMember | null {
  const key = sessionKey.toLowerCase();

  // Main agent = Q
  if (key.includes(':main') || key.includes('telegram:') || key === 'main') {
    return CREW_MEMBERS[0]; // Q
  }

  // Sub-agent labels
  if (key.includes('data-')) return CREW_MEMBERS[1];
  if (key.includes('geordi-')) return CREW_MEMBERS[2];
  if (key.includes('spark-')) return CREW_MEMBERS[3];
  if (key.includes('riker-')) return CREW_MEMBERS[4];
  if (key.includes('troi-')) return CREW_MEMBERS[5];
  if (key.includes('barclay-')) return CREW_MEMBERS[6];

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
