# LCARS Crew View — Context Monitor Dashboard
## Visual Design Specification v1.0

---

## 1. Visual Layout

### Primary Layout: Vertical Priority List (Single Column)

A single-column scrolling list where crew members are sorted by **context danger level** (highest % first). This creates an immediate visual hierarchy — the top of the screen always shows who's at risk.

```
╔══════════════════════════════════════════════════════════════════════╗
║  LCARS-47     [====== CONTEXT MONITOR ======]     STARBASE-001      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │  🔴  ████████████████████████████████████████████░░░░  92%   │   ║
║  │  Q        kimi-k2.5:cloud                     [ACTIVE]       │   ║
║  └──────────────────────────────────────────────────────────────┘   ║
║                              47-01                                  ║
║                                                                      ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │  🟡  ████████████████████████████████████░░░░░░░░░░░░░░░  78%  │   ║
║  │  Riker    openai-codex/gpt-5.4                [ACTIVE]       │   │
║  └──────────────────────────────────────────────────────────────┘   ║
║                              47-02                                  ║
║                                                                      ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │  🟢  ████████████████████████████░░░░░░░░░░░░░░░░░░░░░░  45%  │   ║
║  │  Data     ollama/nemotron-3-super:cloud       [IDLE]         │   ║
║  └──────────────────────────────────────────────────────────────┘   ║
║                              47-03                                  ║
║                                                                      ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │  🟢  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  32%  │   ║
║  │  Geordi   openai-codex/gpt-5.3-codex            [IDLE]       │   ║
║  └──────────────────────────────────────────────────────────────┘   ║
║                              47-04                                  ║
║                                                                      ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │  ⏻   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  --  │   ║
║  │  Troi     openai-codex/gpt-5.2                [OFFLINE]      │   ║
║  └──────────────────────────────────────────────────────────────┘   ║
║                              47-05                                  ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

### Card Structure (Per Crew Member)

Each crew member is a card with **two zones**:

```
┌────────────────────────────────────────────────────────────────────┐
│ [LEAD]                                                             │
│  🔴  ████████████████████████████████████████████░░░░░░░░  92%     │
│                                                                    │
│ [TAIL — rounded only on right side]                               │
│  Q        kimi-k2.5:cloud                     [ACTIVE]      47-01 │
└────────────────────────────────────────────────────────────────────┘
        ▲                                    ▲
        │                                    │
   LCARS color bar                      Status pill
   (color = risk level)
```

#### Why This Layout?

- **Horizontal bar gauge** = reads left-to-right like a progress bar
- **Color bleeds left** = the "at-risk" crew members draw the eye immediately
- **Single column** = works on mobile and desktop without complex breakpoints
- **Danger-sort** = highest risk always visible at top

---

## 2. Color Specifications (LCARS Palette)

### Base Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Black** | `#000000` | Background, void space |
| **LCARS Orange** | `#FF9900` | Headers, primary accents, active states |
| **LCARS Purple** | `#CC88CC` | Secondary info, model text, inactive elements |
| **LCARS Cyan** | `#66CCFF` | Tertiary accents, borders, numbers |
| **LCARS Red** | `#FF6666` | Danger zones, critical context (>85%) |
| **LCARS Yellow** | `#FFCC66` | Warning zones (70-85%) |
| **LCARS Green** | `#66CC99` | Safe zones (<70%) |
| **LCARS White** | `#DDDDDD` | Text, icons |
| **LCARS Gray** | `#666666` | Offline states, disabled elements |

### Risk Level Mapping

```css
/* Context bar colors */
--context-safe:   #66CC99;   /* < 70% */
--context-warning:#FFCC66;   /* 70-85% */
--context-danger: #FF6666;   /* > 85% */
--context-offline:#666666;   /* offline/error */

/* The ENTIRE left border of card matches risk color */
/* Creates instant visual grouping */
```

### Visual Risk Indicators

```
┌──────────────────────────────────────────────────────┐
│▓▓▓│  <-- Thick left border (8px) colored by risk    │
│▓▓▓│      Green = calm, Yellow = watch, Red = panic  │
│▓▓▓│                                                  │
└──────────────────────────────────────────────────────┘
```

---

## 3. Component Structure

### Card Anatomy

```
<CrewCard>
  ├── <RiskStripe />           <!-- 8px colored left border -->
  ├── <CardBody>
  │     ├── <ContextBarRow>
  │     │     ├── <AgentEmoji />        <!-- 🔴 🟢 etc -->
  │     │     ├── <ContextBar />        <!-- The HERO element -->
  │     │     │     ├── <FilledPortion />  <!-- risk-colored -->
  │     │     │     └── <EmptyPortion />   <!-- transparent/dim -->
  │     │     └── <PercentBadge />
  │     └── <InfoRow>
  │           ├── <AgentName />
  │           ├── <ModelName />         <!-- truncated if long -->
  │           └── <StatusBadge />
  └── <RefNumber />             <!-- 47-XX -->
```

