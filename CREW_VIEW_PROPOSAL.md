# Mission Control — Crew Detail View Proposal

## 0) Executive summary
The app already has a **mini “CrewDetail” slide panel** on the Home view (right sidebar) that shows: member identity, status, model, and associated sessions (context % + tokens). The dedicated **Crew** view in `App.tsx` is currently a placeholder.

Recommendation: make the **Crew view** the “big-screen” version of crew telemetry: 
- left: roster + filters
- center: selected crew profile (timeline + sessions + performance)
- right: fleet-wide crew analytics + alerts

This turns “Crew” from a duplicate of the slide panel into a high-value **operations + accountability + debugging** screen.

---

## 1) Current state analysis (what exists today)

### Routing / view structure
- `App.tsx` uses `activeView` (`'home' | 'crew' | 'cost' | 'system'`).
- When `activeView === 'home'`, the layout is 3 columns:
  - Left: `CrewRoster`
  - Center: `ActivityFeed`
  - Right: `ShipStatus`, `CostPanel`, and `CrewDetail` (slide-in)
- When `activeView === 'crew'`, it shows a placeholder “Crew Detail View” message.

### Crew roster behavior
- `CrewRoster.tsx` renders the 7 crew (`CREW_MEMBERS`) with:
  - status dot (`active|idle|offline|error`)
  - emoji + name + role
  - `currentTask` truncation OR `role · {contextPercent}% CTX`
- Clicking a member calls `selectCrew(id | null)`.

### Existing detail panel (Home view)
- `components/crew/CrewDetail.tsx` is a **slide panel** driven by `selectedCrewId`.
- It finds sessions for the crew by calling `detectCrew(session.key)` and matching `crew?.id`.
- Displays:
  - identity header (emoji, name, role)
  - status + model
  - “Current Session” (session key suffix, model, tokens, context%) + gauge
  - “All Sessions” list if multiple sessions
  - empty state for offline/no session

### Data available in the store
From `stores/gateway.ts` and `api/types.ts`, the Crew view can compute rich telemetry **without new backend work**:
- `sessions: Session[]` (age, model, tokens in/out/cache, percentUsed, remainingTokens, etc.)
- `feed: FeedEntry[]` (spawn/complete/tool/file/process/search/error/system + timestamps + task/status/progress)
- `activeTasks: Map<crewId, FeedEntry>`
- `subagentMappings: Map<string, SubagentMapping>` (spawnedAt/status/task)
- system status also available (security audit, memory status, channels)

Key insight: the **Activity Feed already contains the raw material for “work history”** (spawn → tool/file/process → complete/error), which can be aggregated into per-crew metrics.

---

## 2) Proposals (3–5 concrete features)

### Proposal A — “Crew Ops Overview” (fleet view)
**Purpose:** quick read of who is doing what, who is stuck, and where cost/context risk is.

**What it shows**
1) **Crew grid** (7 cards):
   - status (active/idle/offline/error)
   - current task (from `activeTasks` or `activeCrew.currentTask`)
   - session age + context% + tokens
   - “risk” badges:
     - `CTX > 80%` (context danger)
     - `age > 10m` while “active” (stuck/forgotten)
     - `recent error` in last N minutes

2) **Top alerts panel** (derived from sessions + feed):
   - “3 sessions above 85% context”
   - “1 crew member in error state”
   - “Security: 2 critical findings” (links to System)

**Mock data example**
```txt
GEORDI 🔧  ACTIVE
Task: Refactor Crew view components
CTX: 72%  TOK: 48.2k  Age: 1m
BADGES: —

DATA 🔍  IDLE
Task: Analyze Mission Control Crew view
CTX: 18%  TOK: 6.4k  Age: 7m
BADGES: —

SPARK ⚡ ACTIVE
Task: Add sparklines to crew cards
CTX: 89%  TOK: 22.1k  Age: 2m
BADGES: CTX HIGH
```

**Why it’s valuable**
- Immediately actionable; reduces hunting through feed.
- Makes “Crew” feel like an ops dashboard, not a vanity screen.

---

### Proposal B — “Selected Crew Profile” (deep dive)
**Purpose:** make one agent’s behavior legible: what they did, what they touched, and whether they’re efficient.

**What it shows** (when you select a crew member)
1) **Identity + live session strip**
   - model, session key, age, input/output/cache tokens, context% with gauge
   - burn rate: `Δtokens / Δtime` (approx using recent polling snapshots or feed-derived)

2) **Work timeline** (last 60–120 minutes)
   - stream of feed events filtered by `crewId`, grouped by “task run”:
     - spawn
     - tool calls (count grouped)
     - file reads/writes/edits (top files)
     - process execs (top commands)
     - completion / failure

3) **“Touched files” + “Executed commands”**
   - top 5 file paths from `FeedEntry.fileOperation.path`
   - top 5 commands from `FeedEntry.processExecution.command`

4) **Outcome summary**
   - last completion time
   - tasks completed today (count)
   - failure rate (complete entries with `status:error`)

**Mock data example**
```txt
DATA 🔍 — Profile
Session: …:9d337222  Model: nemotron-3-super  Age: 2m
CTX: 24%   TOK: 9.1k   IN/OUT: 3.2k/5.9k

Timeline:
11:03 spawn   "Analyze Crew view"
11:04 tool    web_search (x3)
11:05 file    read App.tsx, crew.ts
11:06 file    write CREW_VIEW_PROPOSAL.md
11:07 complete success

Touched Files:
- src/App.tsx (read)
- src/stores/gateway.ts (read)
- CREW_VIEW_PROPOSAL.md (write)
```

