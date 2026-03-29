// ContextBar component - no React import needed

interface ContextBarProps {
  contextPercent: number;
  isOffline?: boolean;
}

const OCC_GREEN = '#66CC99';
const OCC_YELLOW = '#FFCC66';
const OCC_RED = '#FF6666';

export default function ContextBar({ contextPercent, isOffline = false }: ContextBarProps) {
  // Determine risk color
  let riskColor: string;
  if (isOffline) {
    riskColor = OCC_YELLOW;
  } else if (contextPercent > 85) {
    riskColor = OCC_RED;
  } else if (contextPercent >= 70) {
    riskColor = OCC_YELLOW;
  } else {
    riskColor = OCC_GREEN;
  }

  // Format percentage display
  const displayPercent = isOffline && contextPercent === 0 
    ? '--' 
    : `${Math.round(contextPercent)}%`;

  return (
    <div style={{ 
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      width: '100%'
    }}>
      {/* Context Bar Track */}
      <div style={{ 
        flex: 1,
        height: '24px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '0 4px 4px 0',
        border: `1px solid rgba(255, 255, 255, 0.2)`,
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Filled portion */}
        <div style={{
          height: '100%',
          width: `${Math.min(contextPercent, 100)}%`,
          background: riskColor,
          borderRadius: '0 4px 4px 0',
          transition: 'width 0.3s ease',
          opacity: isOffline ? 0.5 : 1
        }} />
      </div>

      {/* Percentage Text */}
      <div style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '14px',
        fontWeight: 600,
        color: isOffline ? '#888888' : '#66CCFF',
        minWidth: '45px',
        textAlign: 'right'
      }}>
        {displayPercent}
      </div>
    </div>
  );
}
