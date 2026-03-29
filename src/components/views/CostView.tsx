import { useGatewayStore } from '../../stores/gateway';
import { formatTokens } from '../../utils/crew';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function CostView() {
  const { sessions } = useGatewayStore();

  // Group tokens by model
  const modelData = sessions.reduce((acc, s) => {
    const model = s.model.split('/').pop() || s.model;
    if (!acc[model]) acc[model] = { name: model, tokens: 0, sessions: 0 };
    acc[model].tokens += s.totalTokens;
    acc[model].sessions += 1;
    return acc;
  }, {} as Record<string, { name: string; tokens: number; sessions: number }>);

  const chartData = Object.values(modelData).sort((a, b) => b.tokens - a.tokens);

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Sessions Card */}
        <div className="occ-panel occ-panel--orange">
          <div className="occ-status-row" style={{ borderBottom: 'none', padding: 0 }}>
            <span className="occ-status-row__number">47-40</span>
            <span className="occ-status-row__label">Sessions</span>
          </div>
          <div className="occ-data--large" style={{ marginTop: 8, color: 'var(--occ-orange)' }}>
            {sessions.length}
          </div>
          <div className="occ-data--label">Active</div>
        </div>

        {/* Total Tokens Card */}
        <div className="occ-panel occ-panel--purple">
          <div className="occ-status-row" style={{ borderBottom: 'none', padding: 0 }}>
            <span className="occ-status-row__number">47-41</span>
            <span className="occ-status-row__label">Tokens</span>
          </div>
          <div className="occ-data--large" style={{ marginTop: 8, color: 'var(--occ-purple)' }}>
            {formatTokens(sessions.reduce((sum, s) => sum + s.totalTokens, 0))}
          </div>
          <div className="occ-data--label">Total</div>
        </div>

        {/* Models Card */}
        <div className="occ-panel occ-panel--cyan">
          <div className="occ-status-row" style={{ borderBottom: 'none', padding: 0 }}>
            <span className="occ-status-row__number">47-42</span>
            <span className="occ-status-row__label">Models</span>
          </div>
          <div className="occ-data--large" style={{ marginTop: 8, color: 'var(--occ-cyan)' }}>
            {chartData.length}
          </div>
          <div className="occ-data--label">Unique</div>
        </div>
      </div>

      {/* Token Usage Chart */}
      <div className="occ-panel" style={{ marginBottom: 24 }}>
        <div className="occ-section-header occ-section-header--orange" style={{ marginBottom: 16 }}>
          <span className="occ-section-header__number">47-43</span>
          <span style={{ marginLeft: 8 }}>Token Usage By Model</span>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#a0a0a0', fontSize: 11, fontFamily: 'JetBrains Mono' }} 
                axisLine={{ stroke: '#1a1f2e' }}
                tickLine={{ stroke: '#1a1f2e' }}
              />
              <YAxis 
                tick={{ fill: '#a0a0a0', fontSize: 11, fontFamily: 'JetBrains Mono' }} 
                axisLine={{ stroke: '#1a1f2e' }}
                tickLine={{ stroke: '#1a1f2e' }}
              />
              <Tooltip
                contentStyle={{ 
                  background: '#0a0e1a', 
                  border: '1px solid #1a1f2e', 
                  borderRadius: 8,
                  fontFamily: 'JetBrains Mono',
                  fontSize: 12
                }}
                labelStyle={{ color: '#ff9900', fontFamily: 'Antonio' }}
                itemStyle={{ color: '#e8e8e8' }}
                formatter={(value) => value !== undefined ? formatTokens(value as number) : ''}
              />
              <Bar 
                dataKey="tokens" 
                fill="#ff9900" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: '#666', textAlign: 'center', padding: 60 }}>
            No session data available
          </div>
        )}
      </div>

      {/* Per-Session Breakdown */}
      <div className="occ-panel">
        <div className="occ-section-header occ-section-header--purple" style={{ marginBottom: 12 }}>
          <span className="occ-section-header__number">47-44</span>
          <span style={{ marginLeft: 8 }}>Per Session Breakdown</span>
        </div>

        {sessions.length > 0 ? (
          sessions.map((session, index) => (
            <div
              key={session.key}
              className="occ-status-row"
              style={{ 
                borderBottom: index < sessions.length - 1 ? '1px solid var(--occ-border)' : 'none'
              }}
            >
              <span className="occ-status-row__number">
                47-{45 + index}
              </span>
              <span className="occ-status-row__label" style={{ fontSize: 12 }}>
                {session.key.split(':').pop()?.toUpperCase()}
              </span>
              <span className="occ-status-row__value" style={{ fontSize: 11 }}>
                {session.percentUsed}% CTX
              </span>
              <span style={{ 
                fontFamily: 'JetBrains Mono', 
                fontSize: 12, 
                color: 'var(--occ-text)',
                marginRight: 8
              }}>
                {formatTokens(session.totalTokens)}
              </span>
              <span className={`status-dot ${session.age < 300000 ? 'status-dot--active' : 'status-dot--idle'}`} />
            </div>
          ))
        ) : (
          <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>
            No active sessions
          </div>
        )}
      </div>
    </div>
  );
}