**Why it’s valuable**
- Debugging: “Why is Barclay burning tokens?” becomes answerable.
- Accountability: shows real work output, not just status.

---

### Proposal C — “Task Runs & Performance Metrics” (per crew + fleet)
**Purpose:** quantify throughput and detect bottlenecks.

**Core concept:** a **Task Run** is a span starting at a `spawn` entry and ending at the next `complete` entry for that `crewId`.

**What it shows**
- Per crew:
  - median task duration (spawn→complete)
  - median tokens per task run (approx: sum tokens from tool/file/process entries, or infer from session deltas if available)
  - tool mix: `% tool vs file vs process vs search`
- Fleet:
  - “Most efficient” (lowest tokens per success)
  - “Most blocked” (longest median duration)
  - “Most error-prone” (highest error rate)

**Mock data example**
```txt
Performance (last 24h)
- Geordi: 8 runs · median 6m · 42k tok/run · 0 failures
- Spark: 14 runs · median 2m · 18k tok/run · 2 failures
- Data: 5 runs · median 9m · 28k tok/run · 0 failures
```

**Why it’s valuable**
- Helps tune model choices and staffing (Spark for bursts, Data for long research, etc.).
- Identifies “stuck” patterns fast.

---

### Proposal D — “Collaboration / Handoff Map”
**Purpose:** show how work flows between crew members (who spawns whom, or who completes what after whom).

**Data approach (no backend changes)**
- Infer “handoffs” from the Activity Feed ordering:
  - if `crew A` completes a run and within N minutes `crew B` spawns a related task (similar text / same groupKey), count as a handoff.
- Alternatively: add a lightweight `parentCrewId` or `parentRunId` to spawn entries in the store (future enhancement).

**What it shows**
- Simple chord/edge list or adjacency table:
  - Data → Geordi (research → implementation)
  - Geordi → Riker (implementation → review)
  - Troi → Barclay (copy → creative)

**Mock data example**
```txt
Handoffs (7d)
Data  → Geordi : 12
Geordi→ Riker  : 9
Troi  → Barclay: 4
```

**Why it’s valuable**
- Encourages repeatable pipelines.
- Makes the “bridge crew” metaphor actually measurable.

---

### Proposal E — “Crew Controls & Playbooks” (optional, gated)
**Purpose:** allow operators to take safe actions from the Crew view.

**Safe controls (read-only or low-risk)**
- “Copy session key”
- “Filter feed by this crew”
- “Open in System view” for session details

**Higher-risk controls (feature-flagged)**
- “Stop polling / reconnect gateway” (already exists in API layer)
- “Request reindex” if memory dirty (if an endpoint exists)

**Why it’s valuable**
- Reduces context switching.
- Keeps power actions behind an explicit gate.

---

## 3) Recommended implementation approach

### A) Create a dedicated `CrewView` component
- New file: `src/components/views/CrewView.tsx`
- Route it in `App.tsx` for `activeView === 'crew'`.

Layout suggestion:
- **Left column (fixed width):** reuse `CrewRoster` + add quick filters
- **Center (flex):** selected profile (Proposal B) OR fleet overview (Proposal A)
- **Right column (optional):** alerts + performance summary (Proposal C)

### B) Derive view models via selectors (keep components dumb)
Add pure helper functions (new `src/utils/crewMetrics.ts`) such as:
- `getCrewSessions(crewId, sessions)` (similar to current `CrewDetail`)
- `getCrewFeed(crewId, feed, limit)`
- `buildTaskRuns(feed): TaskRun[]` where `TaskRun = { crewId, startedAt, endedAt, status, task, entries[] }`
- `computeCrewStats(runs): { medianDuration, runCount, failureRate }`

Use `useMemo` in `CrewView` to avoid recomputing on every render.

### C) Keep visuals lightweight (LCARS-friendly)
- Prefer simple blocks + gauges + tiny SVG sparklines.
- Avoid heavy chart libs unless needed.

### D) Data gaps / small fixes worth doing
- In `ActivityFeed.tsx`, `hasContent` uses `Object.keys(activeTasks).length` but `activeTasks` is a `Map`; this always returns `0`. Use `activeTasks.size`.
  - This will improve empty-state behavior and also makes the Crew view’s “Active Tasks” panel more reliable.

---

## 4) Priority ranking (what to build first)

### P0 — Must ship to replace the placeholder
1) **CrewView shell + layout** (roster + profile area)
2) **Selected Crew Profile** (Proposal B) using existing `CrewDetail` logic expanded with timeline

### P1 — High impact
3) **Crew Ops Overview** (Proposal A) — fleet grid + alerts
4) **Task Runs & Performance Metrics** (Proposal C) — durations + error rate

### P2 — Nice-to-have / future
5) **Collaboration / Handoff Map** (Proposal D)
6) **Controls & Playbooks** (Proposal E) behind feature flag

---

## 5) Suggested UI copy / LCARS labels (optional)
- Crew view header: `CREW TELEMETRY` or `PERSONNEL OPS`
- Fleet overview: `BRIDGE CREW STATUS`
- Selected profile: `INDIVIDUAL PERFORMANCE LOG`
- Timeline: `SHIP'S LOG (FILTERED)`

---

## 6) Acceptance criteria (definition of “done” for first iteration)
- Crew view no longer shows placeholder.
- Selecting a crew member shows:
  - status/model/session metrics
  - last N feed events for that crew
  - top files/commands (if present)
- Fleet overview shows all 7 crew with at least status + context + current task.
