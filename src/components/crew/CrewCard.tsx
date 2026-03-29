// CrewCard component - no React import needed
import type { CrewMember } from '../../api/types';
import { getDisplayValues } from '../../utils/crew';
import ContextBar from './ContextBar';

interface CrewCardProps {
  crewMember: CrewMember;
}

const OCC_ORANGE = '#FF9900';
const OCC_PURPLE = '#CC88CC';
const OCC_GREEN = '#66CC99';
const OCC_YELLOW = '#FFCC66';
const OCC_RED = '#FF6666';
const OCC_GRAY = '#888888';

export default function CrewCard({ crewMember }: CrewCardProps) {
  const { displayModel, displayContextPercent, displayStatus } = getDisplayValues(crewMember);
  const isOffline = displayStatus === 'offline' || displayStatus === 'error';

  // Determine risk color for the left border
  let riskColor: string;
  if (isOffline) {
    riskColor = OCC_GRAY;
  } else if (displayContextPercent > 85) {
    riskColor = OCC_RED;
  } else if (displayContextPercent >= 70) {
    riskColor = OCC_YELLOW;
  } else {
    riskColor = OCC_GREEN;
  }

  // Format model name
  const formattedModel = displayModel
    ? displayModel.split('/').pop()?.toUpperCase() ?? displayModel.toUpperCase()
    : 'UNKNOWN';

  // Status text
  let statusText: string;
  switch (displayStatus) {
    case 'active':
      statusText = '[ACTIVE]';
      break;
    case 'idle':
      statusText = '[IDLE]';
      break;
    case 'error':
      statusText = '[ERROR]';
      break;
    case 'offline':
    default:
      statusText = '[OFFLINE]';
      break;
  }

  // Reference number based on crew order
  const crewOrder = ['q', 'data', 'geordi', 'spark', 'riker', 'troi', 'barclay'];
  const refNumber = `47-0${crewOrder.indexOf(crewMember.id) + 1 || '??'}`;

  return (
    <div
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        borderLeft: `8px solid ${riskColor}`,
        borderRadius: '0 8px 8px 0',
        padding: '16px 20px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      {/* Top Row: Emoji, Name, Model, Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '24px' }}>{crewMember.emoji}</span>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: OCC_ORANGE
            }}
          >
            {crewMember.name}
          </div>

          <div
            style={{
              fontSize: '12px',
              color: OCC_PURPLE,
              fontFamily: '"JetBrains Mono", monospace'
            }}
          >
            {formattedModel}
          </div>
        </div>

        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            color: isOffline ? '#666666' : '#888888'
          }}
        >
          {statusText}
        </div>
      </div>

      {/* Context Bar */}
      <ContextBar contextPercent={displayContextPercent} isOffline={isOffline} />

      {/* Reference Number */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '16px',
          fontSize: '10px',
          color: '#666666',
          fontFamily: '"Antonio", sans-serif',
          letterSpacing: '1px'
        }}
      >
        {refNumber}
      </div>
    </div>
  );
}
