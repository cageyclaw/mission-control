import { useGatewayStore } from '../../stores/gateway';
import { formatTimeAgo } from '../../utils/crew';
import type { FeedEntry, FeedEntryType } from '../../api/types';

// Type icons mapping
const TYPE_ICONS: Record<FeedEntryType, string> = {
  spawn: '🚀',
  complete: '✅',
  tool: '🛠️',
  file: '📄',
  process: '⚙️',
  search: '🔍',
  message: '💬',
  cron: '⏰',
  error: '❌',
  system: '🔧',
};

// Type colors for visual distinction
const TYPE_COLORS: Record<FeedEntryType, string> = {
  spawn: '#22c55e',     // green
  complete: '#10b981',  // emerald
  tool: '#f59e0b',      // amber
  file: '#3b82f6',      // blue
  process: '#8b5cf6',   // violet
  search: '#06b6d4',    // cyan
  message: '#6b7280',   // gray
  cron: '#a855f7',      // purple
  error: '#ef4444',     // red
  system: '#6366f1',    // indigo
};

// Get activity verb based on type
function getActivityVerb(type: FeedEntryType, entry: FeedEntry): string {
  switch (type) {
    case 'spawn':
      return 'spawned';
    case 'complete':
      return entry.status === 'error' ? 'failed' : 'completed';
    case 'tool':
      return entry.toolInvocation?.tool === 'web_search' ? 'searched' :
             entry.toolInvocation?.tool === 'web_fetch' ? 'fetched' :
             entry.toolInvocation?.tool === 'image' ? 'analyzed' :
             `invoked ${entry.toolInvocation?.tool || 'tool'}`;
    case 'file':
      return entry.fileOperation?.operation === 'read' ? 'read' :
             entry.fileOperation?.operation === 'write' ? 'wrote' : 'edited';
    case 'process':
      return 'executed';
    case 'search':
      return 'searched';
    case 'message':
      return 'said';
    case 'cron':
      return 'ran';
    case 'error':
      return 'encountered error';
    case 'system':
      return 'system';
    default:
      return 'acted';
  }
}

interface ActivityItemProps {
  entry: FeedEntry;
  isActive: boolean;
}

