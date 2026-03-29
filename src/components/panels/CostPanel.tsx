import { useGatewayStore } from '../../stores/gateway';
import { formatTokens } from '../../utils/crew';

export default function CostPanel() {
  const { sessions } = useGatewayStore();

  const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokens, 0);
  const totalInput = sessions.reduce((sum, s) => sum + s.inputTokens, 0);
  const totalOutput = sessions.reduce((sum, s) => sum + s.outputTokens, 0);
  const totalCache = sessions.reduce((sum, s) => sum + s.cacheRead, 0);

  // Group by model
  const modelUsage = sessions.reduce((acc, s) => {
    const model = s.model.split('/').pop() || s.model;
    if (!acc[model]) acc[model] = 0;
    acc[model] += s.totalTokens;
    return acc;
  }, {} as Record<string, number>);

  const topModels = Object.entries(modelUsage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const maxTokens = topModels.length > 0 ? topModels[0][1] : 1;

  return (
    <div style={{ marginTop: 16, borderTop: '2px solid var(--occ-border)', paddingTop: 16 }}>
      {/* Section Header */}
      <div className="occ-section-header occ-section-header--purple" style={{ marginBottom: 12 }}>
        <span className="occ-section-header__number">47-36</span>
        <span style={{ marginLeft: 8 }}>TOKEN USAGE</span>
      </div>

      {/* Totals */}
      <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
        <span className="occ-status-row__number">47-37</span>
        <span className="occ-status-row__label">Total Tokens</span>
        <span className="occ-status-row__value" style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 600 }}>
          {formatTokens(totalTokens)}
        </span>
      </div>

      <div className="occ-status-row" style={{ borderBottom: '1px solid var(--occ-border)' }}>
        <span className="occ-status-row__number">47-38</span>
        <span className="occ-status-row__label">Active Sessions</span>
        <span className="occ-status-row__value" style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 600 }}>
          {sessions.length}
        </span>
      </div>

      {/* Breakdown */}
      <div style={{ padding: '12px 0', borderBottom: '1px solid var(--occ-border)' }}>
        <div className="occ-data" style={{ fontSize: 11, color: 'var(--occ-text-muted)' }}>
          IN: {formatTokens(totalInput)} · OUT: {formatTokens(totalOutput)} · CACHE: {formatTokens(totalCache)}
        </div>
      </div>

      {/* Per-model progress bars */}
      {topModels.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="occ-section-header occ-section-header--cyan" style={{ marginBottom: 8 }}>
            <span className="occ-section-header__number">47-3A</span>
            <span style={{ marginLeft: 8 }}>BY MODEL</span>
          </div>

          {topModels.map(([model, tokens], index) => {
            const percentage = Math.round((tokens / maxTokens) * 100);
            const colors = ['orange', 'purple', 'cyan'] as const;
            const color = colors[index % colors.length];
            
            return (
              <div key={model} className="occ-progress-bar">
                <div className="occ-progress-bar__header">
                  <span className="occ-progress-bar__label">{model}</span>
                  <span className="occ-progress-bar__number">{`47-${(59 + index).toString(36).toUpperCase()}`}</span>
                </div>
                <div className="occ-progress-bar__track">
                  <div
                    className={`occ-progress-bar__fill occ-progress-bar__fill--${color}`}
                    style={{ width: `${(tokens / maxTokens) * 100}%` }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: 'var(--occ-text-muted)' }}>
                    {formatTokens(tokens)}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--occ-text-dim)' }}>
                    {percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
