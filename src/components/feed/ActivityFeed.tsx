import { useGatewayStore } from '../../stores/gateway';
import { detectCrew, formatTokens } from '../../utils/crew';

interface ExtendedFeedItem {
  id: string;
  timestamp: number;
  crewEmoji: string;
  content: string;
  isActive: boolean;
  number: string;
}

export default function ActivityFeed() {
  const { feed, sessions, connected } = useGatewayStore();

  // Generate feed items from sessions when no live events
  const sessionFeed: ExtendedFeedItem[] = sessions.map((s, index) => {
    const crew = detectCrew(s.key);
    return {
      id: `session-${s.key}`,
      timestamp: Date.now() - s.age,
      crewEmoji: crew?.emoji ?? '🧠',
      content: `${s.key.split(':').pop()} · ${s.model.split('/').pop()} · ${s.percentUsed}% CTX · ${formatTokens(s.totalTokens)} TOK`,
      isActive: s.age < 300000,
      number: `47-${(23 + index).toString().padStart(2, '0')}`,
    };
  }).sort((a, b) => b.timestamp - a.timestamp);

  // Map feed entries to extended items
  const feedItems: ExtendedFeedItem[] = feed.map((item, index) => ({
    id: item.id,
    timestamp: item.timestamp,
    crewEmoji: item.crewEmoji,
    content: item.content,
    isActive: true,
    number: `47-${(40 + index).toString().padStart(2, '0')}`,
  }));

  const allItems = feed.length > 0 ? feedItems : sessionFeed;

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {!connected && allItems.length === 0 && (
        <div style={{
          color: 'var(--lcars-text-dim)',
          fontSize: 14,
          padding: '60px 20px',
          textAlign: 'center',
          border: '2px dashed var(--lcars-border)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔌</div>
          <div>Connecting to gateway...</div>
          <div style={{ fontSize: 12, color: 'var(--lcars-text-dim)', marginTop: 8 }}>
            ws://127.0.0.1:18789
          </div>
        </div>
      )}

      {connected && allItems.length === 0 && (
        <div style={{
          color: 'var(--lcars-text-dim)',
          fontSize: 14,
          padding: '60px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>📡</div>
          <div>Gateway connected</div>
          <div style={{ fontSize: 12, color: 'var(--lcars-text-dim)', marginTop: 8 }}>
            Waiting for activity...
          </div>
        </div>
      )}

      {/* Section Header */}
      <div className="lcars-section-header lcars-section-header--purple" style={{ marginBottom: 12 }}>
        <span className="lcars-section-header__number">47-25</span>
        <span style={{ marginLeft: 8 }}>LIVE FEED</span>
      </div>

      {allItems.map(item => (
        <div
          key={item.id}
          className={`lcars-feed-entry ${item.isActive ? 'lcars-feed-entry--active' : ''}`}
        >
          <div className="lcars-feed-entry__header">
            <span className="lcars-feed-entry__timestamp">
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="lcars-feed-entry__crew">{item.crewEmoji}</span>
            <span className="lcars-feed-entry__number">{item.number}</span>
          </div>
          <div className="lcars-feed-entry__content">{item.content}</div>
        </div>
      ))}

      {/* System Messages Section */}
      <div className="lcars-section-header lcars-section-header--cyan" style={{ marginTop: 16, marginBottom: 12 }}>
        <span className="lcars-section-header__number">47-26</span>
        <span style={{ marginLeft: 8 }}>SYSTEM MESSAGES</span>
      </div>

      <div className="lcars-feed-entry">
        <div className="lcars-feed-entry__header">
          <span className="lcars-feed-entry__timestamp">SYS</span>
          <span className="lcars-feed-entry__crew">🔧</span>
          <span className="lcars-feed-entry__number">47-27</span>
        </div>
        <div className="lcars-feed-entry__content">
          LCARS Interface v47.1 - Online
        </div>
      </div>

      <div className="lcars-feed-entry">
        <div className="lcars-feed-entry__header">
          <span className="lcars-feed-entry__timestamp">SYS</span>
          <span className="lcars-feed-entry__crew">✓</span>
          <span className="lcars-feed-entry__number">47-28</span>
        </div>
        <div className="lcars-feed-entry__content">
          All systems nominal
        </div>
      </div>
    </div>
  );
}
