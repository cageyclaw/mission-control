/**
 * System Store — Phase 6 Implementation
 *
 * Gateway-native system and health state.
 * This store ONLY contains data that comes from the OpenClaw gateway:
 *   - Gateway connection state (from WebSocket lifecycle)
 *   - Gateway health (from `health` RPC)
 *   - Gateway ready state (from `ready` events/hello)
 *   - Gateway-provided system metrics (if any)
 *
 * HOST METRICS (CPU, Memory, Disk) are NOT in this store.
 * They come from a separate metrics sidecar and live in their own concern.
 *
 * Architecture:
 *   - gateway.ts        → UI connection state (connected/disconnecting/error)
 *   - systemStore.ts    → Gateway health/metrics from `health` endpoint
 *   - Metrics sidecar   → Host CPU/memory/disk (separate process, clear separation)
 */

import { create } from 'zustand';
import { createNativeGatewayClient, type GatewayConnectionState, type GatewayEventFrame } from '../core/gatewayClient';
import type { GatewayHealth, GatewayReady, StatusData } from '../api/types';

// Gateway-provided system metrics (if available from health endpoint)
interface GatewaySystemMetrics {
  timestamp: number;
  [key: string]: unknown;
}

interface SystemStore {
  // Initialization
  initialized: boolean;
  initializing: boolean;
  error: string | null;

  // Gateway Connection State (from WebSocket lifecycle)
  // This is the UI-facing connection state, distinct from health
  connectionState: GatewayConnectionState;
  isConnected: boolean;

  // Gateway Health (from health RPC)
  health: GatewayHealth | null;
  healthLastUpdated: number | null;

  // Gateway Ready State (from hello/ready events)
  ready: GatewayReady | null;
  readyLastUpdated: number | null;

  // Gateway Status (from status RPC)
  status: StatusData | null;
  statusLastUpdated: number | null;

  // Gateway-provided metrics (distinct from host metrics)
  gatewayMetrics: GatewaySystemMetrics | null;

  // Channels extracted from status
  channels: string[];

  // Actions
  initialize: () => Promise<void>;
  disconnect: () => void;
  refreshHealth: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  clearError: () => void;
}

const gatewayClient = createNativeGatewayClient();
let wiringInitialized = false;
let healthPollTimer: ReturnType<typeof setInterval> | null = null;

const HEALTH_POLL_INTERVAL_MS = 30000; // Poll health every 30s

