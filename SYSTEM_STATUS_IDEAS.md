# System Status Panel Improvements - LCARS Design Recommendations

## Overview
The current System Status panel duplicates information from the System Diagnostics screen. These three proposals differentiate the panels so System Status serves as an **at-a-glance monitoring dashboard** while System Diagnostics remains the **detailed troubleshooting interface**.

Each design follows LCARS principles: clean lines, preferred use of graphs/gauges, easy readability at a distance, and visual distinctiveness from detailed views.

---

## Idea 1: Resource Utilization Gauges with Trend Indicators

### Concept Description
Replace text-based status rows with circular or semi-circular gauges showing key resource utilization percentages, enhanced with subtle trend indicators (sparkline-style) to show recent direction of change.

### What Data to Display
- **CPU Utilization** (if available from gateway metrics) - Percentage with trend arrow
- **Memory Utilization** - Percentage of available storage/index capacity used
- **Session Load** - Active sessions vs. typical capacity with utilization %
- **Security Posture** - Composite score based on alert/warning levels

### Visual Design Approach
- **LCARS Style**: Semi-circular gauges in LCARS cyan/orange/purple scheme
- **Layout**: 2x2 grid of gauges, each with:
  - Outer arc showing utilization (0-100%)
  - Inner numeric display of current value
  - Subtle trend indicator (small arrow or color shift) showing recent movement
  - Status dots changed to gradient fills within gauges
- **Colors**: Utilization-based coloring (green <60%, yellow 60-80%, red >80%)

### Why It's Useful for At-a-Glance Monitoring
- Instantly shows system health through visual percentage representation
- Trend indicators reveal developing issues before they become critical
- Gauges are recognizable from peripheral vision
- Eliminates need to read text values for immediate status assessment
- Complements diagnostics by showing utilization vs. diagnostics showing details

### Mock Layout
```
┌─────────────────────────────────────┐
│          47-31  SYSTEM STATUS       │
├─────────────┬─────────────┬─────────────┤
│             │             │             │
│   CPU: ●●●●○   MEM: ●●●○○    SESS: ●●●●●   │
│   75% ↗     40% ↘         90% →       │
│             │             │             │
├─────────────┼─────────────┼─────────────┤
│             │             │             │
│   SEC: ●●●○○○             VERSION       │
│   20% ↘               [2026.3.13] ●     │
│             │             │             │
└─────────────┴─────────────┴─────────────┘
```
*(● = filled segment, ○ = empty segment, arrows = trend direction)*

---

## Idea 2: Timeline-Based Activity Sparkline Monitor

### Concept Description
Transform the status panel into a temporal monitoring view showing recent activity levels and system events over time, using LCARS-style sparklines and event markers.

### What Data to Display
- **Session Activity** - Sparkline of session creation/termination over last hour
- **Message Traffic** - Sparkline of incoming/outgoing messages across channels
- **Security Events** - Timeline markers for alerts/warnings (color-coded dots)
- **System Health** - Overall stability score derived from error rates

### Visual Design Approach
- **LCARS Style**: Horizontal timeline with LCARS-styled sparklines above a baseline
- **Layout**: Vertical stack of monitoring lanes:
  1. Session Activity Lane (LCARS cyan): Sparkline showing session count changes
  2. Message Traffic Lane (LCARS orange): Dual sparkline (in/out) or combined volume
  3. Security Events Lane (LCARS purple): Scatter plot of events with color-coded indicators
  4. Health Indicator Lane: Single LCARS-style status bar showing composite health
- **Animation**: Subtle left-to-right movement to show real-time flow

### Why It's Useful for At-a-Glance Monitoring
- Reveals patterns and trends invisible in static snapshots
- Shows burst activity, periodic behaviors, and developing issues
- Event markers make problems immediately visible against activity baseline
- More engaging than static numbers while remaining informative
- Beliau complement diagnostics (which show state) by showing behavior over time

### Mock Layout
```
┌─────────────────────────────────────┐
│          47-31  SYSTEM STATUS       │
├─────────────────────────────────────┤
│ SESSIONS: ~~~~~~●~~~~~~~●~~~~~~~●~  │  ← Sparkline with event markers
│ MESSAGES: ≈≈≈≈≈≈●≈≈≈≈≈≈●≈≈≈≈≈≈●≈≈  │  ← Dual waveform
│ SECURITY:     •     •     •         │  ← •=info, ⚠=warn, ●=crit
│ HEALTH: [███████░░░░░░░░] 85% STABLE │  ← LCARS health bar
└─────────────────────────────────────┘
```
*(~ = session activity, ≈ = message flow, • = security events)*

---

## Idea 2: LCARS-Style Alert Matrix with Priority Indicators

### Concept Description
Create a visual alert matrix that prioritizes system conditions by severity and urgency, using LCARS color coding and positional importance to guide attention to what needs action.

### What Data to Display
- **Active Alerts** - Current warnings/critical issues by subsystem
- **Trending Issues** - Problems showing worsening trends
- **Recently Resolved** - Recently fixed items (fading indicators)
- **System Readiness** - Overall preparedness for operations

### Visual Design Approach
- **LCARS Style**: LCARS grid/matrix with priority-based positioning
- **Layout**: 
  - Top row (Priority 1): Critical items requiring immediate attention
  - Middle row (Priority 2): Warnings and trending issues
  - Bottom row (Priority 3): Info items and resolved issues
  - Each item in LCARS status-row format but with visual weight based on priority
- **Visual Encoding**:
  - Row position = urgency (top = most urgent)
  - Color intensity = severity (brighter = more severe)
  - Pulsing animation for new/unacknowledged items
  - Fading effects for resolving/resolved items

### Why It's Useful for At-a-Glance Monitoring
- Uses pre-attentive processing (position, color, motion) to guide attention
- Shows not just what's wrong, but what needs attention FIRST
- Reduces cognitive load during incident response
- Clearly separates actionable items from informational status
- Complements diagnostics by highlighting what to investigate first

### Mock Layout
```
┌─────────────────────────────────────┐
│          47-31  SYSTEM STATUS       │
├─────────────────────────────────────┤
│ [47-32] GATEWAY    [OFFLINE] ●●●    │  ← Pulsing, top row = critical
│ [47-33] SESSIONS   [HIGH LAT] ●○     │  ← Trending issue
│ [47-34] MEMORY     [UPDATE] ◯       │  ← Info item, bottom row
│ [47-35] CHANNELS   [NOMINAL] ●      │  ← Normal status
│ [47-36] SECURITY   [2 CRIT] ●●●●●   │  ← Multiple critical alerts
└─────────────────────────────────────┘
```
*(● = active/alerting, ◯ = info/resolved, pulsing = new/unacknowledged)