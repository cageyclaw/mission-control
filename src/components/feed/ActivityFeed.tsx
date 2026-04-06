/**
 * Activity Feed Component — Phase 5 Implementation
 *
 * The activity feed is now a READ-ONLY VIEW of computed feed entries
 * from the activityFeedStore. It no longer drives session inference
 * or contains synthetic event generation.
 *
 * Feed entries are derived from:
 *   - sessionsStore: session lifecycle events
 *   - chatStore: chat messages
 *   - toolStore: tool activity runs
 */

import {
  useFilteredFeedEntries,
  useActiveTasks,
  useActivityFeedStore,
  type ComputedFeedEntry,
} from '../../stores/activityFeedStore';
import { useSessionsStore } from '../../stores/sessionsStore';
import { formatTimeAgo } from '../../utils/crew';
import type { FeedEntryType } from '../../api/types';

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

// Type colors for visual distinction (LCARS palette)
const TYPE_COLORS: Record<FeedEntryType, string> = {
  spawn: '#22c55e', // green
  complete: '#10b981', // emerald
  tool: '#f59e0b', // amber
  file: '#3b82f6', // blue
  process: '#8b5cf6', // violet
  search: '#06b6d4', // cyan
  message: '#6b7280', // gray
  cron: '#a855f7', // purple
  error: '#ef4444', // red
  system: '#6366f1', // indigo
};

// Get activity verb based on type
function getActivityVerb(type: FeedEntryType, entry: ComputedFeedEntry): string {
  switch (type) {
    case 'spawn':
      return 'spawned';
    case 'complete':
      return entry.status === 'error' ? 'failed' : 'completed';
    case 'tool':
      return entry.toolInvocation?.tool === 'web_search'
        ? 'searched'
        : entry.toolInvocation?.tool === 'web_fetch'
          ? 'fetched'
          : entry.toolInvocation?.tool === 'image'
            ? 'analyzed'
            : `invoked ${entry.toolInvocation?.tool || 'tool'}`;
    case 'file':
      return entry.fileOperation?.operation === 'read'
        ? 'read'
        : entry.fileOperation?.operation === 'write'
          ? 'wrote'
          : 'edited';
    case 'process':
      return 'executed';
    case 'search':
      return 'searched';
    case 'message':
      return entry.crewId === 'user' ? 'said' : 'replied';
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
  entry: ComputedFeedEntry;
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
      className={`occ-feed-entry ${isActive ? 'occ-feed-entry--active' : ''}`}
      style={{
        borderLeft: `3px solid ${typeColor}`,
        opacity: isActive ? 1 : 0.7,
      }}
    >
      <div
        className="occ-feed-entry__header"
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <span
          className="occ-feed-entry__crew"
          style={{
            fontSize: 18,
            filter: isActive ? 'none' : 'grayscale(30%)',
          }}
        >
          {entry.crewEmoji}
        </span>
        <span
          className="occ-feed-entry__crew-name"
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
          className="occ-feed-entry__verb"
          style={{
            fontSize: 11,
            color: 'var(--occ-text-dim)',
            fontStyle: 'italic',
          }}
        >
          {verb}
        </span>
        <span style={{ flex: 1 }} />
        <span
          className="occ-feed-entry__type-icon"
          style={{
            fontSize: 12,
            opacity: 0.7,
          }}
        >
          {typeIcon}
        </span>
        <span
          className="occ-feed-entry__timestamp"
          style={{
            fontSize: 11,
            color: 'var(--occ-text-dim)',
            fontFamily: 'var(--occ-font-mono)',
          }}
        >
          {timeAgo}
        </span>
      </div>

      <div className="occ-feed-entry__content" style={{ marginTop: 6, marginLeft: 0 }}>
        {entry.task && entry.type !== 'spawn' && entry.type !== 'complete' && (
          <div
            className="occ-feed-entry__task"
            style={{
              fontSize: 10,
              color: 'var(--occ-text-dim)',
              marginBottom: 4,
              fontStyle: 'italic',
              opacity: 0.8,
            }}
          >
            Task: {entry.task.substring(0, 80)}
            {entry.task.length > 80 ? '...' : ''}
          </div>
        )}

        <div
          className="occ-feed-entry__main-content"
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
            className="occ-feed-entry__details"
            style={{
              marginTop: 6,
              padding: '4px 8px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 4,
              fontSize: 10,
              fontFamily: 'var(--occ-font-mono)',
              color: 'var(--occ-text-dim)',
            }}
          >
            {typeof entry.toolInvocation.params?.file_path === 'string' && (
              <span>📄 {entry.toolInvocation.params.file_path.split('/').pop()}</span>
            )}
            {typeof entry.toolInvocation.params?.command === 'string' && (
              <span>⚙️ {entry.toolInvocation.params.command.split(' ').slice(0, 2).join(' ')}...</span>
            )}
            {typeof entry.toolInvocation.params?.query === 'string' && (
              <span>🔍 &quot;{entry.toolInvocation.params.query.substring(0, 40)}...&quot;</span>
            )}
          </div>
        )}

        {/* Progress indicator for running tasks */}
        {entry.status === 'running' && (
          <div
            className="occ-feed-entry__progress"
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
            className="occ-feed-entry__error"
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
  const activeTasks = useActiveTasks();
  const connected = useSessionsStore((state) => state.connected);

  if (activeTasks.length === 0) return null;

  return (
    <div
      className="occ-active-tasks"
      style={{
        marginBottom: 16,
        padding: 12,
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: 8,
      }}
    >
      <div
        className="occ-active-tasks__header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 14 }}>🔥</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 'bold',
            color: '#22c55e',
            textTransform: 'uppercase',
          }}
        >
          Active Tasks ({activeTasks.length})
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
            animation: connected ? 'pulse 2s ease-in-out infinite' : 'none',
          }}
        />
      </div>

      {activeTasks.map((task) => (
        <div
          key={`${task.crewId}-${task.startedAt}`}
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
            {task.task?.substring(0, 60) || 'Working...'}
            {task.task && task.task.length > 60 ? '...' : ''}
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
      <div
        style={{
          color: 'var(--occ-text-dim)',
          fontSize: 14,
          padding: '60px 20px',
          textAlign: 'center',
          border: '2px dashed var(--occ-border)',
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 16 }}>🔌</div>
        <div>Connecting to gateway...</div>
        <div style={{ fontSize: 12, color: 'var(--occ-text-dim)', marginTop: 8 }}>
          ws://127.0.0.1:18789
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        color: 'var(--occ-text-dim)',
        fontSize: 14,
        padding: '60px 20px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 16 }}>📡</div>
      <div>Gateway connected</div>
      <div style={{ fontSize: 12, color: 'var(--occ-text-dim)', marginTop: 8 }}>
        Waiting for crew activity...
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--occ-text-dim)',
          marginTop: 16,
          opacity: 0.7,
        }}
      >
        Activity feed will show:
        <br />
        🚀 Spawned tasks · ✅ Completed work
        <br />
        🛠️ Tool calls · 📄 File operations · ⚙️ Commands
      </div>
    </div>
  );
}

