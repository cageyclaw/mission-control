import { useEffect, useMemo } from 'react';
import { useGatewayStore } from '../../stores/gateway';
import Gauge from '../ui/Gauge';

const OCC_ORANGE = '#FF9900';

export default function ShipStatus() {
  const { sessions, systemMetrics, fetchSystemMetrics } = useGatewayStore();

  // Poll system metrics every 5 seconds
  useEffect(() => {
    fetchSystemMetrics();
    const interval = setInterval(() => {
      fetchSystemMetrics();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchSystemMetrics]);

  const sessionContextPressure = useMemo(() => {
    if (sessions.length === 0) return 0;

    const totals = sessions.reduce(
      (acc, session) => {
        const used = session.totalTokens ?? 0;
        const remaining = session.remainingTokens ?? 0;
        const capacity = used + remaining;

        if (capacity > 0) {
          acc.used += used;
          acc.capacity += capacity;
        } else if (typeof session.percentUsed === 'number') {
          acc.fallbackPercentSum += session.percentUsed;
          acc.fallbackCount += 1;
        }

        return acc;
      },
      { used: 0, capacity: 0, fallbackPercentSum: 0, fallbackCount: 0 }
    );

    if (totals.capacity > 0) {
      return Math.min((totals.used / totals.capacity) * 100, 100);
    }

    if (totals.fallbackCount > 0) {
      return Math.min(totals.fallbackPercentSum / totals.fallbackCount, 100);
    }

    return 0;
  }, [sessions]);

  const highContextSessions = useMemo(
    () => sessions.filter((session) => (session.percentUsed ?? 0) >= 80).length,
    [sessions]
  );

  return (
    <div>
      {/* Section Header */}
      <div 
        className="occ-section-header occ-section-header--cyan" 
        style={{ marginBottom: 16 }}
      >
        <span className="occ-section-header__number">47-31</span>
        <span style={{ marginLeft: 8 }}>SYSTEM GAUGES</span>
      </div>

      {/* Gauges Grid */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: 16
        }}
      >
        {/* CPU Gauge */}
        <Gauge
          value={systemMetrics?.cpu?.usage ?? 0}
          label="CPU"
          refNumber="47-32"
          unit="%"
        />

        {/* Memory Gauge */}
        <Gauge
          value={systemMetrics?.memory?.percent ?? 0}
          label="MEMORY"
          refNumber="47-33"
          unit="%"
        />

        {/* Disk Gauge */}
        <Gauge
          value={systemMetrics?.disk?.percent ?? 0}
          label="DISK"
          refNumber="47-34"
          unit="%"
        />

        {/* Session Context Pressure Gauge */}
        <Gauge
          value={sessionContextPressure}
          label="SESSION CTX"
          refNumber="47-35"
          unit="%"
        />
      </div>

      {/* Status Summary */}
      <div 
        style={{
          background: 'rgba(0, 0, 0, 0.5)',
          borderRadius: '8px',
          padding: '12px',
          borderLeft: '4px solid ' + OCC_ORANGE
        }}
      >
        <div style={{ 
          fontSize: '11px', 
          color: '#888888',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '8px'
        }}>
          47-36 · STATUS SUMMARY
        </div>
        
        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
          <span style={{ color: '#66CCFF' }}>
            {systemMetrics?.memory?.used ?? 0} MB
          </span>
          <span style={{ color: '#666666' }}> / </span>
          <span style={{ color: '#888888' }}>
            {systemMetrics?.memory?.total ?? 0} MB
          </span>
          <span style={{ color: '#666666', marginLeft: 8 }}>MEMORY</span>
        </div>
        
        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
          <span style={{ color: '#66CCFF' }}>
            {systemMetrics?.disk?.used ?? 0} GB
          </span>
          <span style={{ color: '#666666' }}> / </span>
          <span style={{ color: '#888888' }}>
            {systemMetrics?.disk?.total ?? 0} GB
          </span>
          <span style={{ color: '#666666', marginLeft: 8 }}>DISK</span>
        </div>
        
        <div style={{ fontSize: '12px' }}>
          <span style={{ color: '#66CCFF' }}>
            {sessions.length}
          </span>
          <span style={{ color: '#666666', marginLeft: 8 }}>ACTIVE SESSIONS</span>
          {highContextSessions > 0 && (
            <>
              <span style={{ color: '#666666', marginLeft: 12 }}>·</span>
              <span style={{ color: '#66CCFF', marginLeft: 12 }}>
                {highContextSessions}
              </span>
              <span style={{ color: '#666666', marginLeft: 8 }}>HIGH-CONTEXT</span>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