### The Context Bar (Hero Element)

**This is the most important visual on the screen.**

```
┌────────────────────────────────────────────────────────┐
│ 🔴 ████████████████████████████████████████████░░ 92% │
│    └─ FILLED (risk color) ─┘└─ EMPTY (20% opacity) ─┘ │
└────────────────────────────────────────────────────────┘
```

**Specifications:**
- **Height:** 24px (substantial but not overwhelming)
- **Border-radius:** 4px on right side only (asymmetric LCARS style)
- **Filled portion:** Solid color based on risk level
- **Empty portion:** 20% opacity white (or transparent with border)
- **Percentage:** Right-aligned, monospace font, LCARS Cyan

### Context Bar States

```
SAFE (< 70%):     🟢 ██████████████████████████████░░░░░░░░░░  45%
WARNING (70-85%): 🟡 ████████████████████████████████████░░  78%
DANGER (> 85%):   🔴 ██████████████████████████████████████░  92%
OFFLINE:          ⏻  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  --
ERROR:            ⚠  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ERR
```

---

## 4. CSS Class Naming

### BEM-style Naming

```css
/* Container */
.crew-view {}
.crew-view__header {}
.crew-view__list {}

/* Card */
.crew-card {}
.crew-card--risk-safe {}
.crew-card--risk-warning {}
.crew-card--risk-danger {}
.crew-card--status-offline {}
.crew-card--status-error {}

/* Risk stripe (left border) */
.crew-card__risk-stripe {}

/* Context bar (hero) */
.context-bar {}
.context-bar__filled {}
.context-bar__empty {}
.context-bar__percent {}

/* Info row */
.crew-card__info {}
.crew-card__emoji {}
.crew-card__name {}
.crew-card__model {}
.crew-card__status {}

/* Status badges */
.status-badge {}
.status-badge--active {}
.status-badge--idle {}
.status-badge--offline {}
.status-badge--error {}

/* LCARS elements */
.lcars-ref { /* 47-XX */ }
.lcars-header { /* Top bar */ }
```

### CSS Variables

```css
:root {
  /* LCARS Palette */
  --lcars-black: #000000;
  --lcars-orange: #FF9900;
  --lcars-purple: #CC88CC;
  --lcars-cyan: #66CCFF;
  --lcars-red: #FF6666;
  --lcars-yellow: #FFCC66;
  --lcars-green: #66CC99;
  --lcars-white: #DDDDDD;
  --lcars-gray: #666666;
  
  /* Risk levels */
  --risk-safe: var(--lcars-green);
  --risk-warning: var(--lcars-yellow);
  --risk-danger: var(--lcars-red);
  
  /* Card dimensions */
  --card-risk-stripe-width: 8px;
  --context-bar-height: 24px;
  --card-padding: 16px;
  --card-gap: 12px;
}
```

---

## 5. Responsive Behavior

### Desktop (> 768px)

```
┌─────────────────────────────────────────────────────────────────┐
│                         [Full Width]                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  🔴  [Context Bar.................................]  92%   │   │
│  │  Name          Model                    [Status]       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              47-01                              │
└─────────────────────────────────────────────────────────────────┘
- Cards: max-width 800px, centered
- Context bar: full card width minus padding
- Info row: flex, space-between
```

### Tablet (480px - 768px)

```
┌─────────────────────────────────────────┐
│           [Nearly Full]                  │
│  ┌───────────────────────────────────┐  │
│  │  🔴  [Context Bar............] 92% │  │
│  │  Name     Model      [Status]     │  │
│  └───────────────────────────────────┘  │
│                47-01                   │
└─────────────────────────────────────────┘
- Cards: 95% width, small margins
- Model text: truncate with ellipsis
```

### Mobile (< 480px)

```
┌───────────────────────────┐
│     [Full Width]           │
│  ┌─────────────────────┐  │
│  │ 🔴 [Bar......] 92% │  │
│  │ Name [Status]       │  │
│  │ gpt-5.4 (model)     │  │
│  └─────────────────────┘  │
│         47-01             │
└───────────────────────────┘
- Cards: 100% width, edge-to-edge
- Model text: moves to second line
- Reduced padding
```

### Key Responsive Rules

1. **Context bar never shrinks below readable** — min-width ensures percentage visible
2. **Model names truncate with ellipsis** — full name on hover (title attribute)
3. **Cards stack vertically** — no horizontal scrolling, ever
4. **Emoji + Percentage stay visible** — these are critical at all sizes

