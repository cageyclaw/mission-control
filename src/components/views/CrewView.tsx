// CrewView component
import { useGatewayStore } from '../../stores/gateway';
import { getDisplayValues } from '../../utils/crew';
import CrewCard from '../crew/CrewCard';

/**
 * STORES USED:
 * - useGatewayStore: activeCrew (aggregated crew state for display)
 * - Source of truth for crew data: crewRegistryStore, sessionsStore
 */

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
