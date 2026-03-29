import { useState } from 'react';

const OCC_RED = '#FF6666';

interface RedAlertButtonProps {
  onTrigger: () => void;
}

export default function RedAlertButton({ onTrigger }: RedAlertButtonProps) {
  const [confirming, setConfirming] = useState(false);

  const handleClick = () => {
    if (!confirming) {
      setConfirming(true);
      // Auto-reset confirmation after 3 seconds
      setTimeout(() => setConfirming(false), 3000);
    } else {
      onTrigger();
      setConfirming(false);
    }
  };

  return (
    <div style={{ marginTop: '16px' }}>
      <button
        onClick={handleClick}
        style={{
          width: '100%',
          padding: '16px',
          background: confirming ? '#FF3333' : OCC_RED,
          border: '2px solid #FF3333',
          borderRadius: '8px',
          color: '#000000',
          fontFamily: '"Antonio", sans-serif',
          fontSize: '16px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '3px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: confirming 
            ? '0 0 20px rgba(255, 51, 51, 0.8), inset 0 0 10px rgba(255, 255, 255, 0.3)' 
            : '0 4px 8px rgba(0, 0, 0, 0.3)',
          animation: confirming ? 'pulse 0.5s infinite' : 'none',
        }}
        onMouseEnter={(e) => {
          if (!confirming) {
            e.currentTarget.style.background = '#FF3333';
            e.currentTarget.style.transform = 'scale(1.02)';
          }
        }}
        onMouseLeave={(e) => {
          if (!confirming) {
            e.currentTarget.style.background = OCC_RED;
            e.currentTarget.style.transform = 'scale(1)';
          }
        }}
      >
        {confirming ? '⚠️ CONFIRM RED ALERT ⚠️' : '🔴 RED ALERT'}
      </button>
      
      {confirming && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: 'rgba(255, 51, 51, 0.2)',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#FF6666',
          textAlign: 'center',
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          Will end session, write memory, and restart gateway
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 20px rgba(255, 51, 51, 0.8); }
          50% { box-shadow: 0 0 40px rgba(255, 51, 51, 1); }
          100% { box-shadow: 0 0 20px rgba(255, 51, 51, 0.8); }
        }
      `}</style>
    </div>
  );
}
