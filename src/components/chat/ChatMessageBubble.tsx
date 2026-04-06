import { useEffect, useState } from 'react';
import type { ChatMessage } from '../../api/types';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  shouldAnimateEntry?: boolean;
}

function getValidDate(createdAt: number): Date | null {
  if (!Number.isFinite(createdAt)) return null;
  const parsedDate = new Date(createdAt);
  return Number.isFinite(parsedDate.getTime()) ? parsedDate : null;
}

function formatTime(createdAt: number): string {
  const parsedDate = getValidDate(createdAt);
  if (!parsedDate) return '';
  return parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toIsoDateTime(createdAt: number): string {
  const parsedDate = getValidDate(createdAt);
  return parsedDate ? parsedDate.toISOString() : '';
}

function getStatusLabel(message: ChatMessage): string | null {
  if (message.role !== 'assistant') return null;
  if (message.status === 'streaming') return 'streaming';
  if (message.status === 'interrupted') return 'interrupted';
  if (message.status === 'error') return 'error';
  return null;
}

function getRoleLabel(role: ChatMessage['role']): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getTokenCount(message: ChatMessage): number | null {
  const raw = message as ChatMessage & {
    tokenCount?: unknown;
    tokens?: unknown;
    totalTokens?: unknown;
  };

  const candidate = raw.tokenCount ?? raw.tokens ?? raw.totalTokens;
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
}

export default function ChatMessageBubble({ message, shouldAnimateEntry = false }: ChatMessageBubbleProps) {
  const [isEntering, setIsEntering] = useState(shouldAnimateEntry);

  useEffect(() => {
    if (!shouldAnimateEntry) {
      setIsEntering(false);
      return;
    }

    setIsEntering(true);
    const timer = window.setTimeout(() => setIsEntering(false), 230);
    return () => window.clearTimeout(timer);
  }, [shouldAnimateEntry, message.id]);

  const roleLabel = getRoleLabel(message.role);
  const statusLabel = getStatusLabel(message);
  const formattedTime = formatTime(message.createdAt);
  const isoDateTime = toIsoDateTime(message.createdAt);
  const tokenCount = getTokenCount(message);
  const ariaTime = formattedTime || 'unknown time';
  const messageStatus = statusLabel ? `, status ${statusLabel}` : '';

  const bubbleStateClass = message.status ? `occ-chat-bubble--${message.status}` : '';

  return (
    <div
      className={`occ-chat-message occ-chat-message--${message.role}${isEntering ? ' is-entering' : ''}`}
      data-message-id={message.id}
    >
      <article
        className={`occ-chat-bubble occ-chat-bubble--${message.role} ${bubbleStateClass} occ-chat-bubble--status-${message.status ?? 'complete'}`}
        aria-label={`${roleLabel} message at ${ariaTime}${messageStatus}`}
        aria-roledescription="message"
      >
        <header className="occ-chat-bubble__header occ-chat-message__header">
          <span className="occ-chat-bubble__role occ-chat-message__role">{roleLabel}</span>
          <time className="occ-chat-bubble__time occ-chat-message__time" dateTime={isoDateTime || ''}>
            {formattedTime}
          </time>
        </header>

        <pre className="occ-chat-bubble__body occ-chat-bubble__text occ-chat-message__body">
          {message.text || (message.status === 'streaming' ? '…' : '')}
        </pre>

        <footer className="occ-chat-bubble__meta occ-chat-message__meta">
          {statusLabel ? (
            <span className={`occ-chat-bubble__status occ-chat-bubble__status--${message.status}`}>
              {statusLabel}
              {message.status === 'streaming' && <span className="occ-chat-bubble__cursor" aria-hidden="true" />}
            </span>
          ) : null}
          {tokenCount !== null ? <span className="occ-chat-message__tokens">{tokenCount} tokens</span> : null}
        </footer>
      </article>
    </div>
  );
}
