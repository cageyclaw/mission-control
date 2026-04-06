import { useEffect } from 'react';
import { useGatewayStore } from '../../stores/gateway';
import { useSystemStore } from '../../stores/systemStore';
import { useHostMetricsStore } from '../../stores/hostMetricsStore';
import { useSessionsStore } from '../../stores/sessionsStore';
import { formatUptime } from '../../utils/crew';
import CostView from './CostView';

/**
 * SystemView — Gateway Status & Diagnostics
 *
 * Data Sources:
 *   - Gateway State: OpenClaw Gateway (WebSocket/events) → useSystemStore
 *   - Sessions/Memory/Security: OpenClaw Gateway (events) → useGatewayStore
 *   - Channels: OpenClaw Gateway (status RPC) → useSystemStore
 *   - Host Metrics: system-metrics-server sidecar (optional) → useHostMetricsStore
 *
 * Phase 6 Architecture:
 *   - systemStore    → Gateway connection health, ready state, channels
 *   - gatewayStore   → Sessions, memory, security (gateway-native)
 *   - hostMetricsStore → Host CPU/memory/disk (separate concern)
 */
export default function SystemView() {
  const {
    memory,
    security,
  } = useGatewayStore();

  const { getSessions } = useSessionsStore();
  const allSessions = getSessions();
  // Limit to most recent 10 sessions to avoid overwhelming the UI
  const sessions = allSessions.slice(0, 10);

  const {
    health: gatewayHealth,
    ready: gatewayReady,
    isConnected,
    channels,
    initialize: initializeSystem,
  } = useSystemStore();

  const {
    metrics: hostMetrics,
    startPolling: startMetricsPolling,
    stopPolling: stopMetricsPolling,
  } = useHostMetricsStore();

  // Initialize system store on mount
  useEffect(() => {
    initializeSystem().catch(() => {
      // Initialization errors handled by store
    });
  }, [initializeSystem]);

  // Poll host metrics (separate from gateway state)
  useEffect(() => {
    startMetricsPolling(5000);
    return () => stopMetricsPolling();
  }, [startMetricsPolling, stopMetricsPolling]);

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {/* Data Source Legend */}
      <div style={{
        display: 'flex',
        gap: 16,
        padding: '8px 12px',
        background: 'var(--occ-panel-light)',
        borderRadius: 6,
        fontSize: 11,
        color: 'var(--occ-text-muted)',
        border: '1px solid var(--occ-border)',
      }}>
        <span>
          <span style={{ color: 'var(--occ-cyan)' }}>●</span> Gateway State
        </span>
        <span>
          <span style={{ color: 'var(--occ-orange)' }}>●</span> Host Metrics
        </span>
        <span style={{ marginLeft: 'auto' }}>
          Last updated: {new Date().toLocaleTimeString()}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, minWidth: 0 }}>
        {/* Sessions Panel — Gateway Data */}
        <div className="occ-panel occ-panel--orange">
          <div className="occ-section-header occ-section-header--orange" style={{ marginBottom: 12 }}>
            <span className="occ-section-header__number">47-50</span>
            <span style={{ marginLeft: 8 }}>Sessions</span>
            <span style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: 'var(--occ-text-muted)',
              textTransform: 'uppercase',
            }}>
              Gateway
            </span>
          </div>

          {sessions.map((session, index) => (
            <div
              key={session.key}
              className="occ-status-row"
              style={{
                borderBottom: index < sessions.length - 1 ? '1px solid var(--occ-border)' : 'none'
              }}
            >
              <span className="occ-status-row__number">47-{51 + index}</span>
              <span className="occ-status-row__label" style={{ fontSize: 12 }}>
                {session.key?.split(':').pop()?.toUpperCase() ?? 'UNKNOWN'}
              </span>
              <span className="occ-status-row__value" style={{ fontSize: 10 }}>
                {session.model?.split('/').pop()?.toUpperCase() ?? 'UNKNOWN'}
              </span>
              <span style={{
                fontSize: 10,
                color: 'var(--occ-text-dim)',
                marginRight: 8
              }}>
                {session.percentUsed ?? 0}%
              </span>
              <span className={`status-dot ${(session.age ?? Infinity) < 300000 ? 'status-dot--active' : 'status-dot--idle'}`} />
            </div>
          ))}

          {(sessions?.length ?? 0) === 0 && (
            <div style={{ color: '#666', padding: 20, textAlign: 'center' }}>
              No active sessions
            </div>
          )}
          
          {allSessions.length > 10 && (
            <div style={{ color: '#888', padding: 12, textAlign: 'center', fontSize: 11, borderTop: '1px solid var(--occ-border)' }}>
              +{allSessions.length - 10} more sessions
            </div>
          )}
        </div>

        {/* Gateway Status Panel — Native Gateway State */}
        <div className="occ-panel occ-panel--cyan">
          <div className="occ-section-header occ-section-header--cyan" style={{ marginBottom: 12 }}>
            <span className="occ-section-header__number">47-60</span>
            <span style={{ marginLeft: 8 }}>Gateway Status</span>
            <span style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: 'var(--occ-text-muted)',
              textTransform: 'uppercase',
            }}>
              Gateway
            </span>
          </div>

          {/* Connection State */}
          <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
            <span className="occ-status-row__number">47-61</span>
            <span className="occ-status-row__label">Connection</span>
            <span className="occ-status-row__value">
              {isConnected ? '[CONNECTED]' : '[DISCONNECTED]'}
            </span>
            <span className={`status-dot ${isConnected ? 'status-dot--active' : 'status-dot--error'}`} />
          </div>

          {/* Health State */}
          <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
            <span className="occ-status-row__number">47-62</span>
            <span className="occ-status-row__label">Health</span>
            <span className="occ-status-row__value">
              {gatewayHealth?.ok ? '[HEALTHY]' : '[DEGRADED]'}
            </span>
            <span className={`status-dot ${gatewayHealth?.ok ? 'status-dot--active' : 'status-dot--error'}`} />
          </div>

          {gatewayReady && (
            <>
              <div style={{ padding: '12px 0' }}>
                <div className="occ-data" style={{ fontSize: 12, marginBottom: 4 }}>
                  Port: 18789 · Uptime: {formatUptime(gatewayReady.uptimeMs)}
                </div>
                <div className="occ-data" style={{ fontSize: 12, color: 'var(--occ-text-muted)' }}>
                  Mode: local · Bind: loopback
                </div>
              </div>

              {(gatewayReady?.failing?.length ?? 0) > 0 && (
                <div style={{
                  marginTop: 8,
                  padding: 8,
                  background: 'rgba(255, 51, 51, 0.1)',
                  borderRadius: 6,
                  borderLeft: '3px solid var(--occ-red)'
                }}>
                  <div style={{ fontSize: 11, color: 'var(--occ-red)', marginBottom: 4 }}>
                    FAILING SERVICES
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--occ-text)' }}>
                    {gatewayReady?.failing?.join(', ') ?? 'None'}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Host Metrics Panel — Separate Sidecar Data */}
        <div className="occ-panel occ-panel--orange">
          <div className="occ-section-header occ-section-header--orange" style={{ marginBottom: 12 }}>
            <span className="occ-section-header__number">47-65</span>
            <span style={{ marginLeft: 8 }}>Host Metrics</span>
            <span style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: 'var(--occ-text-muted)',
              textTransform: 'uppercase',
            }}>
              Sidecar
            </span>
          </div>

          <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
            <span className="occ-status-row__number">47-66</span>
            <span className="occ-status-row__label">CPU</span>
            <span className="occ-status-row__value">
              {hostMetrics?.cpu?.usage?.toFixed(1) ?? '--'}%
            </span>
            <span className={`status-dot ${(hostMetrics?.cpu?.usage ?? 0) > 80 ? 'status-dot--error' : 'status-dot--active'}`} />
          </div>

          <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
            <span className="occ-status-row__number">47-67</span>
            <span className="occ-status-row__label">Memory</span>
            <span className="occ-status-row__value">
              {hostMetrics?.memory?.percent?.toFixed(0) ?? '--'}%
            </span>
            <span className={`status-dot ${(hostMetrics?.memory?.percent ?? 0) > 80 ? 'status-dot--error' : 'status-dot--active'}`} />
          </div>

          <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
            <span className="occ-status-row__number">47-68</span>
            <span className="occ-status-row__label">Disk</span>
            <span className="occ-status-row__value">
              {hostMetrics?.disk?.percent?.toFixed(0) ?? '--'}%
            </span>
            <span className={`status-dot ${(hostMetrics?.disk?.percent ?? 0) > 90 ? 'status-dot--error' : 'status-dot--active'}`} />
          </div>

          {hostMetrics && (
            <div style={{ padding: '12px 0' }}>
              <div className="occ-data" style={{ fontSize: 11, marginBottom: 4 }}>
                {hostMetrics.memory.used} MB / {hostMetrics.memory.total} MB RAM
              </div>
              <div className="occ-data" style={{ fontSize: 11, color: 'var(--occ-text-muted)' }}>
                {hostMetrics.disk.used} GB / {hostMetrics.disk.total} GB Disk
              </div>
              {hostMetrics.cpu.loadAverage?.length > 0 && (
                <div className="occ-data" style={{ fontSize: 11, marginTop: 4 }}>
                  Load: {hostMetrics.cpu.loadAverage.slice(0, 3).join(', ')}
                </div>
              )}
            </div>
          )}

          {!hostMetrics && (
            <div style={{ color: '#666', padding: 12, textAlign: 'center', fontSize: 11 }}>
              Metrics sidecar unavailable
            </div>
          )}
        </div>

        {/* Memory Panel — Gateway RAG Memory */}
        {memory && (
          <div className="occ-panel occ-panel--purple">
            <div className="occ-section-header occ-section-header--purple" style={{ marginBottom: 12 }}>
              <span className="occ-section-header__number">47-70</span>
              <span style={{ marginLeft: 8 }}>RAG Memory</span>
              <span style={{
                marginLeft: 'auto',
                fontSize: 10,
                color: 'var(--occ-text-muted)',
                textTransform: 'uppercase',
              }}>
                Gateway
              </span>
            </div>

            <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
              <span className="occ-status-row__number">47-71</span>
              <span className="occ-status-row__label">Files</span>
              <span className="occ-status-row__value">{memory?.files ?? 0}</span>
              <span className="status-dot status-dot--active" />
            </div>

            <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
              <span className="occ-status-row__number">47-72</span>
              <span className="occ-status-row__label">Chunks</span>
              <span className="occ-status-row__value">{memory?.chunks ?? 0}</span>
              <span className="status-dot status-dot--active" />
            </div>

            <div style={{ padding: '12px 0' }}>
              <div className="occ-data" style={{ fontSize: 12, marginBottom: 4 }}>
                Provider: {memory?.provider ?? 'Unknown'}
              </div>
              <div className="occ-data" style={{ fontSize: 12, color: 'var(--occ-text-muted)', marginBottom: 4 }}>
                Model: {memory?.model ?? 'Unknown'}
              </div>
              <div className="occ-data" style={{ fontSize: 11 }}>
                FTS: {memory?.fts?.available ? '✓' : '✗'} · Vector: {memory?.vector?.available ? '✓' : '✗'} ({memory?.vector?.dims ?? 0}d)
              </div>
              <div className="occ-data" style={{ fontSize: 11, color: 'var(--occ-text-muted)', marginTop: 4 }}>
                Cache: {memory?.cache?.entries ?? 0} entries · Dirty: {memory?.dirty ? '⚠ Yes' : 'No'}
              </div>
            </div>
          </div>
        )}

        {/* Channels Panel — Gateway Data via status RPC */}
        <div className="occ-panel">
          <div className="occ-section-header occ-section-header--cyan" style={{ marginBottom: 12 }}>
            <span className="occ-section-header__number">47-80</span>
            <span style={{ marginLeft: 8 }}>Channels</span>
            <span style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: 'var(--occ-text-muted)',
              textTransform: 'uppercase',
            }}>
              Gateway
            </span>
          </div>

          {(channels?.length ?? 0) > 0 ? (
            channels.map((ch, i) => (
              <div
                key={i}
                className="occ-status-row"
                style={{
                  borderBottom: i < channels.length - 1 ? '1px solid var(--occ-border)' : 'none'
                }}
              >
                <span className="occ-status-row__number">47-{81 + i}</span>
                <span className="occ-status-row__label">{ch.toUpperCase()}</span>
                <span className="occ-status-row__value">[ACTIVE]</span>
                <span className="status-dot status-dot--active" />
              </div>
            ))
          ) : (
            <div style={{ color: '#666', padding: 20, textAlign: 'center' }}>
              No channel data
            </div>
          )}
        </div>

        {/* Security Panel — Gateway Data */}
        {security && (
          <div className="occ-panel occ-panel--orange">
            <div className="occ-section-header occ-section-header--orange" style={{ marginBottom: 12 }}>
              <span className="occ-section-header__number">47-90</span>
              <span style={{ marginLeft: 8 }}>Security</span>
              <span style={{
                marginLeft: 'auto',
                fontSize: 10,
                color: 'var(--occ-text-muted)',
                textTransform: 'uppercase',
              }}>
                Gateway
              </span>
            </div>

            <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
              <span className="occ-status-row__number">47-91</span>
              <span className="occ-status-row__label">Critical</span>
              <span className="occ-status-row__value" style={{ color: 'var(--occ-red)' }}>
                {security?.summary?.critical ?? 0}
              </span>
              <span className={`status-dot ${(security?.summary?.critical ?? 0) > 0 ? 'status-dot--error' : 'status-dot--active'}`} />
            </div>

            <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
              <span className="occ-status-row__number">47-92</span>
              <span className="occ-status-row__label">Warnings</span>
              <span className="occ-status-row__value" style={{ color: 'var(--occ-yellow)' }}>
                {security?.summary?.warn ?? 0}
              </span>
              <span className="status-dot status-dot--active" />
            </div>

            <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
              <span className="occ-status-row__number">47-93</span>
              <span className="occ-status-row__label">Info</span>
              <span className="occ-status-row__value">
                {security?.summary?.info ?? 0}
              </span>
              <span className="status-dot status-dot--active" />
            </div>
          </div>
        )}

        {/* Version Panel */}
        <div className="occ-panel">
          <div className="occ-section-header occ-section-header--purple" style={{ marginBottom: 12 }}>
            <span className="occ-section-header__number">47-A0</span>
            <span style={{ marginLeft: 8 }}>Version</span>
          </div>

          <div className="occ-status-row" style={{ borderBottom: 'none' }}>
            <span className="occ-status-row__number">47-A1</span>
            <span className="occ-status-row__label">Build</span>
            <span className="occ-status-row__value" style={{ fontFamily: 'JetBrains Mono' }}>
              2026.3.13
            </span>
            <span className="status-dot status-dot--active" />
          </div>

          <div style={{
            marginTop: 12,
            padding: 12,
            background: 'var(--occ-panel-light)',
            borderRadius: 8,
            border: '1px solid var(--occ-border)'
          }}>
            <div className="occ-data" style={{ fontSize: 12 }}>
              OCC Interface v47.1
            </div>
            <div className="occ-data" style={{ fontSize: 11, color: 'var(--occ-text-muted)', marginTop: 4 }}>
              OpenClaw Command Center interface
            </div>
          </div>
        </div>
      </div>

      <div className="occ-panel" style={{ padding: 12 }}>
        <div className="occ-section-header occ-section-header--orange" style={{ marginBottom: 12 }}>
          <span className="occ-section-header__number">47-B0</span>
          <span style={{ marginLeft: 8 }}>Usage & Cost Diagnostics</span>
        </div>
        <CostView />
      </div>
    </div>
  );
}