export default function ActivityFeed() {
  // Use the new Phase 5 computed feed entries
  const feed = useFilteredFeedEntries();
  const activeTasks = useActiveTasks();
  const connected = useSessionsStore((state) => state.connected);
  const filter = useActivityFeedStore((state) => state.filter);

  // Calculate active threshold (5 minutes ago)
  const latestTimestamp = feed[0]?.timestamp ?? 0;
  const activeThreshold = latestTimestamp - 300000;

  // Check if we have any content
  const hasContent = feed.length > 0 || activeTasks.length > 0;

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '0 8px' }}>
      {/* Active Tasks Panel */}
      <ActiveTasksPanel />

      {/* Section Header */}
      <div
        className="occ-section-header occ-section-header--purple"
        style={{
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span className="occ-section-header__number">47-25</span>
          <span style={{ marginLeft: 8 }}>SHIP&apos;S LOG</span>
        </div>
        <span
          style={{
            fontSize: 11,
            color: 'var(--occ-text-dim)',
            fontWeight: 'normal',
          }}
        >
          {feed.length} entries
          {filter.types?.length ? ` · ${filter.types.join(', ')}` : ''}
        </span>
      </div>

      {/* Feed Content */}
      {!hasContent ? (
        <EmptyState connected={connected} />
      ) : (
        <div className="occ-feed-container">
          {feed.map((entry) => (
            <ActivityItem
              key={entry.id}
              entry={entry}
              isActive={entry.timestamp > activeThreshold}
            />
          ))}

          {/* Group indicator */}
          {feed.some((e) => e.isGrouped) && (
            <div
              style={{
                textAlign: 'center',
                fontSize: 10,
                color: 'var(--occ-text-dim)',
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
      {feed.length === 0 && (
        <>
          <div
            className="occ-section-header occ-section-header--cyan"
            style={{ marginTop: 16, marginBottom: 12 }}
          >
            <span className="occ-section-header__number">47-26</span>
            <span style={{ marginLeft: 8 }}>SYSTEM</span>
          </div>
          <div className="occ-feed-entry">
            <div className="occ-feed-entry__header">
              <span className="occ-feed-entry__timestamp">SYS</span>
              <span className="occ-feed-entry__crew">🔧</span>
              <span className="occ-feed-entry__number">47-27</span>
            </div>
            <div className="occ-feed-entry__content">OCC Interface v47.2 — Online</div>
          </div>
        </>
      )}
    </div>
  );
}
