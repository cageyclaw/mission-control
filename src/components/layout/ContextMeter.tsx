import { useMemo } from 'react';

interface ContextMeterProps {
  contextPercent: number;
  tokensUsed: number;
  tokensTotal: number;
  referenceNumber?: string;
}

export default function ContextMeter({
  contextPercent,
  tokensUsed,
  tokensTotal,
  referenceNumber = '47-95',
}: ContextMeterProps) {
  const tokensRemaining = tokensTotal - tokensUsed;
  
  const alertLevel = useMemo(() => {
    if (contextPercent >= 85) return 'red';
    if (contextPercent >= 75) return 'amber';
    return 'normal';
  }, [contextPercent]);

  const displayColor = useMemo(() => {
    switch (alertLevel) {
      case 'red':
        return 'var(--lcars-red)';
      case 'amber':
        return 'var(--lcars-yellow)';
      default:
        return 'var(--lcars-green)';
    }
  }, [alertLevel]);

  const fillHeight = Math.min(Math.max(contextPercent, 0), 100);
  
  const alertClass = alertLevel !== 'normal' 
    ? `context-meter__fill--${alertLevel}` 
    : '';

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  return (
    <div className="context-meter">
      <span className="context-meter__title">CONTEXT</span>
      
      <div className="context-meter__bar-container">
        <div
          className={`context-meter__fill ${alertClass}`}
          style={{
            height: `${fillHeight}%`,
            backgroundColor: displayColor,
          }}
        />
      </div>
      
      <span className="context-meter__percent">{contextPercent.toFixed(1)}%</span>
      <span className="context-meter__ref">{referenceNumber}</span>
      
      {/* Hover Tooltip */}
      <div className="context-meter__tooltip">
        <div className="context-meter__tooltip-title">Context Utilization</div>
        
        <div className="context-meter__tooltip-row">
          <span className="context-meter__tooltip-label">Used:</span>
          <span className="context-meter__tooltip-value">{formatNumber(tokensUsed)} tokens</span>
        </div>
        
        <div className="context-meter__tooltip-row">
          <span className="context-meter__tooltip-label">Remaining:</span>
          <span className="context-meter__tooltip-value context-meter__tooltip-value--highlight">
            {formatNumber(tokensRemaining)} tokens
          </span>
        </div>
        
        <hr className="context-meter__tooltip-divider" />
        
        <div className="context-meter__tooltip-row">
          <span className="context-meter__tooltip-label">Total:</span>
          <span className="context-meter__tooltip-value">{formatNumber(tokensTotal)} tokens</span>
        </div>
        
        <div className="context-meter__tooltip-bar">
          <div
            className="context-meter__tooltip-bar-fill"
            style={{
              width: `${contextPercent}%`,
              backgroundColor: displayColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}
