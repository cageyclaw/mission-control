// CrewView component
import { useGatewayStore } from '../../stores/gateway';
import { getDisplayValues } from '../../utils/crew';
import CrewCard from '../crew/CrewCard';

const LCARS_ORANGE = '#FF9900';

export default function CrewView() {
  const { activeCrew } = useGatewayStore();

  // Sort crew by context % (highest first), offline/error at bottom
  const sortedCrew = [...activeCrew].sort((a, b) => {
    const aDisplay = getDisplayValues(a);
    const bDisplay = getDisplayValues(b);

    // Offline/error agents go to bottom
    const aIsOffline =
      aDisplay.displayStatus === 'offline' || aDisplay.displayStatus === 'error';
    const bIsOffline =
      bDisplay.displayStatus === 'offline' || bDisplay.displayStatus === 'error';

    if (aIsOffline && !bIsOffline) return 1;
    if (!aIsOffline && bIsOffline) return -1;

    // Sort by context % descending
    return bDisplay.displayContextPercent - aDisplay.displayContextPercent;
  });

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '20px'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '24px',
          borderBottom: '2px solid rgba(255, 153, 0, 0.5)',
          paddingBottom: '12px'
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: LCARS_ORANGE,
            marginRight: '12px',
            fontFamily: '"Antonio", sans-serif'
          }}
        >
          47-60
        </span>
        <span
          style={{
            fontSize: '18px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: LCARS_ORANGE
          }}
        >
          Crew Context Monitor
        </span>
      </div>

      {/* Crew Cards */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '800px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        {sortedCrew.map((crewMember) => (
          <CrewCard key={crewMember.id} crewMember={crewMember} />
        ))}
      </div>

      {/* Empty state */}
      {sortedCrew.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#666666'
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
          <div
            style={{
              fontSize: '18px',
              textTransform: 'uppercase',
              letterSpacing: '2px'
            }}
          >
            No Crew Members Detected
          </div>
        </div>
      )}
    </div>
  );
}
