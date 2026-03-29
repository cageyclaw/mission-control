import { useGatewayStore } from '../../stores/gateway';
import { formatUptime } from '../../utils/crew';

export default function SystemView() {
  const {
    gatewayHealth,
    gatewayReady,
    memory,
    security,
    channels,
    sessions,
  } = useGatewayStore();

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Sessions Panel */}
        <div className="occ-panel occ-panel--orange">
          <div className="occ-section-header occ-section-header--orange" style={{ marginBottom: 12 }}>
            <span className="occ-section-header__number">47-50</span>
            <span style={{ marginLeft: 8 }}>Sessions</span>
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
        </div>

        {/* Gateway Panel */}
        <div className="occ-panel occ-panel--cyan">
          <div className="occ-section-header occ-section-header--cyan" style={{ marginBottom: 12 }}>
            <span className="occ-section-header__number">47-60</span>
            <span style={{ marginLeft: 8 }}>Gateway</span>
          </div>

          <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
            <span className="occ-status-row__number">47-61</span>
            <span className="occ-status-row__label">Status</span>
            <span className="occ-status-row__value">
              {gatewayHealth?.ok ? '[RUNNING]' : '[OFFLINE]'}
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

        {/* Memory Panel */}
        {memory && (
          <div className="occ-panel occ-panel--purple">
            <div className="occ-section-header occ-section-header--purple" style={{ marginBottom: 12 }}>
              <span className="occ-section-header__number">47-70</span>
              <span style={{ marginLeft: 8 }}>Memory</span>
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

        {/* Channels Panel */}
        <div className="occ-panel">
          <div className="occ-section-header occ-section-header--cyan" style={{ marginBottom: 12 }}>
            <span className="occ-section-header__number">47-80</span>
            <span style={{ marginLeft: 8 }}>Channels</span>
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

        {/* Security Panel */}
        {security && (
          <div className="occ-panel occ-panel--orange">
            <div className="occ-section-header occ-section-header--orange" style={{ marginBottom: 12 }}>
              <span className="occ-section-header__number">47-90</span>
              <span style={{ marginLeft: 8 }}>Security</span>
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
    </div>
  );
}
