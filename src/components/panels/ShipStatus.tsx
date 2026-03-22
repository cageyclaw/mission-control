import { useEffect } from 'react';
import { useGatewayStore } from '../../stores/gateway';
import Gauge from '../ui/Gauge';

const LCARS_ORANGE = '#FF9900';

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

  // Calculate session load percentage (assume max 10 sessions = 100%)
  const sessionLoad = Math.min((sessions.length / 10) * 100, 100);

  return (
    <div>
      {/* Section Header */}
      <div 
        className="lcars-section-header lcars-section-header--cyan" 
        style={{ marginBottom: 16 }}
      >
        <span className="lcars-section-header__number">47-31</span>
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

        {/* Session Load Gauge */}
        <Gauge
          value={sessionLoad}
          label="SESSIONS"
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
          borderLeft: '4px solid ' + LCARS_ORANGE
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
        </div>
      </div>
    </div>
  );
}
