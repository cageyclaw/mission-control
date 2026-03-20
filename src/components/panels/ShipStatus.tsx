import { useGatewayStore } from '../../stores/gateway';
import { formatUptime, formatTokens } from '../../utils/crew';

export default function ShipStatus() {
  const { gatewayHealth, gatewayReady, memory, channels, security, sessions } = useGatewayStore();

  return (
    <div>
      {/* Section Header */}
      <div className="lcars-section-header lcars-section-header--cyan" style={{ marginBottom: 12 }}>
        <span className="lcars-section-header__number">47-31</span>
        <span style={{ marginLeft: 8 }}>SYSTEM STATUS</span>
      </div>

      {/* Gateway Status Row */}
      <div className="lcars-status-row">
        <span className="lcars-status-row__number">47-32</span>
        <span className="lcars-status-row__label">Gateway</span>
        <span className="lcars-status-row__value">
          {gatewayHealth?.ok ? '[ONLINE]' : '[OFFLINE]'}
        </span>
        <span className={`status-dot ${gatewayHealth?.ok ? 'status-dot--active' : 'status-dot--error'}`} />
      </div>

      {gatewayReady && (
        <div style={{ padding: '8px 0 12px 36px', borderBottom: '1px solid var(--lcars-border)' }}>
          <div className="lcars-data">
            ⏱ UPTIME: {formatUptime(gatewayReady.uptimeMs)}
          </div>
        </div>
      )}

      {/* Sessions Status Row */}
      <div className="lcars-status-row">
        <span className="lcars-status-row__number">47-33</span>
        <span className="lcars-status-row__label">Sessions</span>
        <span className="lcars-status-row__value">
          [{sessions.length} ACTIVE]
        </span>
        <span className="status-dot status-dot--active" />
      </div>

      {sessions.length > 0 && (
        <div style={{ padding: '8px 0 12px 36px', borderBottom: '1px solid var(--lcars-border)' }}>
          <div className="lcars-data">
            TOKENS: {formatTokens(sessions.reduce((sum, s) => sum + s.totalTokens, 0))}
          </div>
        </div>
      )}

      {/* Memory Status Row */}
      {memory && (
        <>
          <div className="lcars-status-row">
            <span className="lcars-status-row__number">47-34</span>
            <span className="lcars-status-row__label">Memory</span>
            <span className="lcars-status-row__value">[INDEXED]</span>
            <span className="status-dot status-dot--active" />
          </div>
          <div style={{ padding: '8px 0 12px 36px', borderBottom: '1px solid var(--lcars-border)' }}>
            <div className="lcars-data" style={{ fontSize: 11 }}>
              {memory.files} FILES · {memory.chunks} CHUNKS
            </div>
            <div className="lcars-data" style={{ fontSize: 11, marginTop: 4 }}>
              FTS: {memory.fts.available ? '✓' : '✗'} · VECTOR: {memory.vector.available ? '✓' : '✗'}
            </div>
            {memory.dirty && (
              <div style={{ fontSize: 11, color: 'var(--lcars-yellow)', marginTop: 4 }}>
                ⚠ NEEDS REINDEX
              </div>
            )}
          </div>
        </>
      )}

      {/* Channels Status Row */}
      {channels.length > 0 && (
        <>
          <div className="lcars-status-row">
            <span className="lcars-status-row__number">47-35</span>
            <span className="lcars-status-row__label">Channels</span>
            <span className="lcars-status-row__value">[{channels.length} ACTIVE]</span>
            <span className="status-dot status-dot--active" />
          </div>
          <div style={{ padding: '8px 0 12px 36px', borderBottom: '1px solid var(--lcars-border)' }}>
            {channels.map((ch, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--lcars-text-muted)', marginBottom: 2 }}>
                {ch.toUpperCase()}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Security Status Row */}
      {security && (
        <>
          <div className="lcars-status-row">
            <span className="lcars-status-row__number">47-36</span>
            <span className="lcars-status-row__label">Security</span>
            <span className="lcars-status-row__value">
              [{security.summary.critical > 0 ? 'ALERT' : 'NOMINAL'}]
            </span>
            <span className={`status-dot ${security.summary.critical > 0 ? 'status-dot--error' : 'status-dot--active'}`} />
          </div>
          <div style={{ padding: '8px 0 12px 36px', borderBottom: '1px solid var(--lcars-border)' }}>
            <div style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--lcars-red)' }}>CRIT: {security.summary.critical}</span>
              {' · '}
              <span style={{ color: 'var(--lcars-yellow)' }}>WARN: {security.summary.warn}</span>
              {' · '}
              <span style={{ color: 'var(--lcars-text-muted)' }}>INFO: {security.summary.info}</span>
            </div>
          </div>
        </>
      )}

      {/* Version Info */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--lcars-border)' }}>
        <div className="lcars-status-row">
          <span className="lcars-status-row__number">47-39</span>
          <span className="lcars-status-row__label">Version</span>
          <span className="lcars-status-row__value">[2026.3.13]</span>
          <span className="status-dot status-dot--active" />
        </div>
      </div>
    </div>
  );
}
