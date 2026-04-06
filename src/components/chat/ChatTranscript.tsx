import { useMemo, useEffect, useRef } from 'react';
import type { ChatMessage } from '../../api/types';
import ChatMessageBubble from './ChatMessageBubble';
import ChatEmptyState from './ChatEmptyState';

interface ChatTranscriptProps {
  messages: ChatMessage[];
  emptyState?: {
    title: string;
    message: string;
    hint?: string;
  };
}

const AUTO_SCROLL_THRESHOLD_PX = 80;

function isNearBottom(node: HTMLDivElement): boolean {
  const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
  return distanceToBottom <= AUTO_SCROLL_THRESHOLD_PX;
}

function getLiveStatusAnnouncement(messages: ChatMessage[]): string {
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  if (!latestAssistantMessage) return '';

  if (latestAssistantMessage.status === 'streaming') return 'Assistant is typing';
  if (latestAssistantMessage.status === 'error') return 'Message failed';
  if (latestAssistantMessage.status === 'interrupted') return 'Message interrupted';

  return '';
}

export default function ChatTranscript({ messages, emptyState }: ChatTranscriptProps) {
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const hasInitializedMessagesRef = useRef(false);
  const previousMessageIdsRef = useRef<Set<string>>(new Set());
  const animatedMessageIdsRef = useRef<Set<string>>(new Set());

  // Filter out system messages - they contain internal data that shouldn't be displayed
  const displayMessages = useMemo(() => messages.filter((message) => message.role !== 'system'), [messages]);

  const isStreaming = useMemo(() => messages.some((message) => message.status === 'streaming'), [messages]);
  const liveStatusAnnouncement = useMemo(() => getLiveStatusAnnouncement(messages), [messages]);

  const enteringMessageIds = useMemo(() => {
    if (!hasInitializedMessagesRef.current) return new Set<string>();

    const previousIds = previousMessageIdsRef.current;
    const animatedIds = animatedMessageIdsRef.current;
    const nextEnteringIds = new Set<string>();

    for (const message of displayMessages) {
      if (!previousIds.has(message.id) && !animatedIds.has(message.id)) {
        nextEnteringIds.add(message.id);
      }
    }

    return nextEnteringIds;
  }, [displayMessages]);

  useEffect(() => {
    const node = transcriptRef.current;
    if (!node || !shouldStickToBottomRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const currentIds = new Set(displayMessages.map((message) => message.id));

    if (!hasInitializedMessagesRef.current) {
      hasInitializedMessagesRef.current = true;
      previousMessageIdsRef.current = currentIds;
      for (const id of currentIds) {
        animatedMessageIdsRef.current.add(id);
      }
      return;
    }

    for (const id of enteringMessageIds) {
      animatedMessageIdsRef.current.add(id);
    }

    previousMessageIdsRef.current = currentIds;
  }, [messages, enteringMessageIds]);

  const handleScroll = () => {
    const node = transcriptRef.current;
    if (!node) return;
    shouldStickToBottomRef.current = isNearBottom(node);
  };

  return (
    <>
      <div
        ref={transcriptRef}
        className="occ-chat-transcript"
        role="log"
        tabIndex={0}
        aria-label="Chat transcript"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={isStreaming}
        onScroll={handleScroll}
      >
        {displayMessages.length === 0 && emptyState ? (
          <ChatEmptyState title={emptyState.title} message={emptyState.message} hint={emptyState.hint} />
        ) : (
          displayMessages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              shouldAnimateEntry={enteringMessageIds.has(message.id)}
            />
          ))
        )}
      </div>

      <div className="occ-visually-hidden" aria-live="polite" aria-atomic="true">
        {liveStatusAnnouncement}
      </div>
    </>
  );
}
