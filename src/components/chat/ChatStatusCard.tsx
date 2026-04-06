import type { ChatConnectionStatus, ChatSessionStatus } from '../../api/types';
import SessionSelector from './SessionSelector';

interface ChatStatusCardProps {
  connectionStatus: ChatConnectionStatus;
  sessionStatus: ChatSessionStatus;
  sessionKey: string | null;
  lastError: string | null;
  showSessionSelector?: boolean;
}

function formatConnectionLabel(status: ChatConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'degraded':
      return 'Degraded';
    case 'disconnected':
      return 'Disconnected';
    case 'error':
      return 'Error';
    default:
      return 'Idle';
  }
}

function formatSessionLabel(status: ChatSessionStatus): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'missing':
      return 'Missing';
    default:
      return 'Unknown';
  }
}

export default function ChatStatusCard({
  connectionStatus,
  sessionStatus,
  sessionKey,
  lastError,
  showSessionSelector = false,
}: ChatStatusCardProps) {
  const connected = connectionStatus === 'connected';

  return (
    <div className="occ-chat-status-card">
      <div className="occ-chat-status-card__row">
        <span className="occ-chat-status-card__label">Gateway</span>
        <span className={`occ-chat-status-card__value occ-chat-status-card__value--${connectionStatus}`}>
          {formatConnectionLabel(connectionStatus)}
        </span>
      </div>

      <div className="occ-chat-status-card__row">
        <span className="occ-chat-status-card__label">Session</span>
        <span className="occ-chat-status-card__value">{formatSessionLabel(sessionStatus)}</span>
      </div>

      <div className="occ-chat-status-card__row">
        <span className="occ-chat-status-card__label">Active Session</span>
        {showSessionSelector ? (
          <SessionSelector />
        ) : (
          <span className="occ-chat-status-card__value occ-chat-status-card__value--mono">
            {sessionKey ?? '—'}
          </span>
        )}
      </div>

      {lastError && (
        <div className="occ-chat-status-card__error" role="status" aria-live="polite">
          {lastError}
        </div>
      )}

      {!connected && !lastError && (
        <div className="occ-chat-status-card__hint">Chat is unavailable until the gateway reconnects.</div>
      )}
    </div>
  );
}
