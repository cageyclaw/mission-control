# LCARS Mission Control — Project Spec

*Created: March 18, 2026*
*Status: Planning*

---

## Vision

An interactive LCARS-styled dashboard for monitoring and managing Q's Bridge Crew.
One screen, depth on demand. Real data from OpenClaw gateway, Star Trek aesthetic.

**Core principle:** Main view = at-a-glance awareness. Click = depth on demand.

---

## Data Sources (Confirmed Available)

### From `openclaw status --json` (polling every 5-10s)

| Data | Source Field | What We Show |
|---|---|---|
| Active sessions | `sessions.recent[]` | Crew status (active/idle), model, tokens |
| Session tokens | `sessions.recent[].totalTokens` | Context fill gauge |
| Session model | `sessions.recent[].model` | Badge on crew member |
| Session age | `sessions.recent[].age` | "Last active X ago" |
| Gateway health | `gateway.reachable`, `gateway.mode` | Ship status (online/offline) |
| Gateway uptime | `/healthz.uptimeMs` | "Uptime: Xh Xm" |
| Memory index | `memory.files`, `memory.chunks`, `memory.dirty` | Ship's computer health |
| Memory provider | `memory.provider`, `memory.model` | Config info |
| Agent list | `agents.agents[]` | Active agents |
| Total sessions | `agents.totalSessions` | Overview stat |
| Security audit | `securityAudit.summary` | Warnings count |
| OS info | `os.label` | System info |
| Update status | `update` | Version info |

### From CLI commands (polling)

| Data | Command | What We Show |
|---|---|---|
| Model list | `openclaw models list` | Available models grid |
| Cron jobs | `openclaw cron list` | Scheduled tasks |
| Channel status | from status JSON | Telegram/BlueBubbles state |

### From WebSocket (real-time events)

| Data | Event Type | What We Show |
|---|---|---|
| Agent messages | `agent.message` | Live activity feed |
| Tool calls | `tool.start` / `tool.end` | Crew station activity |
| Sub-agent spawns | `subagent.spawn` | "Warp flash" on spawn |
| Sub-agent completions | `subagent.done` | Task completion |
| Session events | `session.*` | Session lifecycle |
| Cron events | `cron.*` | Job triggers |

### Local calculation (computed)

| Data | Calculation | What We Show |
|---|---|---|
| Daily cost | Sum tokens × pricing from model list | Cost cards |
| Per-model cost | Group by model, sum tokens | Model breakdown bars |
| Context % | `totalTokens / contextTokens × 100` | Fill gauge |
| Crew status | Map sessions → crew members | Crew roster dots |
| Activity timeline | Last 50 events, timestamped | Feed |

---

## Crew ↔ Data Mapping

Each crew member maps to a session/channel/activity type:

| Crew Member | Role | Detects Activity By |
|---|---|---|
| 🧠 Q (Commander) | Main agent | `agent:main:telegram:*` sessions |
| 🔍 Data | Research | Sub-agent spawns with `data-*` labels |
| 🔧 Geordi | Code | Sub-agent spawns with `geordi-*` labels |
| ⚡ Spark | Quick code | Sub-agent spawns with `spark-*` labels |
| 🎯 Riker | QA/Review | Sub-agent spawns with `riker-*` labels |
| 💝 Troi | Marketing | Sub-agent spawns with `troi-*` labels |
| 🎨 Barclay | Art/Design | Sub-agent spawns with `barclay-*` labels |

**Q** = always "on duty" (main session).
**Bridge Crew** = active when their sub-agent label appears in events.

---

## Layout — Four Views

### View 1: Main Overview (Home)

```
┌──────────────────────────────────────────────────────────────┐
│ ◉ LCARS MISSION CONTROL              Stardate 2026.3.18 15:53│
├────────┬─────────────────────────────┬───────────────────────┤
│        │                             │ SHIP STATUS           │
│ CREW   │  ACTIVITY FEED             │                       │
│        │                             │ Gateway   🟢 Online   │
│ 🧠 Q   │  15:52 🔧 Geordi           │ Uptime    18h 12m     │
│   🟢   │  Building vendor API...     │                       │
│        │                             │ COST (Today)          │
│ 🔍 Data│  15:50 🎯 Riker             │ $4.72                 │
│   🟡   │  Reviewing auth module...   │ ████████░░ 78% budget │
│        │                             │                       │
│ 🔧 Geo │  15:48 💝 Troi              │ MODELS ACTIVE         │
│   🟢   │  Social campaign done...    │ 4 models running      │
│        │                             │                       │
│ ⚡ Spk │  15:45 🔍 Data              │ MEMORY                │
│   ⚪   │  Competitor analysis...     │ 4 files · 10 chunks   │
│        │                             │ Indexed ✅            │
│ 🎯 Rik │                             │                       │
│   🟢   │  [click any entry]          │ CREW ON DUTY          │
│        │                             │ 3/7 active            │
│ 💝 Troi│                             │                       │
│   🟢   │                             │                       │
│        │                             │                       │
│ 🎨 Bar │                             │                       │
│   ⚪   │                             │                       │
├────────┴─────────────────────────────┴───────────────────────┤
│ ◈ HOME  ▸ CREW  ▸ PROJECTS  ▸ COST  ▸ MEMORY  ▸ SYSTEM      │
└──────────────────────────────────────────────────────────────┘
```

