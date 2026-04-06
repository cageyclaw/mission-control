import { create } from 'zustand';
import type { ChatConnectionStatus, ChatMessage, ChatSessionStatus } from '../api/types';
import { createNativeGatewayClient, type GatewayConnectionState, type GatewayEventFrame } from '../core/gatewayClient';
import { useSessionsStore } from './sessionsStore';
import { useToolStore } from './toolStore';

type ChatRole = ChatMessage['role'];

interface ChatStore {
  connectionStatus: ChatConnectionStatus;
  sessionStatus: ChatSessionStatus;
  sessionKey: string | null;

  // Persisted transcript entries (history + optimistic local user messages)
  transcript: ChatMessage[];
  // Active assistant stream state (kept separate from transcript)
  stream: {
    messageId: string;
    runId: string | null;
    text: string;
  } | null;

  // Typing indicator state
  isAwaitingResponse: boolean;

  // Compatibility surface for existing UI
  messages: ChatMessage[];
  streamingMessageId: string | null;

  historyLoadToken: number;

  pendingUserMessageId: string | null;
  activeRunId: string | null;
  activeIdempotencyKey: string | null;

  lastError: string | null;
  initialized: boolean;
  initializing: boolean;

  initialize: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
  sendMessage: (text: string) => Promise<boolean>;
  abortActiveRun: () => Promise<boolean>;
  loadHistoryForSession: (sessionKey: string, options?: { preserveOptimisticUser?: boolean }) => Promise<void>;
}

const gatewayClient = createNativeGatewayClient();
let wiringInitialized = false;
let sessionsSubscriptionUnsub: (() => void) | null = null;

function toChatConnectionStatus(state: GatewayConnectionState): ChatConnectionStatus {
  switch (state) {
    case 'connected':
      return 'connected';
    case 'connecting':
    case 'authenticating':
    case 'reconnecting':
      return 'connecting';
    case 'disconnected':
      return 'disconnected';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function textFromContent(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  const parts = content
    .map((part) => {
      const item = asRecord(part);
      if (!item) return null;
      if (item.type !== 'text') return null;
      return asString(item.text);
    })
    .filter((part): part is string => !!part);

  if (parts.length === 0) return null;
  return parts.join('');
}

function extractMessageText(raw: unknown): string {
  const item = asRecord(raw);
  if (!item) return '';
  return asString(item.text) ?? textFromContent(item.content) ?? '';
}

function normalizeRole(role: unknown): ChatRole {
  const value = asString(role)?.toLowerCase();
  if (value === 'assistant' || value === 'system') return value;
  return 'user';
}

function normalizeHistoryMessage(raw: unknown): ChatMessage | null {
  const item = asRecord(raw);
  if (!item) return null;

  const id = asString(item.id) ?? asString(item.messageId) ?? crypto.randomUUID();
  const createdAt = asNumber(item.createdAt) ?? asNumber(item.created_at) ?? Date.now();
  const text = extractMessageText(item);

  return {
    id,
    role: normalizeRole(item.role),
    text,
    status: 'complete',
    createdAt,
  };
}

function extractHistoryMessages(payload: unknown): ChatMessage[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeHistoryMessage).filter((msg): msg is ChatMessage => !!msg);
  }

  const root = asRecord(payload);
  if (!root) return [];

  const direct = root.messages;
  if (Array.isArray(direct)) {
    return direct.map(normalizeHistoryMessage).filter((msg): msg is ChatMessage => !!msg);
  }

  const nested = asRecord(root.history)?.messages;
  if (Array.isArray(nested)) {
    return nested.map(normalizeHistoryMessage).filter((msg): msg is ChatMessage => !!msg);
  }

  return [];
}

function mergeMessages(transcript: ChatMessage[], stream: ChatStore['stream']): ChatMessage[] {
  if (!stream) return transcript;
  return [
    ...transcript,
    {
      id: stream.messageId,
      role: 'assistant',
      text: stream.text,
      status: 'streaming',
      createdAt: Date.now(),
    },
  ];
}

function resolveEventSessionKey(frame: GatewayEventFrame): string | null {
  return asString(frame.sessionKey) ?? asString(asRecord(frame.payload)?.sessionKey);
}

function resolveRunId(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;

  const run = asRecord(payload.run);
  return asString(payload.runId) ?? asString(payload.id) ?? asString(run?.id);
}

function resolveState(payload: Record<string, unknown> | null): string | null {
  return asString(payload?.state)?.toLowerCase() ?? null;
}

function resolveDeltaText(payload: Record<string, unknown> | null): string {
  if (!payload) return '';

  const message = asRecord(payload.message);
  return asString(payload.delta) ?? asString(payload.text) ?? extractMessageText(message) ?? '';
}