function toHealthStatus(state: GatewayConnectionState): GatewayHealth['status'] {
  switch (state) {
    case 'connected':
      return 'healthy';
    case 'connecting':
    case 'authenticating':
    case 'reconnecting':
      return 'connecting';
    case 'disconnected':
      return 'disconnected';
    case 'error':
      return 'error';
    default:
      return 'unknown';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function normalizeHealth(payload: unknown): GatewayHealth | null {
  const data = asRecord(payload);
  if (!data) return null;

  const ok = typeof data.ok === 'boolean' ? data.ok : false;
  const status = typeof data.status === 'string' ? data.status : toHealthStatus(ok ? 'connected' : 'error');

  return { ok, status };
}

function normalizeReady(payload: unknown): GatewayReady | null {
  const data = asRecord(payload);
  if (!data) return null;

  const ready = typeof data.ready === 'boolean' ? data.ready : false;
  const uptimeMs = typeof data.uptimeMs === 'number' ? data.uptimeMs : 0;
  const failing = Array.isArray(data.failing) ? data.failing.filter((s): s is string => typeof s === 'string') : [];

  return { ready, uptimeMs, failing };
}

export const useSystemStore = create<SystemStore>((set, get) => ({
  initialized: false,
  initializing: false,
  error: null,

  connectionState: 'idle',
  isConnected: false,

  health: null,
  healthLastUpdated: null,

  ready: null,
  readyLastUpdated: null,

  status: null,
  statusLastUpdated: null,

  gatewayMetrics: null,

  channels: [],

  initialize: async () => {
    if (get().initialized || get().initializing) return;
    set({ initializing: true, error: null });

    if (!wiringInitialized) {
      // Subscribe to connection state changes
      gatewayClient.onState((state: GatewayConnectionState) => {
        const wasConnected = get().isConnected;
        const isConnected = state === 'connected';

        set({
          connectionState: state,
          isConnected,
          // Derive health from connection state when no explicit health check
          health: isConnected
            ? { ok: true, status: 'healthy' }
            : wasConnected
              ? { ok: false, status: toHealthStatus(state) }
              : get().health,
        });

        // On connect, refresh health and status explicitly
        if (isConnected && !wasConnected) {
          get().refreshHealth().catch(() => {
            // Health refresh failed but connection succeeded - still usable
          });
          get().refreshStatus().catch(() => {
            // Status refresh failed - not critical
          });
        }
      });

      // Listen for gateway events that might contain ready state
      gatewayClient.onEvent('*', (frame: GatewayEventFrame) => {
        if (frame.event === 'ready' || frame.event === 'gateway.ready') {
          const ready = normalizeReady(frame.payload);
          if (ready) {
            set({
              ready,
              readyLastUpdated: Date.now(),
            });
          }
        }
      });

      wiringInitialized = true;
    }

    // Ensure we're connected
    try {
      await gatewayClient.connect();

      // Initial health and status fetch
      await get().refreshHealth();
      await get().refreshStatus();

      // Start periodic health polling
      if (healthPollTimer) {
        clearInterval(healthPollTimer);
      }
      healthPollTimer = setInterval(() => {
        if (get().isConnected) {
          get().refreshHealth().catch(() => {
            // Silent fail - connection state is the primary indicator
          });
          get().refreshStatus().catch(() => {
            // Silent fail
          });
        }
      }, HEALTH_POLL_INTERVAL_MS);

      set({
        initialized: true,
        initializing: false,
        error: null,
      });
    } catch (error) {
      set({
        initializing: false,
        error: error instanceof Error ? error.message : 'Failed to initialize system store',
      });
      throw error;
    }
  },

  disconnect: () => {
    if (healthPollTimer) {
      clearInterval(healthPollTimer);
      healthPollTimer = null;
    }

    set({
      initialized: false,
      initializing: false,
      error: null,
      connectionState: 'disconnected',
      isConnected: false,
    });
  },

  refreshHealth: async () => {
    if (!get().isConnected) {
      set({
        health: { ok: false, status: 'disconnected' },
        healthLastUpdated: Date.now(),
      });
      return;
    }

    try {
      const payload = await gatewayClient.health();
      const health = normalizeHealth(payload);

      // Also try to extract ready state if present in health response
      const data = asRecord(payload);
      const ready = data?.ready ? normalizeReady(data.ready) : null;

      set({
        health,
        healthLastUpdated: Date.now(),
        ...(ready ? { ready, readyLastUpdated: Date.now() } : {}),
      });
    } catch (error) {
      // Health check failed but connection might still be alive
      set({
        health: { ok: false, status: 'degraded' },
        healthLastUpdated: Date.now(),
      });
      throw error;
    }
  },

  refreshStatus: async () => {
    if (!get().isConnected) {
      return;
    }

    try {
      const payload = await gatewayClient.status();
      const data = asRecord(payload);
      
      if (data) {
        const status = payload as StatusData;
        const channels = Array.isArray(status.channelSummary) ? status.channelSummary : [];
        
        set({
          status,
          statusLastUpdated: Date.now(),
          channels,
        });
      }
    } catch (error) {
      console.warn('[systemStore] Failed to refresh status:', error);
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

// ============================================================================
// Selectors
// ============================================================================

export function selectGatewayHealth(state: SystemStore): GatewayHealth | null {
  return state.health;
}

export function selectGatewayReady(state: SystemStore): GatewayReady | null {
  return state.ready;
}

export function selectIsGatewayHealthy(state: SystemStore): boolean {
  return state.health?.ok ?? false;
}

export function selectConnectionStatus(state: SystemStore): {
  state: GatewayConnectionState;
  isConnected: boolean;
  isHealthy: boolean;
} {
  return {
    state: state.connectionState,
    isConnected: state.isConnected,
    isHealthy: state.health?.ok ?? false,
  };
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
 * │ Connection State    │ WebSocket lifecycle         │ systemStore.connectionState │
 * │ Gateway Health      │ `health` RPC endpoint       │ systemStore.health          │
 * │ Gateway Ready       │ `hello` / `ready` events    │ systemStore.ready           │
 * ├─────────────────────┼─────────────────────────────┼─────────────────────────────┤
 * │ Host CPU/Memory/Disk│ Metrics sidecar (optional)  │ ShipStatus (hostMetrics)    │
 * │ (Not gateway data)  │ Separate polling            │ Separate concern            │
 * └─────────────────────┴─────────────────────────────┴─────────────────────────────┘
 *
 * NOTE: Host metrics come from a separate process (system-metrics-server/)
 * and are NOT part of gateway-native state. They are polled independently
 * and displayed in ShipStatus with clear "Host Metrics" labeling.
 */
