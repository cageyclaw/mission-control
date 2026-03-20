# Mission Control — Task Board

*Bridge Crew Assignments*

---

## 🔧 Geordi — Code Implementation

### ✅ Task 1: Gateway WebSocket Client
- File: `src/api/gateway.ts`
- Connect to OpenClaw gateway as `operator` role
- Handle connect challenge/response flow
- Subscribe to events: `agent`, `chat`, `presence`, `cron`
- Reconnection logic with backoff
- Auth token from config

### ✅ Task 2: Status Polling Layer
- File: `src/api/status.ts`
- Poll `/healthz` every 5s → gateway health
- Poll `/readyz` every 5s → readiness + uptime
- Poll `openclaw status --json` every 10s → full status
- Parse sessions, memory, security, channels

### ✅ Task 3: Zustand Store
- File: `src/stores/gateway.ts`
- Single store with: sessions, gateway health, memory, channels, models, cron
- WebSocket events update store directly
- Polling data merged into store

### ✅ Task 4: Main Layout
- File: `src/components/layout/MainGrid.tsx`
- 4-panel LCARS grid: Crew sidebar, Activity feed, Ship status, Bottom nav
- Responsive: collapse sidebar on mobile
- CSS Grid layout

### ✅ Task 5: Crew Roster
- Files: `src/components/crew/CrewRoster.tsx`, `CrewMember.tsx`
- 7 crew members with status indicators (🟢🟡⚪🔴)
- Click → open CrewDetail slide panel
- Status determined by active sessions/sub-agent labels

### ✅ Task 6: Activity Feed
- Files: `src/components/feed/ActivityFeed.tsx`, `FeedEntry.tsx`
- Live scrolling feed from WebSocket `agent` events
- Each entry: timestamp, crew emoji, summary text
- Color-coded by task type

### ✅ Task 7: Ship Status Panel
- File: `src/components/panels/ShipStatus.tsx`
- Gateway: status, uptime, port, mode
- Memory: files, chunks, provider, dirty status
- Channels: Telegram, BlueBubbles status
- Security: warning counts

### ✅ Task 8: Cost Panel
- File: `src/components/panels/CostPanel.tsx`
- Token × price calculation
- Daily cost from sessions
- Per-model breakdown bars
- Budget gauge

### ✅ Task 9: Cost Analysis View
- File: `src/components/views/CostView.tsx`
- Full-page cost view
- Daily trend chart (Recharts)
- Per-model and per-session breakdowns
- localStorage for daily history

### ✅ Task 10: Q System View
- File: `src/components/views/SystemView.tsx`
- Sessions list with details
- Model grid
- Memory health
- Cron jobs
- Security audit

---

## 🎨 Barclay — Art & UX Design

### ✅ Task 11: LCARS Theme CSS
- File: `src/styles/lcars.css`
- LCARS color palette: orange, purple, cyan, magenta on black
- Asymmetric rounded corner panels
- Status dot styles
- JetBrains Mono + Inter fonts
- Panel animations (slide-in, pulse)

### ✅ Task 12: Crew Detail Slide Panel
- File: `src/components/crew/CrewDetail.tsx`
- Slide from right on crew click
- Show: role, model, current task, session stats
- Animated entry/exit

---

## 🎯 Riker — QA/Review

- Review all code from Geordi for bugs, edge cases
- Review LCARS CSS from Barclay for consistency
- Test WebSocket connection flow
- Verify data accuracy against real gateway output

---

## 🧠 Q — Architecture & Coordination

- Set up project config (vite.config.ts, tailwind, types)
- Create base types (src/api/types.ts)
- Wire everything together in App.tsx
- Deploy and test
