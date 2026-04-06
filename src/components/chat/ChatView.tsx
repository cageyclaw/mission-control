import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ChatConnectionStatus } from '../../api/types';
import { useChatStore } from '../../stores/chat';
import { useToolStore } from '../../stores/toolStore';
import { useSessionsStore } from '../../stores/sessionsStore';
import ChatComposer from './ChatComposer';
import ChatStatusCard from './ChatStatusCard';
import ChatTranscript from './ChatTranscript';
import ToolActivityPanel from './ToolActivityPanel';

/**
 * STORES USED:
 * - useChatStore: chat transcript, session status, messages, streaming state
 * - useToolStore: tool runs for current session
 * - useSessionsStore: selected session key (for session switching)
 */

function isConnectionReady(status: ChatConnectionStatus): boolean {
  return status === 'connected';
}

export default function ChatView() {
  const connectionStatus = useChatStore((state) => state.connectionStatus);
  const sessionStatus = useChatStore((state) => state.sessionStatus);
  const sessionKey = useChatStore((state) => state.sessionKey);
  const messages = useChatStore((state) => state.messages);
  const isAwaitingResponse = useChatStore((state) => state.isAwaitingResponse);
  // useShallow prevents infinite loop from new array reference
  const toolRuns = useToolStore(
    useShallow((state) => state.getRunsForSession(sessionKey))
  );
  const streamingMessageId = useChatStore((state) => state.streamingMessageId);
  const lastError = useChatStore((state) => state.lastError);
  const sendMessage = useChatStore((state) => state.sendMessage);

  const selectedSessionKey = useSessionsStore((state) => state.selectedSessionKey);
  const mainSessionKey = useSessionsStore((state) => state.mainSessionKey);
  const sessionsByKey = useSessionsStore((state) => state.sessionsByKey);

  const activeSessionKey = selectedSessionKey ?? mainSessionKey ?? sessionKey;
  const activeSession = activeSessionKey ? sessionsByKey[activeSessionKey] : undefined;
  const activeSessionLabel = activeSession?.displayName || activeSession?.label || activeSessionKey || null;

  const connectionReady = isConnectionReady(connectionStatus);
  const hasSession = sessionStatus === 'available' && !!sessionKey;
  const composerDisabled = !connectionReady || !hasSession;

  const emptyState = useMemo(() => {
    if (!hasSession && !connectionReady) {
      return {
        title: 'Session + Gateway Unavailable',
        message: 'No active session is available and gateway chat transport is not healthy.',
        hint: 'Restore gateway connection, then start or reconnect an OpenClaw session.',
      };
    }

    if (!hasSession) {
      return {
        title: 'No Active Session',
        message: 'Chat requires an active session from the gateway.',
        hint: 'Start or reconnect an OpenClaw session, then retry.',
      };
    }

    if (!connectionReady) {
      return {
        title: 'Gateway Unavailable',
        message: 'Gateway chat connection is disconnected or degraded.',
        hint: 'Once the websocket reconnects, messaging will resume.',
      };
    }

    return {
      title: 'Channel Ready',
      message: 'Connected and waiting for your first message.',
      hint: 'Enter your prompt below to begin.',
    };
  }, [connectionReady, hasSession]);

  return (
    <section className="occ-chat-view">
      {streamingMessageId ? <span className="occ-chat-view__streaming-pill">Assistant streaming</span> : null}
      
      {isAwaitingResponse ? <span className="occ-chat-view__typing-indicator">Q is thinking...</span> : null}

      <ChatStatusCard
        connectionStatus={connectionStatus}
        sessionStatus={sessionStatus}
        sessionKey={sessionKey}
        lastError={lastError}
        showSessionSelector={true}
      />

      {activeSessionLabel ? (
        <div className="occ-chat-view__session-banner" role="status" aria-live="polite">
          Viewing session: <span>{activeSessionLabel}</span>
        </div>
      ) : null}

      <ToolActivityPanel toolRuns={toolRuns} />

      <div className="occ-chat-view__transcript-wrap">
        <ChatTranscript messages={messages} emptyState={messages.length === 0 ? emptyState : undefined} />
      </div>

      <ChatComposer disabled={composerDisabled} onSend={sendMessage} />
    </section>
  );
}
