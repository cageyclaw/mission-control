# OCC Mission Control Backend Architecture
## Text Flowchart & Component Interaction

## 1. High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           OCC ELECTRON CLIENT                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   React UI   │  │   Zustand    │  │   Zustand    │  │   Zustand   │ │
│  │  Components  │  │  Sessions    │  │    Chat      │  │    Tool     │ │
│  │              │  │    Store     │  │   Store      │  │   Store     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                 │                 │        │
│         └─────────────────┴─────────────────┴─────────────────┘        │
│                                    │                                   │
│                         Native Gateway Client                         │
│                         (WebSocket Connection)                        │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │
                                     │ WebSocket (ws://127.0.0.1:18789)
                                     │
┌────────────────────────────────────┼───────────────────────────────────┐
│                     OPENCLAW GATEWAY (Port 18789)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Session    │  │    Chat      │  │    Agent     │  │   Health    │ │
│  │   Manager    │  │   Engine     │  │   Runtime    │  │   & System  │ │
│  │              │  │              │  │              │  │             │ │
│  │• sessions.   │  │• chat.send   │  │• agent spawn │  │• health RPC │ │
│  │  subscribe   │  │• chat.history│  │• tool exec   │  │• hello/ready│ │
│  │• sessions.   │  │• chat events │  │• agent events│  │• system info│ │
│  │  list        │  │  (delta/final)│  │              │  │             │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow: Gateway → UI

### 2.1 Session Data Flow
```
Gateway (sessions.changed events)
           │
           ▼
┌──────────────────────┐
│  NativeGatewayClient │
│  (Event Bus)         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   sessionsStore.ts   │
│  • Receives events    │
│  • Updates sessionsByKey│
│  • Emits state changes │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   OCC UI Components  │
│  (Reactive updates)   │
└──────────────────────┘
```

### 2.2 Chat Data Flow
```
User Types Message
        │
        ▼
┌───────────────┐    ┌───────────────┐
│  ChatComposer   │───▶│  chatStore.ts │
└───────────────┘    └───────┬───────┘
                             │
                             ▼
                    ┌───────────────┐
                    │ gatewayClient │
                    │  chat.send()  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │     Gateway     │
                    │   (processing)   │
                    └───────┬───────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌───────────────┐                    ┌───────────────┐
│  chat events   │                    │  tool events   │
│  (delta/final) │                    │  (from agent)  │
└───────┬───────┘                    └───────┬───────┘
        │                                   │
        ▼                                   ▼
┌───────────────┐                    ┌───────────────┐
│  chatStore.ts  │                    │  toolStore.ts  │
│  • Streaming    │                    │  • Tool runs   │
│  • Transcript   │                    │  • Updates     │
└───────────────┘                    └───────────────┘
```

---

## 3. Store Architecture & Relationships

### 3.1 Store Hierarchy
```
┌─────────────────────────────────────────┐
│         NativeGatewayClient            │
│    (Single WebSocket Connection)        │
└──────────┬──────────┬──────────┬────────┘
           │          │          │
     ┌─────▼─────┐ ┌──▼────┐ ┌──▼────┐
     │sessions   │ │ chat  │ │ tool  │
     │Store      │ │Store  │ │Store  │
     └─────┬─────┘ └───┬───┘ └───┬───┘
           │           │         │
           └───────────┼─────────┘
                       │
              ┌────────▼────────┐
              │ activityFeed    │
              │    Store        │
              │ (computed view) │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │   systemStore   │
              │ hostMetricsStore│
              └─────────────────┘
```

### 3.2 Store Responsibilities

| Store | Responsibility | Data Source | Emits To |
|-------|---------------|-------------|----------|
| **sessionsStore** | Session lifecycle, crew mapping | `sessions.changed` events | Crew display, chat context |
| **chatStore** | Messages, streaming, history | `chat` events (delta/final) | Chat UI, activity feed |
| **toolStore** | Tool activity tracking | `agent` tool stream events | Tool panels, activity feed |
| **activityFeedStore** | Combined feed projection | Computed from above stores | Feed UI |
| **systemStore** | Gateway health/connection | `health` RPC + WebSocket lifecycle | System panel |
| **hostMetricsStore** | Host OS metrics | Metrics sidecar HTTP | ShipStatus panel |

---

## 4. Event Flow & Subscriptions

### 4.1 Event Types & Handlers

```
Gateway Events:
┌─────────────────┬────────────────────────────────────────┐
│ Event           │ Handler                                │
├─────────────────┼────────────────────────────────────────┤
│ sessions.changed│ sessionsStore.handleSessionsChanged()  │
│ chat (delta)    │ chatStore.handleChatDelta()            │
│ chat (final)    │ chatStore.handleChatFinal()            │
│ chat (error)    │ chatStore.handleChatError()            │
│ agent (tool)    │ toolStore.consumeToolStreamEvent()     │
│ hello           │ systemStore.setReadyState()            │
│ ready           │ systemStore.setReadyState()            │
└─────────────────┴────────────────────────────────────────┘
```

### 4.2 Subscription Pattern
```typescript
// Example: chatStore subscription to gateway events
class NativeGatewayClient {
  private eventHandlers: Map<string, Set<Function>> = new Map();
  
  subscribeToEvents() {
    // Called after WebSocket connection established
    this.send({ method: 'chat.subscribe', params: {} });
    this.send({ method: 'agent.subscribe', params: {} });
    this.send({ method: 'sessions.subscribe', params: {} });
  }
  
  onEvent(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    
    // Return unsubscribe function
    return () => this.eventHandlers.get(event)?.delete(handler);
  }
  
  dispatchEvent(event: string, frame: GatewayEventFrame) {
    this.eventHandlers.get(event)?.forEach(handler => {
      try { handler(frame); } catch (e) { console.error(e); }
    });
  }
}
```

---

## 5. Component Hierarchy

### 5.1 Main Component Tree
```
App.tsx
├── Layout (Header, Navigation)
│   └── SettingsDialog
├── Views (Router-based)
│   ├── DashboardView
│   │   ├── SystemPanel
│   │   ├── CrewPanel
│   │   └── ActivityFeed
│   ├── ChatView
│   │   ├── ChatStatusCard
│   │   ├── ToolActivityPanel
│   │   ├── ChatTranscript
│   │   │   └── ChatMessageBubble[]
│   │   └── ChatComposer
│   ├── CrewView
│   │   ├── CrewRoster
│   │   └── CrewDetail
│   ├── SystemView
│   │   ├── SystemGauges
│   │   ├── SessionList
│   │   ├── ChannelList
│   │   └── SecurityPanel
│   └── SettingsView
└── StatusBar
```

### 5.2 Component-Store Relationships
```
ChatView
├─ uses chatStore: sessionKey, messages, connectionStatus
├─ uses toolStore: getRunsForSession(sessionKey)
└─ uses sessionsStore: mainSessionKey (fallback)

CrewDetail
├─ uses sessionsStore: getSessionsForCrew(crewId)
└─ uses gatewayStore: activeCrew (for display metadata)

SystemView
├─ uses sessionsStore: getSessions() (limited to 10)
├─ uses systemStore: health, channels
└─ uses gatewayStore: memory, security (legacy)

ShipStatus
├─ uses sessionsStore: getSessions() (for Session CTX)
└─ uses hostMetricsStore: metrics (CPU, Memory, Disk)
```

---

## 6. Data Flow Examples

### 6.1 Sending a Chat Message
```
1. User clicks Send in ChatComposer
   ↓
2. ChatComposer calls chatStore.sendMessage(text)
   ↓
3. chatStore creates optimistic user message
   ↓
4. chatStore calls gatewayClient.chatSend(sessionKey, text, options)
   ↓
5. NativeGatewayClient sends WebSocket message:
      { method: 'chat.send', params: { sessionKey, message, ... } }
   ↓
6. Gateway processes and returns runId
   ↓
7. Gateway streams response via 'chat' events:
      { event: 'chat', payload: { state: 'delta', ... } }
      { event: 'chat', payload: { state: 'delta', ... } }
      { event: 'chat', payload: { state: 'final', ... } }
   ↓
8. NativeGatewayClient dispatches events to chatStore
   ↓
9. chatStore updates stream buffer, then merges to transcript on 'final'
   ↓
10. ChatTranscript re-renders with new message
```

### 6.2 Tool Activity During Chat
```
1. Assistant decides to use a tool
   ↓
2. Gateway sends 'agent' event with stream: 'tool', phase: 'start'
   ↓
3. NativeGatewayClient dispatches to toolStore
   ↓
4. toolStore creates ToolRunEntity with status: 'running'
   ↓
5. ToolActivityPanel (in ChatView) re-renders with new tool run
   ↓
6. Tool executes...
   ↓
7. Gateway sends 'agent' event with stream: 'tool', phase: 'result'
   ↓
8. toolStore updates run with status: 'success', result data
   ↓
9. ToolActivityPanel shows completed tool
   ↓
10. Assistant continues with chat response
```

---

## 7. Key Architectural Principles

1. **Event-Driven Architecture**: All state changes flow from gateway events
2. **Store Separation**: Each domain (sessions, chat, tools) has dedicated store
3. **Computed Views**: Activity feed is computed projection, not persisted state
4. **Gateway-Native**: Direct WebSocket, no proxy or intermediate layer
5. **Session-Scoped**: Tool runs, chat messages scoped to sessionKey
6. **Reactive UI**: Zustand subscriptions trigger component updates
7. **Clean Separation**: Gateway-native state vs host metrics completely separate

---

## 8. File Organization

```
src/
├── core/
│   └── gatewayClient/
│       ├── gatewayClient.ts    # Main WebSocket client
│       ├── bootstrap.ts        # Config loading
│       └── types.ts            # TypeScript interfaces
├── stores/
│   ├── sessionsStore.ts        # Session state
│   ├── chatStore.ts            # Chat messages
│   ├── toolStore.ts            # Tool activity
│   ├── activityFeedStore.ts    # Computed feed
│   ├── systemStore.ts          # Gateway health
│   ├── hostMetricsStore.ts     # Host metrics
│   └── gateway.ts              # Legacy (deprecated)
├── components/
│   ├── chat/                   # Chat UI components
│   ├── crew/                   # Crew management
│   ├── views/                  # Main views
│   ├── panels/                 # Dashboard panels
│   └── ui/                     # Shared UI components
└── utils/
    └── crew.ts                 # Crew mapping utilities
```

---

## Summary

The OCC Mission Control backend follows a clean, event-driven architecture:

- **Single source of truth**: OpenClaw Gateway via WebSocket
- **Native integration**: No proxy layer, direct connection
- **Reactive stores**: Zustand for state management
- **Computed views**: Activity feed derives from stores
- **Session-scoped**: All activity tied to session context
- **Separation of concerns**: Gateway state vs host metrics clearly separated

This design enables real-time updates, clean data flow, and maintainable code structure.