### View 2: Crew Detail (click crew member)

Slides in from right, replaces activity feed:

```
┌──────────────────────────────────────────────────────────────┐
│ ◉ CREW DETAIL — 🔧 GEORDI                                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Role: Code Implementation                                   │
│  Model: openai-codex/gpt-5.3-codex                          │
│  Status: 🟢 ACTIVE                                          │
│                                                              │
│  ┌─ CURRENT SESSION ─────────────────────────────────────┐  │
│  │ Task: Building vendor API routes for Market Manager    │  │
│  │ Started: 15:50 (3m 12s ago)                           │  │
│  │ Tokens: 5,120 in / 2,340 out                          │  │
│  │ Cost: $0.14                                           │  │
│  │ Context: ████████░░░░░░░░ 12%                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ RECENT OUTPUT ───────────────────────────────────────┐  │
│  │ 📄 vendor-api.ts                                      │  │
│  │ 📄 db-schema.sql                                      │  │
│  │ 📄 auth-middleware.ts                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ SUB-AGENTS ──────────────────────────────────────────┐  │
│  │ geordi-vendor-api   ✅  12s  $0.03                    │  │
│  │ geordi-db-schema    ✅   8s  $0.02                    │  │
│  │ geordi-auth-flow    ⏳  running...                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ STATS (7 days) ──────────────────────────────────────┐  │
│  │ Total spawns: 14                                       │  │
│  │ Total cost: $1.82                                      │  │
│  │ Avg duration: 45s                                      │  │
│  │ Success rate: 93%                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ ◈ BACK  ▸ CREW  ▸ PROJECTS  ▸ COST  ▸ MEMORY  ▸ SYSTEM     │
└──────────────────────────────────────────────────────────────┘
```

### View 3: Cost Analysis

Full-page view:

```
┌──────────────────────────────────────────────────────────────┐
│ ◉ COST ANALYSIS — MARCH 2026                                │
├──────────────────────────────────┬───────────────────────────┤
│                                  │                           │
│  DAILY TREND (7 days)            │  PER MODEL                │
│                                  │                           │
│  $6 ┤                           │  hunter-alpha ████████ $1.20│
│  $5 ┤         ●                 │  gpt-5.4     ██████  $0.82 │
│  $4 ┤      ●     ●              │  gpt-5.3-cod █████  $0.71  │
│  $3 ┤    ●         ●            │  gpt-5.2     ████   $0.58  │
│  $2 ┤  ●             ●          │  gemini      ██     $0.10  │
│  $1 ┤●                 ●        │                           │
│  $0 ┼──────────────────────     │                           │
│     M  T  W  T  F  S  S        │                           │
│                                  │  PER PROJECT              │
│  SUMMARY                         │                           │
│  Today:      $4.72              │  Market Mgr ████████ $18.40│
│  This week:  $32.15             │  LD Arcade  ████    $8.20  │
│  This month: $127.40            │  Memory     ██      $4.10  │
│  Budget:     $127 / $164 (78%)  │  General    █████   $11.42 │
│                                  │                           │
├──────────────────────────────────┴───────────────────────────┤
│ ◈ BACK  ▸ CREW  ▸ PROJECTS  ◉ COST  ▸ MEMORY  ▸ SYSTEM      │
└──────────────────────────────────────────────────────────────┘
```

### View 4: System Health

Full-page view:

```
┌──────────────────────────────────────────────────────────────┐
│ ◉ SYSTEM HEALTH                                              │
├──────────────────────────────────┬───────────────────────────┤
│                                  │                           │
│  GATEWAY                         │  MEMORY                   │
│  Status: 🟢 Running             │  Files: 4                 │
│  PID: 11063                      │  Chunks: 10               │
│  Uptime: 18h 12m                 │  Provider: gemini         │
│  Mode: local                     │  Model: embedding-2       │
│  Port: 18789                     │  Cache: 12 entries        │
│  Bind: loopback                  │  Dirty: No                │
│                                  │  FTS: ✅ Vector: ✅       │
│  SYSTEM RESOURCES                │                           │
│  CPU  ████████░░░░ 62%          │  CHANNELS                 │
│  RAM  ██████░░░░░░ 51%          │  Telegram: 🟢 OK          │
│  DISK ████░░░░░░░░ 34%          │  BlueBubbles: 🟢 OK       │
│                                  │                           │
│  MODELS CONFIGURED               │  SECURITY                 │
│  8 models across 4 providers     │  Critical: 0              │
│  Image gen: ✅  Image read: ✅   │  Warnings: 2              │
│  Ollama LAN: ✅                  │  Info: 1                  │
│                                  │                           │
├──────────────────────────────────┴───────────────────────────┤
│ ◈ BACK  ▸ CREW  ▸ PROJECTS  ▸ COST  ▸ MEMORY  ◉ SYSTEM      │
└──────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React 19 | Industry standard |
| 3D (optional) | React Three Fiber | For the bridge background later |
| State | Zustand | Lightweight, perfect for this |
| Styling | Tailwind CSS + custom LCARS | Fast layout, LCARS = custom CSS |
| Charts | Recharts or pure SVG | Cost trends, gauges |
| Real-time | WebSocket to OpenClaw gateway | Live data |
| Build | Vite | Fast dev, simple deploy |
| Icons | Custom crew emojis (already have them) | 🧠🔍🔧⚡🎯💝🎨 |

---

## Data Architecture

```
┌─────────────┐     WebSocket      ┌──────────────────┐
│  OpenClaw   │ ◄────────────────► │  Mission Control │
│  Gateway    │     REST polls     │  (React app)     │
│  :18789     │     every 5s       │  :5180           │
└─────────────┘                    └──────────────────┘

