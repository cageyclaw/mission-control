import { useGatewayStore } from '../../stores/gateway';
import { detectCrew, formatTokens } from '../../utils/crew';

export default function CrewDetail() {
  const { selectedCrewId, selectCrew, activeCrew, sessions } = useGatewayStore();

  if (!selectedCrewId) return null;

  const member = activeCrew.find(c => c.id === selectedCrewId);
  if (!member) return null;

  // Find sessions associated with this crew member
  const crewSessions = sessions.filter(s => {
    const crew = detectCrew(s.key);
    return crew?.id === selectedCrewId;
  });

  const primarySession = crewSessions[0];

  return (
    <div className={`occ-slide-panel ${selectedCrewId ? 'occ-slide-panel--open' : ''}`}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20,
        paddingBottom: 12,
        borderBottom: '2px solid var(--occ-orange)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 32 }}>{member.emoji}</span>
          <div>
            <div style={{ 
              fontSize: 18, 
              fontFamily: 'Antonio', 
              fontWeight: 700, 
              textTransform: 'uppercase',
              letterSpacing: 2,
              color: 'var(--occ-orange)'
            }}>
              {member.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--occ-text-muted)' }}>{member.role}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Antonio', fontSize: 11, color: 'var(--occ-text-dim)' }}>
            REF: 47-1{selectedCrewId.toUpperCase().charAt(0)}
          </div>
          <button
            onClick={() => selectCrew(null)}
            className="occ-action-button occ-action-button--orange"
            style={{ height: 32, width: 80, fontSize: 11, marginTop: 4 }}
          >
            CLOSE
          </button>
        </div>
      </div>

      {/* Status Panel */}
      <div className="occ-panel occ-panel--orange" style={{ marginBottom: 12 }}>
        <div style={{ 
          fontSize: 11, 
          fontFamily: 'Antonio', 
          color: 'var(--occ-orange)', 
          marginBottom: 8,
          letterSpacing: 2
        }}>
          STATUS
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span className={`status-dot status-dot--${member.status}`} />
          <span style={{ 
            fontSize: 14, 
            textTransform: 'uppercase', 
            fontFamily: 'Antonio',
            letterSpacing: 1
          }}>
            {member.status}
          </span>
        </div>
        {member.model && (
          <div style={{ fontSize: 12, color: 'var(--occ-text-muted)' }}>
            MODEL: {member.model.split('/').pop()?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Current Session Panel */}
      {primarySession && (
        <div className="occ-panel occ-panel--cyan" style={{ marginBottom: 12 }}>
          <div style={{ 
            fontSize: 11, 
            fontFamily: 'Antonio', 
            color: 'var(--occ-cyan)', 
            marginBottom: 8,
            letterSpacing: 2
          }}>
            CURRENT SESSION
          </div>
          <div style={{ 
            fontSize: 12, 
            color: 'var(--occ-text-muted)', 
            fontFamily: 'JetBrains Mono',
            marginBottom: 4 
          }}>
            {primarySession.key.split(':').slice(-2).join(':').toUpperCase()}
          </div>
          <div style={{ 
            fontSize: 12, 
            color: 'var(--occ-text-muted)',
            marginBottom: 4
          }}>
            MODEL: {primarySession.model.split('/').pop()?.toUpperCase()}
          </div>
          <div style={{ 
            fontSize: 11, 
            color: 'var(--occ-text-dim)', 
            marginTop: 8,
            display: 'flex',
            gap: 12
          }}>
            <span>TOK: {formatTokens(primarySession.totalTokens)}</span>
            <span>CTX: {primarySession.percentUsed}%</span>
          </div>

          {/* Context Gauge */}
          <div style={{ marginTop: 12 }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: 11, 
              color: 'var(--occ-text-muted)',
              marginBottom: 4
            }}>
              <span>CONTEXT USAGE</span>
              <span>{primarySession.percentUsed}%</span>
            </div>
            <div style={{ 
              height: 8, 
              background: 'var(--occ-border)', 
              borderRadius: 4,
              overflow: 'hidden'
            }}>
              <div
                style={{
                  height: '100%',
                  width: `${primarySession.percentUsed}%`,
                  background: primarySession.percentUsed > 80 
                    ? 'var(--occ-red)' 
                    : primarySession.percentUsed > 50 
                      ? 'var(--occ-orange)' 
                      : primarySession.percentUsed > 25 
                        ? 'var(--occ-yellow)' 
                        : 'var(--occ-green)',
                  borderRadius: 4,
                  transition: 'width 300ms ease'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* All Sessions Panel */}
      {crewSessions.length > 1 && (
        <div className="occ-panel" style={{ marginBottom: 12 }}>
          <div style={{ 
            fontSize: 11, 
            fontFamily: 'Antonio', 
            color: 'var(--occ-text-muted)', 
            marginBottom: 8,
            letterSpacing: 2
          }}>
            ALL SESSIONS ({crewSessions.length})
          </div>
          {crewSessions.map((s, index) => (
            <div key={s.key} style={{ 
              padding: '8px 0', 
              borderBottom: index < crewSessions.length - 1 ? '1px solid var(--occ-border)' : 'none'
            }}>
              <div style={{ 
                fontSize: 12, 
                fontFamily: 'JetBrains Mono',
                marginBottom: 2
              }}>
                {s.key.split(':').pop()?.toUpperCase()}
              </div>
              <div style={{ 
                fontSize: 11, 
                color: 'var(--occ-text-dim)',
                display: 'flex',
                gap: 12
              }}>
                <span>{s.percentUsed}% CTX</span>
                <span>{formatTokens(s.totalTokens)} TOK</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Data State */}
      {!primarySession && member.status === 'offline' && (
        <div className="occ-panel" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--occ-text-dim)' }}>
            No active sessions
          </div>
          <div style={{ fontSize: 11, color: 'var(--occ-text-muted)', marginTop: 4 }}>
            {member.name} is currently offline
          </div>
        </div>
      )}
    </div>
  );
}
