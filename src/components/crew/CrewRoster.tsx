import { useGatewayStore } from '../../stores/gateway';

const CREW_NUMBERS: Record<string, string> = {
  'q': '47-16',
  'data': '47-17',
  'geordi': '47-18',
  'spark': '47-19',
  'riker': '47-1A',
  'troi': '47-1B',
  'barclay': '47-1C',
};

export default function CrewRoster() {
  const { activeCrew, selectedCrewId, selectCrew } = useGatewayStore();

  // Add section header for crew
  const activeCount = activeCrew.filter(c => c.status === 'active').length;

  return (
    <div>
      {/* Section Header with count */}
      <div className="lcars-section-header lcars-section-header--orange">
        <span className="lcars-section-header__number">47-15</span>
        <span style={{ marginLeft: 8 }}>ACTIVE: {activeCount}</span>
      </div>

      {/* Crew List */}
      {activeCrew.map(member => (
        <div
          key={member.id}
          className={`lcars-list-item ${selectedCrewId === member.id ? 'lcars-list-item--selected' : ''}`}
          onClick={() => selectCrew(selectedCrewId === member.id ? null : member.id)}
        >
          {/* Reference Number */}
          <span className="lcars-list-item__number">{CREW_NUMBERS[member.id] || '47-XX'}</span>
          
          {/* Status Dot */}
          <span className={`status-dot status-dot--${member.status}`} />
          
          {/* Emoji */}
          <span className="lcars-list-item__emoji">{member.emoji}</span>
          
          {/* Info */}
          <div className="lcars-list-item__info">
            <div className="lcars-list-item__name">{member.name}</div>
            <div className="lcars-list-item__role">
              {member.currentTask
                ? member.currentTask.length > 30
                  ? `${member.currentTask.substring(0, 30)}...`
                  : member.currentTask
                : member.status === 'active' && member.contextPercent != null
                  ? `${member.role} · ${member.contextPercent}% CTX`
                  : member.role}
            </div>
          </div>
        </div>
      ))}

    </div>
  );
}
