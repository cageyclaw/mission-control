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
const OCC_BLUE = '#2EB8FF';

export default function CrewCard({ crewMember }: CrewCardProps) {
  const { displayModel, displayContextPercent, displayStatus } = getDisplayValues(crewMember);
  const isOffline = displayStatus === 'offline';

  let statusColor = OCC_GRAY;
  if (displayStatus === 'active') statusColor = OCC_GREEN;
  if (displayStatus === 'idle' || displayStatus === 'timed-out') statusColor = OCC_YELLOW;
  if (displayStatus === 'error' || displayStatus === 'stopped') statusColor = OCC_RED;
  if (displayStatus === 'completed') statusColor = OCC_BLUE;
  if (displayStatus === 'offline') statusColor = OCC_GRAY;

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
    case 'completed':
      statusText = '[COMPLETED]';
      break;
    case 'timed-out':
      statusText = '[TIMED OUT]';
      break;
    case 'stopped':
      statusText = '[STOPPED]';
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
        borderLeft: `8px solid ${statusColor}`,
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
            {crewMember.fallbackActive ? ` • FALLBACK${crewMember.fallbackCount ? ` x${crewMember.fallbackCount}` : ''}` : ''}
          </div>
          {crewMember.requestedModel && crewMember.requestedModel !== crewMember.model && (
            <div style={{ fontSize: '10px', color: '#999999', fontFamily: '"JetBrains Mono", monospace' }}>
              REQUESTED: {crewMember.requestedModel.split('/').pop()?.toUpperCase() ?? crewMember.requestedModel.toUpperCase()}
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            color: statusColor
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
