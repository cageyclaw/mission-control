/**
 * Host Metrics Store — Phase 6 Implementation
 *
 * Host OS metrics from the optional metrics sidecar.
 * This is COMPLETELY SEPARATE from gateway-native state.
 *
 * Data source: system-metrics-server/ sidecar (optional)
 * Polls: /api/system/metrics endpoint
 *
 * This store contains:
 *   - CPU usage percentage
 *   - Memory usage (used/total/percent)
 *   - Disk usage (used/total/percent)
 *   - System uptime
 *   - Load average
 *
 * IMPORTANT: These are HOST metrics, not gateway metrics.
 * Gateway health lives in systemStore.ts, not here.
 */

import { create } from 'zustand';
import { resolveMetricsUrl } from '../config';

export interface HostMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;      // MB
    total: number;     // MB
    percent: number;   // 0-100
  };
  disk: {
    used: number;      // GB
    total: number;     // GB
    percent: number;   // 0-100
  };
  timestamp: number;
}

interface HostMetricsStore {
  // State
  metrics: HostMetrics | null;
  lastUpdated: number | null;
  isLoading: boolean;
  error: string | null;

  // Configuration
  pollingEnabled: boolean;
  pollingIntervalMs: number;

  // Actions
  fetchMetrics: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
  setPollingEnabled: (enabled: boolean) => void;
  clearError: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchHostMetrics(): Promise<HostMetrics> {
  const response = await fetch(await resolveMetricsUrl('/api/system/metrics'));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

function normalizeMetrics(raw: unknown): HostMetrics | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const cpu = data.cpu as Record<string, unknown> | undefined;
  const memory = data.memory as Record<string, unknown> | undefined;
  const disk = data.disk as Record<string, unknown> | undefined;

  if (!cpu || !memory || !disk) return null;

  const numberValue = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0;

  return {
    cpu: {
      usage: numberValue(cpu.usage),
      loadAverage: Array.isArray(cpu.loadAverage)
        ? cpu.loadAverage.filter((n): n is number => typeof n === 'number')
        : [],
    },
    memory: {
      used: numberValue(memory.used),
      total: numberValue(memory.total),
      percent: numberValue(memory.percent),
    },
    disk: {
      used: numberValue(disk.used),
      total: numberValue(disk.total),
      percent: numberValue(disk.percent),
    },
    timestamp: numberValue(data.timestamp) || Date.now(),
  };
}

export const useHostMetricsStore = create<HostMetricsStore>((set, get) => ({
  metrics: null,
  lastUpdated: null,
  isLoading: false,
  error: null,

  pollingEnabled: true,
  pollingIntervalMs: 5000, // Default 5 second poll

  fetchMetrics: async () => {
    if (get().isLoading) return;

    set({ isLoading: true, error: null });

    try {
      const raw = await fetchHostMetrics();
      const metrics = normalizeMetrics(raw);

      if (!metrics) {
        throw new Error('Invalid metrics format from server');
      }

      set({
        metrics,
        lastUpdated: Date.now(),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch host metrics',
        // Keep existing metrics on error (stale data > no data)
      });
      throw error;
    }
  },

  startPolling: (intervalMs) => {
    if (pollTimer) {
      clearInterval(pollTimer);
    }

    const interval = intervalMs ?? get().pollingIntervalMs;
    set({ pollingIntervalMs: interval, pollingEnabled: true });

    // Initial fetch
    get().fetchMetrics().catch(() => {
      // Silent fail on initial poll
    });

    // Start polling
    pollTimer = setInterval(() => {
      if (get().pollingEnabled) {
        get().fetchMetrics().catch(() => {
          // Silent fail on polling - metrics are optional
        });
      }
    }, interval);
  },

  stopPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    set({ pollingEnabled: false });
  },

  setPollingEnabled: (enabled) => {
    set({ pollingEnabled: enabled });
    if (enabled && !pollTimer) {
      get().startPolling();
    } else if (!enabled && pollTimer) {
      get().stopPolling();
    }
  },

  clearError: () => set({ error: null }),
}));

// ============================================================================
// Selectors
// ============================================================================

export function selectCpuUsage(state: HostMetricsStore): number {
  return state.metrics?.cpu.usage ?? 0;
}

export function selectMemoryUsage(state: HostMetricsStore): { used: number; total: number; percent: number } {
  return state.metrics?.memory ?? { used: 0, total: 0, percent: 0 };
}

export function selectDiskUsage(state: HostMetricsStore): { used: number; total: number; percent: number } {
  return state.metrics?.disk ?? { used: 0, total: 0, percent: 0 };
}

// ============================================================================
// Data Source Documentation
// ============================================================================

/**
 * DATA SOURCE MAP:
 *
 * ┌─────────────────────┬─────────────────────────────┬─────────────────────────────┐
 * │ Data                │ Source                      │ Store                       │
 * ├─────────────────────┼─────────────────────────────┼─────────────────────────────┤
 * │ Host CPU Usage      │ system-metrics-server       │ hostMetricsStore.metrics    │
 * │ Host Memory Usage   │ system-metrics-server       │ hostMetricsStore.metrics    │
 * │ Host Disk Usage     │ system-metrics-server       │ hostMetricsStore.metrics    │
 * │ System Load Average │ system-metrics-server       │ hostMetricsStore.metrics    │
 * ├─────────────────────┼─────────────────────────────┼─────────────────────────────┤
 * │ Gateway Health      │ OpenClaw Gateway (WebSocket)│ systemStore.health          │
 * │ Gateway Ready       │ OpenClaw Gateway (events)   │ systemStore.ready           │
 * │ Connection State    │ WebSocket lifecycle         │ systemStore.connectionState │
 * └─────────────────────┴─────────────────────────────┴─────────────────────────────┘
 *
 * IMPORTANT DISTINCTION:
 *   - Host Metrics  = OS-level CPU/Memory/Disk (this store)
 *   - Gateway State = OpenClaw Gateway health/connection (systemStore.ts)
 *
 * The metrics sidecar is OPTIONAL and may not be running.
 * UI should gracefully degrade when metrics are unavailable.
 */