---

## 6. Why This Design Works: "Glance and Know"

### 1. Sort by Danger

The most important crew member is **always at the top**. No scanning required.

```
Order: [92%] [78%] [45%] [32%] [offline]
        ↑ Need attention NOW
```

### 2. Color is Information

- **Green cards** = ignore, they're fine
- **Yellow cards** = keep an eye on
- **Red cards** = requires immediate action
- **Gray cards** = not currently running

Your peripheral vision detects the red stripe before you even focus on the card.

### 3. The Bar is the Story

```
🟢 ████████████████████░░░░░░░░░░░░░░░░░░░░░░ 45%
   └─ "Plenty of room left" ─┘

🔴 ████████████████████████████████████████░ 92%
   └─ "ALMOST FULL" ─┘
```

The visual weight of the filled portion tells the story instantly. You don't need to read the percentage.

### 4. Minimal Text

| Element | Text | Why |
|---------|------|-----|
| Agent | "Q" | First name only — no "Agent" prefix |
| Model | "kimi-k2.5" | Just the identifier, truncated if long |
| Status | "[ACTIVE]" | One word, bracketed (LCARS style) |
| Percent | "92%" | Monospace, right-aligned |

Total text per card: ~30 characters. Glanceable.

### 5. Offline States Don't Scream

Offline/error crew members are **grayed and deprioritized** in the sort. They don't compete visually with active agents who need attention.

---

## 7. Optional Enhancements

### Micro-interactions (Nice to Have)

```css
/* Context bar animation on update */
.context-bar__filled {
  transition: width 0.3s ease-out;
}

/* Pulse animation when entering danger zone */
@keyframes lcars-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
.crew-card--risk-danger .context-bar__filled {
  animation: lcars-pulse 2s infinite;
}
```

### Summary Header

```
┌─────────────────────────────────────────────────────────┐
│  LCARS-47  [==== CONTEXT MONITOR ====]  STARBASE-001   │
│                                                         │
│  Active: 4    Warning: 1    Danger: 1    Offline: 1    │
│           🟢         🟡          🔴         ⏻          │
└─────────────────────────────────────────────────────────┘
```

### Expanded View (Click to Expand)

```
┌─────────────────────────────────────────────────────────┐
│  🔴 ████████████████████████████████████████████░░  92% │
│  Q        kimi-k2.5:cloud                [ACTIVE]       │
│ ─────────────────────────────────────────────────────── │
│  Context: 184,320 / 200,000 tokens                      │
│  Input: 142,100  |  Output: 42,220                      │
│  Session: 47-Alpha-12                                   │
│                              [Collapse]  47-01         │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Mock Data Reference

```javascript
const crewData = [
  { name: "Q", emoji: "🎯", model: "kimi-k2.5:cloud", 
    contextTokens: 200000, totalTokens: 184320, status: "active", risk: "danger" },
  { name: "Riker", emoji: "🎸", model: "openai-codex/gpt-5.4", 
    contextTokens: 128000, totalTokens: 99840, status: "active", risk: "warning" },
  { name: "Data", emoji: "🤖", model: "ollama/nemotron-3-super:cloud", 
    contextTokens: 128000, totalTokens: 57600, status: "idle", risk: "safe" },
  { name: "Geordi", emoji: "🔧", model: "openai-codex/gpt-5.3-codex", 
    contextTokens: 128000, totalTokens: 40960, status: "idle", risk: "safe" },
  { name: "Spark", emoji: "⚡", model: "openai-codex/gpt-5.3-codex-spark", 
    contextTokens: 128000, totalTokens: 32000, status: "idle", risk: "safe" },
  { name: "Troi", emoji: "💜", model: "openai-codex/gpt-5.2", 
    contextTokens: 128000, totalTokens: 0, status: "offline", risk: "offline" },
  { name: "Barclay", emoji: "🔬", model: "google/gemini-3.1-flash-image-preview", 
    contextTokens: 1000000, totalTokens: 150000, status: "idle", risk: "safe" }
];
```

---

## 9. Implementation Notes

### Priority Order

1. **Sort** crew by context % descending (highest risk first)
2. **Group** offline/error agents at bottom
3. **Color** the entire left stripe by risk level
4. **Size** the context bar fill proportionally
5. **Truncate** model names to prevent overflow

### Accessibility

- **Color is NOT the only indicator** — percentage text always visible
- **Sufficient contrast** — all text meets WCAG AA
- **Screen reader friendly** — semantic HTML, aria-labels on bars

---

*Design spec version 1.0 — LCARS Standard 47*
*For: Mission Control Crew View Dashboard*