function ActivityItem({ entry, isActive }: ActivityItemProps) {
  const typeIcon = TYPE_ICONS[entry.type];
  const typeColor = TYPE_COLORS[entry.type];
  const verb = getActivityVerb(entry.type, entry);
  const timeAgo = formatTimeAgo(entry.timestamp);
  
  // Determine the crew name and emoji
  const crewName = entry.crewId.charAt(0).toUpperCase() + entry.crewId.slice(1);
  
  return (
    <div
      className={`lcars-feed-entry ${isActive ? 'lcars-feed-entry--active' : ''}`}
      style={{
        borderLeft: `3px solid ${typeColor}`,
        opacity: isActive ? 1 : 0.7,
      }}
    >
      <div className="lcars-feed-entry__header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span 
          className="lcars-feed-entry__crew" 
          style={{ 
            fontSize: 18,
            filter: isActive ? 'none' : 'grayscale(30%)',
          }}
        >
          {entry.crewEmoji}
        </span>
        <span 
          className="lcars-feed-entry__crew-name"
          style={{
            fontSize: 12,
            fontWeight: 'bold',
            color: typeColor,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {crewName}
        </span>
        <span 
          className="lcars-feed-entry__verb"
          style={{
            fontSize: 11,
            color: 'var(--lcars-text-dim)',
            fontStyle: 'italic',
          }}
        >
          {verb}
        </span>
        <span style={{ flex: 1 }} />
        <span 
          className="lcars-feed-entry__type-icon"
          style={{
            fontSize: 12,
            opacity: 0.7,
          }}
        >
          {typeIcon}
        </span>
        <span 
          className="lcars-feed-entry__timestamp"
          style={{
            fontSize: 11,
            color: 'var(--lcars-text-dim)',
            fontFamily: 'var(--lcars-font-mono)',
          }}
        >
          {timeAgo}
        </span>
      </div>
      
      <div className="lcars-feed-entry__content" style={{ marginTop: 6, marginLeft: 0 }}>
        {entry.task && entry.type !== 'spawn' && entry.type !== 'complete' && (
          <div 
            className="lcars-feed-entry__task"
            style={{
              fontSize: 10,
              color: 'var(--lcars-text-dim)',
              marginBottom: 4,
              fontStyle: 'italic',
              opacity: 0.8,
            }}
          >
            Task: {entry.task.substring(0, 80)}{entry.task.length > 80 ? '...' : ''}
          </div>
        )}
        
        <div 
          className="lcars-feed-entry__main-content"
          style={{
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          {entry.content}
        </div>
        
        {/* Tool invocation details */}
        {entry.toolInvocation && entry.type === 'tool' && (
          <div 
            className="lcars-feed-entry__details"
            style={{
              marginTop: 6,
              padding: '4px 8px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 4,
              fontSize: 10,
              fontFamily: 'var(--lcars-font-mono)',
              color: 'var(--lcars-text-dim)',
            }}
          >
            {entry.toolInvocation.params?.file_path && (
              <span>📄 {entry.toolInvocation.params.file_path.split('/').pop()}</span>
            )}
            {entry.toolInvocation.params?.command && (
              <span>⚙️ {entry.toolInvocation.params.command.split(' ').slice(0, 2).join(' ')}...</span>
            )}
            {entry.toolInvocation.params?.query && (
              <span>🔍 "{entry.toolInvocation.params.query.substring(0, 40)}..."</span>
            )}
          </div>
        )}
        
        {/* Progress indicator for running tasks */}
        {entry.status === 'running' && (
          <div 
            className="lcars-feed-entry__progress"
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div 
              style={{
                flex: 1,
                height: 3,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div 
                style={{
                  width: `${entry.progress || 30}%`,
                  height: '100%',
                  background: typeColor,
                  borderRadius: 2,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            </div>
            <span style={{ fontSize: 10, color: typeColor }}>Running</span>
          </div>
        )}
        
        {/* Status indicator */}
        {entry.status === 'error' && (
          <div 
            className="lcars-feed-entry__error"
            style={{
              marginTop: 6,
              fontSize: 10,
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>⚠️</span>
            <span>Error occurred</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Active Tasks Panel
function ActiveTasksPanel() {
  const { activeTasks } = useGatewayStore();
  const tasks = Array.from(activeTasks.values());
  
  if (tasks.length === 0) return null;
  
  return (
    <div 
      className="lcars-active-tasks"
      style={{
        marginBottom: 16,
        padding: 12,
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: 8,
      }}
    >
      <div 
        className="lcars-active-tasks__header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 14 }}>🔥</span>
        <span style={{ 
          fontSize: 12, 
          fontWeight: 'bold',
          color: '#22c55e',
          textTransform: 'uppercase',
        }}>
          Active Tasks ({tasks.length})
        </span>
      </div>
      
      {tasks.map(task => (
        <div 
          key={task.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <span>{task.crewEmoji}</span>
          <span style={{ fontSize: 11, flex: 1 }}>
            {task.task?.substring(0, 60) || 'Working...'}{task.task && task.task.length > 60 ? '...' : ''}
          </span>
          <span 
            style={{ 
              fontSize: 10, 
              color: '#22c55e',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          >
            ●
          </span>
        </div>
      ))}
    </div>
  );
}

// Empty state component
function EmptyState({ connected }: { connected: boolean }) {
  if (!connected) {
    return (
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
    );
  }
  
  return (
    <div style={{
      color: 'var(--lcars-text-dim)',
      fontSize: 14,
      padding: '60px 20px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>📡</div>
      <div>Gateway connected</div>
      <div style={{ fontSize: 12, color: 'var(--lcars-text-dim)', marginTop: 8 }}>
        Waiting for crew activity...
      </div>
      <div style={{ 
        fontSize: 11, 
        color: 'var(--lcars-text-dim)', 
        marginTop: 16,
        opacity: 0.7,
      }}>
        Activity feed will show:<br/>
        🚀 Spawned tasks · ✅ Completed work<br/>
        🛠️ Tool calls · 📄 File operations · ⚙️ Commands
      </div>
    </div>
  );
}

export default function ActivityFeed() {
  const { feed, connected, activeTasks, feedFilter } = useGatewayStore();

  // Filter feed entries based on filter settings
  const filteredFeed = feed.filter(entry => {
    if (feedFilter.types?.length && !feedFilter.types.includes(entry.type)) {
      return false;
    }
    if (feedFilter.crewIds?.length && !feedFilter.crewIds.includes(entry.crewId)) {
      return false;
    }
    if (feedFilter.searchQuery) {
      const query = feedFilter.searchQuery.toLowerCase();
      return (
        entry.content.toLowerCase().includes(query) ||
        entry.task?.toLowerCase().includes(query) ||
        entry.crewId.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Group consecutive entries from same crew
  const groupedFeed: FeedEntry[] = [];
  let lastCrewId: string | null = null;
  let groupCount = 0;
  
  for (const entry of filteredFeed) {
    if (entry.crewId === lastCrewId && entry.type === 'tool') {
      // Group tool invocations from same crew
      groupCount++;
      const lastEntry = groupedFeed[groupedFeed.length - 1];
      if (lastEntry && !lastEntry.isGrouped) {
        lastEntry.isGrouped = true;
        lastEntry.groupCount = 1;
      }
      if (lastEntry) {
        lastEntry.groupCount = (lastEntry.groupCount || 1) + 1;
      }
    } else {
      groupCount = 0;
      groupedFeed.push({ ...entry });
    }
    lastCrewId = entry.crewId;
  }

  // Check if we have any content
  const hasContent = groupedFeed.length > 0 || Object.keys(activeTasks).length > 0;

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '0 8px' }}>
      {/* Active Tasks Panel */}
      <ActiveTasksPanel />
      
      {/* Section Header */}
      <div 
        className="lcars-section-header lcars-section-header--purple" 
        style={{ 
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span className="lcars-section-header__number">47-25</span>
          <span style={{ marginLeft: 8 }}>SHIP'S LOG</span>
        </div>
        <span 
          style={{ 
            fontSize: 11, 
            color: 'var(--lcars-text-dim)',
            fontWeight: 'normal',
          }}
        >
          {filteredFeed.length} entries
        </span>
      </div>

      {/* Feed Content */}
      {!hasContent ? (
        <EmptyState connected={connected} />
      ) : (
        <div className="lcars-feed-container">
          {groupedFeed.map((entry) => (
            <ActivityItem 
              key={entry.id} 
              entry={entry} 
              isActive={entry.timestamp > Date.now() - 300000}
            />
          ))}
          
          {/* Group indicator */}
          {groupedFeed.some(e => e.isGrouped) && (
            <div 
              style={{
                textAlign: 'center',
                fontSize: 10,
                color: 'var(--lcars-text-dim)',
                padding: '8px 0',
                opacity: 0.7,
              }}
            >
              Similar events grouped
            </div>
          )}
        </div>
      )}

      {/* System Messages Section - Only show when empty or at bottom */}
      {filteredFeed.length === 0 && (
        <div className="lcars-section-header lcars-section-header--cyan" style={{ marginTop: 16, marginBottom: 12 }}>
          <span className="lcars-section-header__number">47-26</span>
          <span style={{ marginLeft: 8 }}>SYSTEM</span>
        </div>
      )}

      {filteredFeed.length === 0 && (
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
      )}
    </div>
  );
}