Data flows:
1. WebSocket → real-time events (messages, tool calls, spawns)
2. REST /healthz → gateway health (poll every 5s)
3. CLI openclaw status --json → full status (poll every 10s)
4. Local calculation → costs, aggregations, timelines
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Scaffold React app with Vite + Tailwind
- [ ] LCARS theme system (colors, fonts, panel styles)
- [ ] Main overview layout (4-panel grid)
- [ ] WebSocket connection to gateway
- [ ] Polling for status JSON
- [ ] Crew roster with status indicators
- [ ] Basic activity feed

### Phase 2: Core Panels (Week 2)
- [ ] Ship status panel (gateway, memory, channels)
- [ ] Cost tracking (daily, per-model)
- [ ] Crew detail view (click → slide panel)
- [ ] System health panel
- [ ] Real-time event processing

### Phase 3: Polish & Features (Week 3)
- [ ] Cost charts (trend line, breakdown bars)
- [ ] Project view (read from projects/ files)
- [ ] Memory health gauge
- [ ] Crew stats (7-day aggregation)
- [ ] Auto-refresh, theme toggle
- [ ] Mobile responsive

### Phase 4: Advanced (Future)
- [ ] 3D bridge background (React Three Fiber)
- [ ] Crew avatars (generated by Barclay)
- [ ] Red alert mode (error highlighting)
- [ ] Multi-agent support (Q + Max)
- [ ] Ollama LAN status integration

---

## File Structure

```
projects/mission-control/
├── README.md
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── stores/
│   │   ├── gateway.ts          # WebSocket + REST data
│   │   ├── crew.ts             # Crew state mapping
│   │   └── ui.ts               # View state, theme
│   ├── components/
│   │   ├── layout/
│   │   │   ├── MainGrid.tsx    # 4-panel layout
│   │   │   ├── Header.tsx      # Stardate, title
│   │   │   └── NavBar.tsx      # Bottom tabs
│   │   ├── crew/
│   │   │   ├── CrewRoster.tsx  # Left sidebar
│   │   │   ├── CrewDot.tsx     # Status indicator
│   │   │   └── CrewDetail.tsx  # Slide panel
│   │   ├── feed/
│   │   │   ├── ActivityFeed.tsx # Center feed
│   │   │   └── FeedEntry.tsx   # Single entry
│   │   ├── panels/
│   │   │   ├── ShipStatus.tsx  # Gateway, channels
│   │   │   ├── CostPanel.tsx   # Cost cards
│   │   │   ├── MemoryPanel.tsx # Memory health
│   │   │   └── SystemPanel.tsx # CPU, RAM, etc
│   │   └── views/
│   │       ├── CostView.tsx    # Full cost page
│   │       ├── CrewView.tsx    # Full crew page
│   │       └── SystemView.tsx  # Full system page
│   ├── api/
│   │   ├── gateway.ts          # WebSocket client
│   │   ├── status.ts           # Status JSON polling
│   │   └── types.ts            # Data types
│   └── styles/
│       ├── lcars.css           # LCARS theme
│       └── globals.css         # Base styles
└── public/
    └── favicon.ico
```

---

## Open Questions

1. **Cost data** — OpenClaw doesn't track cost directly in status JSON. We'd need to:
   - Pull model pricing from `openclaw models list` (parse table)
   - Calculate cost from tokens × pricing locally
   - Store daily snapshots in localStorage for history

2. **Sub-agent tracking** — WebSocket events may or may not include sub-agent spawn/completion details. Need to verify what the gateway actually emits.

3. **Activity feed source** — Can we get the actual message content via WebSocket, or only metadata?

4. **Authentication** — The gateway token needs to be passed to the WebSocket connection.

---

## References

- OpenClaw Office (WW-AI-Lab): github.com/WW-AI-Lab/openclaw-office
- mudrii dashboard: github.com/mudrii/openclaw-dashboard
- OpenClaw docs: docs.openclaw.ai
- LCARS design: Various fan implementations for CSS reference
