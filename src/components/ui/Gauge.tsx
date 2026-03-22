// Circular Gauge Component for LCARS Dashboard
// Displays percentage as a filled arc with color coding

interface GaugeProps {
  value: number; // 0-100
  label: string;
  refNumber: string;
  unit?: string;
}

const LCARS_ORANGE = '#FF9900';
const LCARS_GREEN = '#66CC99';
const LCARS_YELLOW = '#FFCC66';
const LCARS_RED = '#FF6666';

export default function Gauge({ value, label, refNumber, unit = '%' }: GaugeProps) {
  // Determine color based on value
  let color: string;
  if (value < 60) {
    color = LCARS_GREEN;
  } else if (value < 80) {
    color = LCARS_YELLOW;
  } else {
    color = LCARS_RED;
  }

  // Calculate arc
  const radius = 40;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px',
      background: 'rgba(0, 0, 0, 0.5)',
      borderRadius: '8px',
      position: 'relative',
      minWidth: '120px'
    }}>
      {/* Reference Number */}
      <div style={{
        position: 'absolute',
        top: '4px',
        left: '8px',
        fontSize: '10px',
        color: '#666666',
        fontFamily: '"Antonio", sans-serif'
      }}>
        {refNumber}
      </div>

      {/* SVG Gauge */}
      <svg
        height={radius * 2 + 20}
        width={radius * 2 + 20}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background circle */}
        <circle
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={normalizedRadius}
          cx={radius + 10}
          cy={radius + 10}
        />
        {/* Progress arc */}
        <circle
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference + ' ' + circumference}
          style={{
            strokeDashoffset,
            transition: 'stroke-dashoffset 0.3s ease'
          }}
          strokeLinecap="round"
          fill="transparent"
          r={normalizedRadius}
          cx={radius + 10}
          cy={radius + 10}
        />
      </svg>

      {/* Center value */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        marginTop: '8px'
      }}>
        <div style={{
          fontSize: '20px',
          fontWeight: 700,
          color: color,
          fontFamily: '"JetBrains Mono", monospace'
        }}>
          {Math.round(value)}
          <span style={{ fontSize: '12px' }}>{unit}</span>
        </div>
      </div>

      {/* Label */}
      <div style={{
        marginTop: '8px',
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: LCARS_ORANGE,
        fontFamily: '"Antonio", sans-serif'
      }}>
        {label}
      </div>
    </div>
  );
}
