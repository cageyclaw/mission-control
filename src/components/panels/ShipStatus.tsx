import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSessionsStore } from '../../stores/sessionsStore';
import { useHostMetricsStore } from '../../stores/hostMetricsStore';
import Gauge from '../ui/Gauge';

const OCC_ORANGE = '#FF9900';

/**
 * ShipStatus — Host System Metrics Panel
 *
 * Displays HOST METRICS (CPU, Memory, Disk) from the optional metrics sidecar.
 * These are NOT gateway metrics — they are OS-level system metrics.
 *
 * For gateway health/connection status, see SystemView.tsx
 */
export default function ShipStatus() {
  // Use sessionsStore for live session data (Phase 7)
  // useShallow prevents infinite loop from new array references
  const sessions = useSessionsStore(
    useShallow((state) => state.getSessions())
  );
  const { metrics: hostMetrics, startPolling, stopPolling } = useHostMetricsStore();

  // Poll host metrics via the dedicated store
  useEffect(() => {
    startPolling(5000);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const sessionContextPressure = useMemo(() => {
    if (sessions.length === 0) return 0;

    // Calculate average percentUsed across all sessions
    // (Each session's percentUsed is already calculated from totalTokens/contextTokens)
    const totalPercent = sessions.reduce((sum, session) => {
      return sum + (session.percentUsed ?? 0);
    }, 0);

    return Math.min(Math.round(totalPercent / sessions.length), 100);
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
          value={hostMetrics?.cpu?.usage ?? 0}
          label="CPU"
          refNumber="47-32"
          unit="%"
        />

        {/* Memory Gauge */}
        <Gauge
          value={hostMetrics?.memory?.percent ?? 0}
          label="MEMORY"
          refNumber="47-33"
          unit="%"
        />

        {/* Disk Gauge */}
        <Gauge
          value={hostMetrics?.disk?.percent ?? 0}
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
            {hostMetrics?.memory?.used ?? 0} MB
          </span>
          <span style={{ color: '#666666' }}> / </span>
          <span style={{ color: '#888888' }}>
            {hostMetrics?.memory?.total ?? 0} MB
          </span>
          <span style={{ color: '#666666', marginLeft: 8 }}>MEMORY</span>
        </div>

        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
          <span style={{ color: '#66CCFF' }}>
            {hostMetrics?.disk?.used ?? 0} GB
          </span>
          <span style={{ color: '#666666' }}> / </span>
          <span style={{ color: '#888888' }}>
            {hostMetrics?.disk?.total ?? 0} GB
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