export const useChatStore = create<ChatStore>((set, get) => ({
  connectionStatus: 'idle',
  sessionStatus: 'unknown',
  sessionKey: null,

  transcript: [],
  stream: null,

  messages: [],
  streamingMessageId: null,

  historyLoadToken: 0,

  pendingUserMessageId: null,
  activeRunId: null,
  activeIdempotencyKey: null,

  lastError: null,
  initialized: false,
  initializing: false,
  isAwaitingResponse: false,

  initialize: async () => {
    if (get().initialized || get().initializing) return;
    set({ initializing: true, lastError: null });

    if (!wiringInitialized) {
      gatewayClient.onState((nextState) => {
        set({ connectionStatus: toChatConnectionStatus(nextState) });
      });

      gatewayClient.onEvent('chat', (frame) => {
        const payload = asRecord(frame.payload);
        const eventSessionKey = resolveEventSessionKey(frame);
        const state = get();

        if (!state.sessionKey || !eventSessionKey || eventSessionKey !== state.sessionKey) {
          return;
        }

        const runId = resolveRunId(payload);
        const streamState = resolveState(payload);

        if (streamState === 'delta') {
          const delta = resolveDeltaText(payload);
          if (!delta) return;

          const currentStream = state.stream;
          const messageId = currentStream?.messageId ?? crypto.randomUUID();

          const nextStream = {
            messageId,
            runId: runId ?? currentStream?.runId ?? state.activeRunId,
            text: `${currentStream?.text ?? ''}${delta}`,
          };

          const nextMessages = mergeMessages(state.transcript, nextStream);
          set({
            stream: nextStream,
            messages: nextMessages,
            streamingMessageId: messageId,
            activeRunId: nextStream.runId ?? state.activeRunId,
            isAwaitingResponse: false,
            lastError: null,
          });
          return;
        }

        if (streamState === 'final') {
          const finalText = resolveDeltaText(payload);
          const currentStream = state.stream;
          const assistantId = currentStream?.messageId ?? crypto.randomUUID();
          const assistantText = finalText || currentStream?.text || '';

          const transcript = [
            ...state.transcript,
            {
              id: assistantId,
              role: 'assistant' as const,
              text: assistantText,
              status: 'complete' as const,
              createdAt: Date.now(),
            },
          ];

          set({
            transcript,
            stream: null,
            messages: transcript,
            streamingMessageId: null,
            activeRunId: null,
            activeIdempotencyKey: null,
            pendingUserMessageId: null,
            isAwaitingResponse: false,
            lastError: null,
          });

          void get().loadHistoryForSession(eventSessionKey, { preserveOptimisticUser: false }).catch(() => {
            // keep local transcript if reconciliation fails
          });
          return;
        }

        if (streamState === 'aborted') {
          const partial = state.stream?.text?.trim();
          const transcript = partial
            ? [
                ...state.transcript,
                {
                  id: state.stream?.messageId ?? crypto.randomUUID(),
                  role: 'assistant' as const,
                  text: state.stream?.text ?? '',
                  status: 'interrupted' as const,
                  createdAt: Date.now(),
                },
              ]
            : state.transcript;

          set({
            transcript,
            stream: null,
            messages: transcript,
            streamingMessageId: null,
            activeRunId: null,
            activeIdempotencyKey: null,
            pendingUserMessageId: null,
            isAwaitingResponse: false,
            lastError: 'Run aborted',
          });
          return;
        }

        if (streamState === 'error') {
          const err = asString(payload?.error) ?? asString(payload?.message) ?? 'Chat stream error';
          const partial = state.stream?.text?.trim();
          const transcript = partial
            ? [
                ...state.transcript,
                {
                  id: state.stream?.messageId ?? crypto.randomUUID(),
                  role: 'assistant' as const,
                  text: state.stream?.text ?? '',
                  status: 'error' as const,
                  createdAt: Date.now(),
                },
              ]
            : state.transcript;

          set({
            transcript,
            stream: null,
            messages: transcript,
            streamingMessageId: null,
            activeRunId: null,
            activeIdempotencyKey: null,
            pendingUserMessageId: null,
            isAwaitingResponse: false,
            lastError: err,
          });
        }
      });

      sessionsSubscriptionUnsub = useSessionsStore.subscribe((sessionsState) => {
        const nextSessionKey = sessionsState.selectedSessionKey ?? sessionsState.mainSessionKey ?? null;
        const currentSessionKey = get().sessionKey;
        if (nextSessionKey === currentSessionKey) return;

        set((state) => ({
          ...state,
          sessionKey: nextSessionKey,
          sessionStatus: nextSessionKey ? 'available' : 'missing',
          transcript: [],
          stream: null,
          messages: [],
          streamingMessageId: null,
          activeRunId: null,
          activeIdempotencyKey: null,
          pendingUserMessageId: null,
          isAwaitingResponse: false,
          historyLoadToken: state.historyLoadToken + 1,
          lastError: null,
        }));

        if (nextSessionKey) {
          void get().loadHistoryForSession(nextSessionKey).catch((error) => {
            set({ lastError: error instanceof Error ? error.message : 'Failed to load chat history' });
          });
        }
      });

      wiringInitialized = true;
    }

    const selectedSessionKey = useSessionsStore.getState().selectedSessionKey ?? useSessionsStore.getState().mainSessionKey ?? null;

    set({
      sessionKey: selectedSessionKey,
      sessionStatus: selectedSessionKey ? 'available' : 'missing',
      connectionStatus: toChatConnectionStatus(gatewayClient.connectionState),
    });

    try {
      await gatewayClient.connect();
      await useToolStore.getState().initialize();
      if (selectedSessionKey) {
        await get().loadHistoryForSession(selectedSessionKey);
      }
      set({ initialized: true, initializing: false, lastError: null });
    } catch (error) {
      set({
        initializing: false,
        lastError: error instanceof Error ? error.message : 'Failed to initialize chat store',
      });
      throw error;
    }
  },

  disconnect: () => {
    if (sessionsSubscriptionUnsub) {
      sessionsSubscriptionUnsub();
      sessionsSubscriptionUnsub = null;
    }

    useToolStore.getState().disconnect();
    gatewayClient.disconnect();

    set((state) => ({
      ...state,
      connectionStatus: 'disconnected',
      stream: null,
      messages: state.transcript,
      streamingMessageId: null,
      activeRunId: null,
      activeIdempotencyKey: null,
      pendingUserMessageId: null,
      initialized: false,
      initializing: false,
    }));

    wiringInitialized = false;
  },

  clearError: () => set({ lastError: null }),

  loadHistoryForSession: async (sessionKey, options) => {
    const token = get().historyLoadToken + 1;
    set({ historyLoadToken: token });

    const payload = await gatewayClient.chatHistory(sessionKey, 200);
    const history = extractHistoryMessages(payload);

    const latest = get();
    if (latest.sessionKey !== sessionKey || latest.historyLoadToken !== token) {
      return;
    }

    const preserveOptimisticUser = options?.preserveOptimisticUser ?? true;
    const optimistic = preserveOptimisticUser
      ? latest.transcript.filter((message) => message.role === 'user' && message.id === latest.pendingUserMessageId)
      : [];

    const transcript = [...history, ...optimistic];
    const stream = latest.stream;

    set({
      transcript,
      messages: mergeMessages(transcript, stream),
      lastError: null,
    });
  },

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const state = get();
    const sessionKey = state.sessionKey;

    if (!sessionKey || state.sessionStatus !== 'available') {
      set({ lastError: 'Cannot send: no active session selected' });
      return false;
    }

    if (state.connectionStatus !== 'connected') {
      set({ lastError: 'Cannot send: gateway not connected' });
      return false;
    }

    const userMessageId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const idempotencyKey = crypto.randomUUID();
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      text: trimmed,
      status: 'complete',
      createdAt: Date.now(),
    };

    const transcript = [...state.transcript, userMessage];

    set({
      transcript,
      messages: mergeMessages(transcript, state.stream),
      pendingUserMessageId: userMessageId,
      activeRunId: runId,
      activeIdempotencyKey: idempotencyKey,
      isAwaitingResponse: true,
      lastError: null,
    });

    try {
      // Note: runId is NOT sent to gateway - gateway generates its own
      await gatewayClient.chatSend(sessionKey, trimmed, {
        idempotencyKey,
        deliver: false,
      });
      return true;
    } catch (error) {
      set((current) => {
        const transcript = current.transcript.map((message) => (
          message.id === userMessageId
            ? { ...message, status: 'error' as const }
            : message
        ));

        return {
          transcript,
          messages: mergeMessages(transcript, current.stream),
          lastError: error instanceof Error ? error.message : 'Failed to send message',
          activeRunId: null,
          activeIdempotencyKey: null,
          pendingUserMessageId: null,
          isAwaitingResponse: false,
        };
      });
      return false;
    }
  },

  abortActiveRun: async () => {
    const { sessionKey, activeRunId } = get();
    if (!sessionKey) {
      set({ lastError: 'Cannot abort: no active session selected' });
      return false;
    }

    try {
      await gatewayClient.chatAbort(sessionKey, activeRunId ?? undefined);
      return true;
    } catch (error) {
      set({ lastError: error instanceof Error ? error.message : 'Failed to abort active run' });
      return false;
    }
  },
}));
