# LCARS INTERFACE TRANSFORMATION PLAN
## Library Computer Access and Retrieval System — PADD Interface Specification
### USS Enterprise-D Technical Document 47-349-Alpha

---

## EXECUTIVE SUMMARY

This document outlines the complete transformation of the Mission Control dashboard into an authentic LCARS (Library Computer Access and Retrieval System) interface as seen aboard Federation starships during the 24th century. The current implementation contains LCARS-inspired elements but lacks the structural authenticity required for a true Starfleet-grade interface.

**Classification:** Technical Specification  
**Stardate:** 2026.078.1732  
**Prepared by:** Lieutenant Commander Data, Operations Officer

---

## SECTION 1: CURRENT STATE ANALYSIS

### 1.1 What Is Working

| Element | Status | Notes |
|---------|--------|-------|
| Color Palette | ✓ Partial | Orange (#ff9900), purple (#cc99ff), cyan (#66ccff) are appropriate LCARS colors |
| Typography | ✓ Partial | Antonio font is excellent; Saira Condensed acceptable for body text |
| Pill-shaped Headers | ✓ Partial | Present but lack proper elbow connections |
| Stardate Display | ✓ | Functional implementation |
| Dark Background | ✓ | Correct #000011 base |
| Status Indicators | ✓ | Color-coded dots appropriate |

### 1.2 Critical Deficiencies

| Element | Current State | Required State |
|---------|---------------|----------------|
| **Elbow Joints** | ABSENT | REQUIRED — Corner pieces connecting horizontal/vertical bars |
| **Numbered Labels** | ABSENT | REQUIRED — "47-349" style reference codes |
| **Bottom Control Bar** | ABSENT | REQUIRED — The iconic LCARS bottom button array |
| **Asymmetrical Layout** | SYMMETRICAL (3 equal panels) | ASYMMETRICAL (varying widths, organic flow) |
| **Grid System** | AD HOC | LCARS block-based grid (multiples of base unit) |
| **Data Density** | LOW | HIGH — Technical readouts, small text |
| **Interactive Feedback** | MINIMAL | REQUIRED — Subtle state change animations |
| **Color Distribution** | BALANCED | ORANGE-DOMINANT (70%), accents (30%) |
| **Conduit System** | BASIC | COMPLEX — Multiple conduits with elbows |

### 1.3 Component Assessment

#### Header Section
- **Current:** Two orange segments with vertical conduit
- **Issues:** 
  - No elbow joints at conduit connections
  - No numbered labels (e.g., "47-11")
  - Status area lacks LCARS button styling
  - Missing secondary color bars

#### Navigation Bar
- **Current:** Simple text buttons
- **Issues:**
  - Not positioned at bottom
  - No pill-shaped buttons
  - No color coding by function
  - Missing "MODE SELECT" style labels

#### Content Panels
- **Current:** Three equal-width panels
- **Issues:**
  - Too symmetrical
  - No elbow connections to sidebars
  - Missing header color bars with numbers
  - Content areas lack technical readout styling

---

## SECTION 2: AUTHENTIC LCARS VISUAL REFERENCE

### 2.1 Core LCARS Design Principles

LCARS, designed by Michael Okuda for Star Trek: The Next Generation, follows these fundamental principles:

1. **Curved Geometry:** All interactive elements use pill shapes or rounded rectangles
2. **Asymmetrical Balance:** Visual weight distributed organically, not mathematically
3. **Color Hierarchy:** Orange dominates, with purple, blue, red as functional accents
4. **Numbered References:** Every major section has a reference code (e.g., "47-11")
5. **Conduit Framework:** Vertical and horizontal bars create the structural grid
6. **Touch Interface:** Designed for clear touch targets with visual feedback

### 2.2 The LCARS Component Library

#### A. Elbow Joints
```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  TOP    │     │  BOTTOM │     │  TOP    │
│  LEFT   │     │  LEFT   │     │  RIGHT  │
│   ┌─────┘     └─────┐   │     └─────┐   │
│   │                 │   │           │   │
└───┘                 └───┘           └───┘
```

Elbows are quarter-circle connectors that join horizontal and vertical bars. They are ESSENTIAL to authentic LCARS.

#### B. Color Blocks (Pill Bars)
- **Primary:** Orange (#ff9900) — Main actions, headers
- **Secondary:** Purple (#cc99ff) — Secondary functions
- **Tertiary:** Blue/Cyan (#66ccff) — Information displays
- **Alert:** Red (#ff3333) — Warnings, critical systems
- **Success:** Green (#33cc66) — Online, active, confirmed
- **Warning:** Yellow (#ffcc00) — Cautionary states

#### C. Numbered Labels
LCARS uses a consistent numbering scheme:
- **47** — Primary system reference (honors TNG production designer)
- **11, 12, 13...** — Subsystem identifiers
- **349, 350...** — Instance or version numbers

Format: `[SYSTEM]-[SUBSYSTEM]` or `[SYSTEM]-[SUBSYSTEM]-[INSTANCE]`

#### D. Bottom Control Bar
The iconic LCARS bottom bar contains:
- Mode selection buttons (colored pills)
- System status indicators
- Navigation controls
- Often includes red "alert" buttons on the right

#### E. Data Display Patterns
- **Technical Readouts:** Small, dense text in columns
- **Status Lines:** Label-value pairs with colored indicators
- **Progress Bars:** Horizontal bars with percentage fills
- **Scrolling Displays:** Marquee-style text for alerts

### 2.3 LCARS Grid System

Authentic LCARS uses a modular grid based on a base unit (typically 20-30px):

```
BASE UNIT = 24px

Horizontal Bars: height = BASE_UNIT (24px)
Vertical Bars: width = BASE_UNIT (24px)
Elbow Radius: BASE_UNIT (24px corner radius)
Gutter: BASE_UNIT / 2 (12px)

Panel margins: multiples of BASE_UNIT
Content padding: BASE_UNIT
```

### 2.4 Color Distribution Formula

```
ORANGE:     70% of colored elements
PURPLE:     15% of colored elements
CYAN/BLUE:  10% of colored elements
RED/GREEN:   5% of colored elements (status only)
```

---

## SECTION 3: COMPONENT-BY-COMPONENT REDESIGN PLAN

### 3.1 Header System (Priority: CRITICAL)

#### Current Implementation
```
[Orange Segment] [Title] [Orange Segment]
      │                              
      └─ Conduit (vertical)
```

#### Target Implementation
```
┌─────────────────────────────────────────────────────────────┐
│ ┌──────┐  ┌──────────────────────────────────┐  ┌──────┐  │
│ │ 47-11│  │      M I S S I O N   C O N T R O L│  │ 47-12│  │
│ └──┬───┘  └──────────────────────────────────┘  └──┬───┘  │
│    │                                                │       │
│    └────────────────┐    ┌─────────────────────────┘       │
│                     │    │                                  │
│    ┌────────────────┘    └─────────────────────────┐       │
│    │                                                │       │
└────┘                                                └───────┘
```

#### Required Changes

1. **Add Top-Left Elbow**
   - Component: `LcarsElbow` (position: top-left)
   - Contains: "47-11" label
   - Color: Orange
   - Connects: Header bar to left conduit

2. **Add Top-Right Elbow**
   - Component: `LcarsElbow` (position: top-right)
   - Contains: "47-12" label
   - Color: Orange
   - Connects: Header bar to right side

3. **Restructure Header Bar**
   - Left segment: "47-11" + orange bar
   - Center: Title with proper letter-spacing
   - Right segment: Status block + "47-12"
   - Height: 48px (2× base unit)

4. **Status Block Redesign**
   - Replace current bordered box with pill-shaped LCARS button
   - Add connection to right elbow
   - Include stardate in orange pill format

#### New Components Required
- `LcarsElbow` — Corner connector component
- `LcarsHeaderBar` — Main header with integrated elbows
- `LcarsStatusBlock` — Pill-shaped status display

### 3.2 Left Sidebar — Crew Panel (Priority: HIGH)

#### Current Implementation
- Fixed width: 240px
- Simple orange header
- No elbow connection to header

#### Target Implementation
```
┌──────────────────────────────────────┐
│  ┌──────────────────────────────┐   │
│  │ 47-15    C R E W   R O S T E R│   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐ │
│  │  ◉ Q        COMMANDER    47-16│ │
│  │  ○ DATA     RESEARCH     47-17│ │
│  │  ○ GEORDI   ENGINEERING  47-18│ │
│  │  ○ SPARK    TACTICAL     47-19│ │
│  └──────────────────────────────┘ │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ 47-20    S Y S T E M   S T A T │ │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

#### Required Changes

1. **Add Conduit Connection**
   - Vertical orange bar from header elbow
   - Width: 24px (base unit)
   - Extends full height of sidebar

2. **Redesign Section Headers**
   - Format: "47-XX [SECTION NAME]"
   - Color: Orange
   - Pill shape with right-side rounding
   - Height: 36px

3. **Crew List Items**
   - Numbered labels: "47-16" through "47-19"
   - Status dots aligned left
   - Role displayed in muted text
   - Hover: subtle orange glow

4. **Add Bottom Elbow**
   - Bottom-left corner
   - Connects vertical conduit to bottom bar

#### New Components Required
- `LcarsSidebar` — Container with conduit integration
- `LcarsSectionHeader` — Numbered header bar
- `LcarsListItem` — Numbered list entry with status

### 3.3 Center Panel — Activity Feed (Priority: HIGH)

#### Current Implementation
- Flexible width
- Purple header (centered)
- Simple feed entries

#### Target Implementation
```
┌────────────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 47-21    A C T I V I T Y   F E E D    47-22           │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 1732.47  ◉  SESSION-ALPHA  ·  ACTIVE  ·  47-23        │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ 1731.12  ○  SESSION-BETA   ·  IDLE    ·  47-24        │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ 1728.55  ◉  SESSION-GAMMA ·  ACTIVE  ·  47-25        │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 47-26    S Y S T E M   M E S S A G E S                 │   │
│ └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

#### Required Changes

1. **Dual-Numbered Header**
   - Left number: "47-21" (section ID)
   - Right number: "47-22" (subsection ID)
   - Color: Purple
   - Full-width pill shape

2. **Feed Entry Redesign**
   - Timestamp in LCARS format (stardate-style)
   - Status indicator dot
   - Reference number per entry
   - Horizontal divider lines
   - Hover: highlight with cyan accent

3. **Secondary Section**
   - Additional numbered header
   - System messages in technical format

#### New Components Required
- `LcarsDualHeader` — Header with left/right numbers
- `LcarsFeedEntry` — Activity entry with timestamp and number
- `LcarsDivider` — Horizontal separator line

### 3.4 Right Panel — Ship Status (Priority: HIGH)

#### Current Implementation
- Fixed width: 360px
- Cyan header (right-aligned)
- Multiple info panels

#### Target Implementation
```
┌──────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────┐   │
│  │ 47-30    S H I P   S T A T U S    47-31  │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │ 47-32  GATEWAY        [ONLINE]    ◉     │   │
│  ├──────────────────────────────────────────┤   │
│  │ 47-33  SESSIONS       [4 ACTIVE]  ◉     │   │
│  ├──────────────────────────────────────────┤   │
│  │ 47-34  MEMORY         [INDEXED]   ○     │   │
│  ├──────────────────────────────────────────┤   │
│  │ 47-35  SECURITY       [NOMINAL]   ◉     │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │ 47-36    T O K E N   U S A G E          │   │
│  ├──────────────────────────────────────────┤   │
│  │ ████████████████░░░░  47-37  78%        │   │
│  │ ██████████░░░░░░░░░░  47-38  42%        │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

#### Required Changes

1. **Right-Aligned Header**
   - Numbers on both ends
   - Right-side text alignment
   - Color: Cyan

2. **Status List Redesign**
   - Each item has reference number
   - Status indicator on right
   - Label-value format
   - Alternating row backgrounds (subtle)

3. **Progress Bars**
   - LCARS-style horizontal bars
   - Color-coded fills (orange/yellow/red)
   - Reference numbers for each bar

4. **Add Right Conduit**
   - Vertical bar on right edge
   - Connects to header and bottom bar

#### New Components Required
- `LcarsStatusRow` — Label-value-status row with number
- `LcarsProgressBar` — LCARS-style progress indicator
- `LcarsRightPanel` — Container with right conduit

### 3.5 Bottom Control Bar (Priority: CRITICAL)

#### Current Implementation
- Simple text buttons
- Positioned at bottom
- No LCARS styling

#### Target Implementation
```
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         ┌──────┐ ┌──────┐│
│  │ 47-90│ │ 47-91│ │ 47-92│ │ 47-93│         │ 47-99│ │ 47-A0││
│  │ MAIN │ │ CREW │ │SYSTMS│ │ DIAG │         │ ALERT│ │ EXIT ││
│  │BRIDGE│ │      │ │      │ │NOSTCS│         │      │ │      ││
│  └──────┘ └──────┘ └──────┘ └──────┘         └──────┘ └──────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### Required Changes

1. **Full-Width Bar Container**
   - Height: 72px (3× base unit)
   - Background: Black
   - Top border: 2px orange line

2. **Mode Selection Buttons**
   - Four primary buttons (left side)
   - Colors: Orange, Purple, Cyan, Yellow
   - Each with reference number
   - Active state: brighter color + glow

3. **Action Buttons**
   - Two buttons (right side)
   - Red for ALERT
   - Orange for EXIT/BACK

4. **Elbow Connections**
   - Left elbow connects to left sidebar conduit
   - Right elbow connects to right panel conduit

#### New Components Required
- `LcarsBottomBar` — Container with elbows
- `LcarsModeButton` — Color-coded mode selector
- `LcarsActionButton` — Alert/exit buttons

### 3.6 Navigation System (Priority: MEDIUM)

#### Changes Required
- Replace current NavBar with integrated bottom bar
- Views map to mode buttons:
  - "Main Bridge" → Orange button
  - "Crew" → Purple button
  - "Systems" → Cyan button
  - "Diagnostics" → Yellow button

---

## SECTION 4: CSS ARCHITECTURE RECOMMENDATIONS

### 4.1 File Structure

```
src/styles/
├── lcars/
│   ├── _variables.css      # Color palette, base units
│   ├── _grid.css           # Grid system utilities
│   ├── _elbows.css         # Elbow joint components
│   ├── _bars.css           # Horizontal/vertical bars
│   ├── _buttons.css        # Pill buttons and controls
│   ├── _panels.css          # Content panels
│   ├── _typography.css      # LCARS text styles
│   ├── _animations.css      # State transitions
│   └── index.css            # Main export
└── index.css               # App entry (imports lcars/)
```

### 4.2 CSS Variable System

```css
/* _variables.css */
:root {
  /* Base Unit — The Foundation of LCARS */
  --lcars-base: 24px;
  --lcars-base-half: calc(var(--lcars-base) / 2);
  --lcars-base-double: calc(var(--lcars-base) * 2);
  --lcars-base-triple: calc(var(--lcars-base) * 3);
  
  /* Color Palette — LCARS Standard */
  --lcars-orange: #ff9900;
  --lcars-orange-light: #ffb84d;
  --lcars-orange-dark: #cc7a00;
  
  --lcars-purple: #cc99ff;
  --lcars-purple-light: #e0bbff;
  --lcars-purple-dark: #9966cc;
  
  --lcars-cyan: #66ccff;
  --lcars-cyan-light: #99ddff;
  --lcars-cyan-dark: #3399cc;
  
  --lcars-red: #ff3333;
  --lcars-red-light: #ff6666;
  --lcars-red-dark: #cc0000;
  
  --lcars-yellow: #ffcc00;
  --lcars-yellow-light: #ffe066;
  --lcars-yellow-dark: #cc9900;
  
  --lcars-green: #33cc66;
  --lcars-green-dark: #229944;
  
  --lcars-black: #000000;
  --lcars-bg: #000011;
  --lcars-panel: #0a0e1a;
  --lcars-border: #1a1f2e;
  
  --lcars-text: #e8e8e8;
  --lcars-text-muted: #a0a0a0;
  --lcars-text-dim: #666666;
  
  /* Reference Numbers */
  --lcars-ref-system: "47";
  
  /* Animation Timing */
  --lcars-transition-fast: 150ms;
  --lcars-transition-normal: 300ms;
  --lcars-transition-slow: 500ms;
}
```

### 4.3 Component CSS Patterns

#### Elbow Component
```css
.lcars-elbow {
  width: var(--lcars-base-double);
  height: var(--lcars-base-double);
  position: relative;
}

.lcars-elbow--top-left {
  border-radius: var(--lcars-base-double) 0 0 0;
  background: var(--lcars-orange);
}

.lcars-elbow--top-right {
  border-radius: 0 var(--lcars-base-double) 0 0;
  background: var(--lcars-orange);
}

.lcars-elbow--bottom-left {
  border-radius: 0 0 0 var(--lcars-base-double);
  background: var(--lcars-orange);
}

.lcars-elbow--bottom-right {
  border-radius: 0 0 var(--lcars-base-double) 0;
  background: var(--lcars-orange);
}

.lcars-elbow__label {
  position: absolute;
  font-family: 'Antonio', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--lcars-black);
  letter-spacing: 1px;
}
```

#### Bar Component
```css
.lcars-bar {
  height: var(--lcars-base);
  border-radius: calc(var(--lcars-base) / 2);
  display: flex;
  align-items: center;
  padding: 0 var(--lcars-base-half);
}

.lcars-bar--horizontal {
  width: 100%;
}

.lcars-bar--vertical {
  width: var(--lcars-base);
  height: 100%;
  border-radius: 0 calc(var(--lcars-base) / 2) calc(var(--lcars-base) / 2) 0;
}

.lcars-bar--orange { background: var(--lcars-orange); }
.lcars-bar--purple { background: var(--lcars-purple); }
.lcars-bar--cyan { background: var(--lcars-cyan); }
```

#### Button Component
```css
.lcars-button {
  height: var(--lcars-base-triple);
  min-width: calc(var(--lcars-base) * 4);
  border-radius: calc(var(--lcars-base) / 2);
  border: none;
  cursor: pointer;
  font-family: 'Antonio', sans-serif;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--lcars-black);
  transition: all var(--lcars-transition-fast) ease;
  position: relative;
  overflow: hidden;
}

.lcars-button:hover {
  filter: brightness(1.2);
  box-shadow: 0 0 20px currentColor;
}

.lcars-button:active {
  transform: scale(0.98);
}

.lcars-button--active {
  filter: brightness(1.3);
  box-shadow: 0 0 30px currentColor;
}

.lcars-button__number {
  position: absolute;
  top: 4px;
  left: 8px;
  font-size: 10px;
  opacity: 0.7;
}
```

### 4.4 Animation Specifications

```css
/* State Change Animations */
@keyframes lcars-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes lcars-glow {
  0%, 100% { box-shadow: 0 0 10px currentColor; }
  50% { box-shadow: 0 0 25px currentColor, 0 0 40px currentColor; }
}

@keyframes lcars-slide-in {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.lcars-animate--pulse {
  animation: lcars-pulse 2s infinite;
}

.lcars-animate--glow {
  animation: lcars-glow 2s infinite;
}

.lcars-animate--slide-in {
  animation: lcars-slide-in var(--lcars-transition-normal) ease-out;
}
```

---

## SECTION 5: IMPLEMENTATION PHASES

### Phase 1: Foundation (Priority: CRITICAL)
**Duration:** 1-2 days
**Goal:** Establish LCARS grid system and core CSS

#### Tasks
1. [ ] Create new CSS architecture in `src/styles/lcars/`
2. [ ] Define CSS variables (colors, base units)
3. [ ] Implement elbow component styles
4. [ ] Implement bar component styles
5. [ ] Create grid utility classes
6. [ ] Update `index.css` to import new structure

#### Deliverables
- Complete variable system
- Working elbow and bar components
- Grid utility classes

---

### Phase 2: Header System (Priority: CRITICAL)
**Duration:** 1 day
**Goal:** Transform header to authentic LCARS

#### Tasks
1. [ ] Create `LcarsElbow` component
2. [ ] Create `LcarsHeaderBar` component
3. [ ] Redesign header layout with elbows
4. [ ] Add numbered labels (47-11, 47-12)
5. [ ] Implement status block with LCARS styling
6. [ ] Add stardate display in pill format

#### Deliverables
- Authentic LCARS header
- Reusable elbow component
- Updated App.tsx integration

---

### Phase 3: Bottom Control Bar (Priority: CRITICAL)
**Duration:** 1 day
**Goal:** Implement iconic LCARS bottom bar

#### Tasks
1. [ ] Create `LcarsBottomBar` component
2. [ ] Create `LcarsModeButton` component
3. [ ] Create `LcarsActionButton` component
4. [ ] Implement four mode buttons with colors
5. [ ] Add elbow connections to sidebars
6. [ ] Integrate with navigation state

#### Deliverables
- Functional bottom control bar
- Mode switching via LCARS buttons
- Visual active state indicators

---

### Phase 4: Sidebar Panels (Priority: HIGH)
**Duration:** 1-2 days
**Goal:** Transform sidebars with conduits and numbering

#### Tasks
1. [ ] Create `LcarsSidebar` container with conduit
2. [ ] Create `LcarsSectionHeader` with numbers
3. [ ] Redesign CrewRoster with numbered items
4. [ ] Add vertical conduits to left sidebar
5. [ ] Add vertical conduits to right sidebar
6. [ ] Implement elbow connections

#### Deliverables
- Left sidebar with crew roster
- Right sidebar with ship status
- Proper conduit connections

---

### Phase 5: Content Panels (Priority: HIGH)
**Duration:** 1-2 days
**Goal:** Transform center and panel content

#### Tasks
1. [ ] Create `LcarsDualHeader` component
2. [ ] Create `LcarsFeedEntry` component
3. [ ] Redesign ActivityFeed with LCARS styling
4. [ ] Create `LcarsStatusRow` component
5. [ ] Redesign ShipStatus with numbered rows
6. [ ] Create `LcarsProgressBar` component

#### Deliverables
- Activity feed with LCARS entries
- Ship status with technical readouts
- Progress bars for token usage

---

### Phase 6: Detail Views (Priority: MEDIUM)
**Duration:** 1 day
**Goal:** Apply LCARS styling to secondary views

#### Tasks
1. [ ] Redesign CostView with LCARS panels
2. [ ] Redesign SystemView with LCARS panels
3. [ ] Update CrewDetail slide-out panel
4. [ ] Add numbered headers to all views

#### Deliverables
- Consistent LCARS styling across all views
- Proper navigation between views

---

### Phase 7: Polish & Animation (Priority: MEDIUM)
**Duration:** 1 day
**Goal:** Add interactive feedback and animations

#### Tasks
1. [ ] Implement hover states on all buttons
2. [ ] Add subtle glow effects
3. [ ] Implement slide-in animations for panels
4. [ ] Add pulse animation to active status
5. [ ] Test all interactive elements
6. [ ] Verify color distribution

#### Deliverables
- Animated state changes
- Consistent hover feedback
- Authentic LCARS "feel"

---

### Phase 8: Testing & Refinement (Priority: LOW)
**Duration:** 1 day
**Goal:** Ensure authenticity and functionality

#### Tasks
1. [ ] Compare against LCARS reference images
2. [ ] Verify all numbered labels are present
3. [ ] Test responsive behavior
4. [ ] Verify color distribution (70% orange)
5. [ ] Check all elbow connections
6. [ ] Final visual polish

#### Deliverables
- Production-ready LCARS interface
- Documentation complete

---

## SECTION 6: FILE CHECKLIST

### New Files to Create

#### Components
- [ ] `src/components/lcars/LcarsElbow.tsx`
- [ ] `src/components/lcars/LcarsHeaderBar.tsx`
- [ ] `src/components/lcars/LcarsBottomBar.tsx`
- [ ] `src/components/lcars/LcarsModeButton.tsx`
- [ ] `src/components/lcars/LcarsActionButton.tsx`
- [ ] `src/components/lcars/LcarsSidebar.tsx`
- [ ] `src/components/lcars/LcarsSectionHeader.tsx`
- [ ] `src/components/lcars/LcarsDualHeader.tsx`
- [ ] `src/components/lcars/LcarsListItem.tsx`
- [ ] `src/components/lcars/LcarsFeedEntry.tsx`
- [ ] `src/components/lcars/LcarsStatusRow.tsx`
- [ ] `src/components/lcars/LcarsProgressBar.tsx`
- [ ] `src/components/lcars/LcarsPanel.tsx`
- [ ] `src/components/lcars/index.ts` (exports)

#### Styles
- [ ] `src/styles/lcars/_variables.css`
- [ ] `src/styles/lcars/_grid.css`
- [ ] `src/styles/lcars/_elbows.css`
- [ ] `src/styles/lcars/_bars.css`
- [ ] `src/styles/lcars/_buttons.css`
- [ ] `src/styles/lcars/_panels.css`
- [ ] `src/styles/lcars/_typography.css`
- [ ] `src/styles/lcars/_animations.css`
- [ ] `src/styles/lcars/index.css`

### Files to Modify

#### Core
- [ ] `src/App.tsx` — Restructure layout with elbows and conduits
- [ ] `src/index.css` — Import new LCARS styles
- [ ] `src/styles/lcars.css` — Deprecate, migrate to new structure

#### Components
- [ ] `src/components/layout/NavBar.tsx` — Replace with bottom bar
- [ ] `src/components/crew/CrewRoster.tsx` — Add numbered items
- [ ] `src/components/crew/CrewDetail.tsx` — LCARS panel styling
- [ ] `src/components/feed/ActivityFeed.tsx` — LCARS feed entries
- [ ] `src/components/panels/ShipStatus.tsx` — Numbered status rows
- [ ] `src/components/panels/CostPanel.tsx` — LCARS progress bars
- [ ] `src/components/views/CostView.tsx` — LCARS panel layout
- [ ] `src/components/views/SystemView.tsx` — LCARS panel layout

#### Utilities
- [ ] `src/utils/crew.ts` — Add LCARS reference number generator

---

## SECTION 7: REFERENCE NUMBER SCHEME

### System Reference Map

```
47-00: System Root
├── 47-10: Header System
│   ├── 47-11: Left Header
│   └── 47-12: Right Header
├── 47-15: Left Sidebar
│   ├── 47-16: Crew Member 1 (Q)
│   ├── 47-17: Crew Member 2 (Data)
│   ├── 47-18: Crew Member 3 (Geordi)
│   ├── 47-19: Crew Member 4 (Spark)
│   ├── 47-1A: Crew Member 5 (Riker)
│   ├── 47-1B: Crew Member 6 (Troi)
│   └── 47-1C: Crew Member 7 (Barclay)
├── 47-20: Center Panel
│   ├── 47-21: Activity Feed Header
│   ├── 47-22: Activity Feed Subheader
│   └── 47-23+: Feed Entries
├── 47-30: Right Panel
│   ├── 47-31: Ship Status Header
│   ├── 47-32: Gateway Status
│   ├── 47-33: Sessions Status
│   ├── 47-34: Memory Status
│   ├── 47-35: Security Status
│   └── 47-36+: Token Usage
└── 47-90: Bottom Control Bar
    ├── 47-91: Main Bridge Mode
    ├── 47-92: Crew Mode
    ├── 47-93: Systems Mode
    ├── 47-94: Diagnostics Mode
    ├── 47-99: Alert Button
    └── 47-A0: Exit Button
```

---

## SECTION 8: COLOR USAGE GUIDELINES

### Primary Colors by Function

| Color | Hex | Usage | Percentage |
|-------|-----|-------|------------|
| **Orange** | #ff9900 | Headers, primary actions, main conduits | 70% |
| **Purple** | #cc99ff | Secondary sections, crew-related | 15% |
| **Cyan** | #66ccff | Information displays, technical data | 10% |
| **Red** | #ff3333 | Alerts, warnings, emergency controls | 3% |
| **Green** | #33cc66 | Online status, confirmations | 2% |

### Color Application Rules

1. **Headers:** Orange for primary, Purple for secondary, Cyan for tertiary
2. **Buttons:** Match section color (Main Bridge = Orange, Crew = Purple)
3. **Status Indicators:** Green (active), Yellow (idle), Red (error/offline)
4. **Text:** White (#e8e8e8) on dark, Black on colored bars
5. **Borders:** 1-2px using color at 30% opacity

---

## SECTION 9: TYPOGRAPHY SPECIFICATIONS

### Font Stack
```css
--lcars-font-header: 'Antonio', 'Arial Narrow', sans-serif;
--lcars-font-body: 'Saira Condensed', 'Arial Narrow', sans-serif;
--lcars-font-mono: 'JetBrains Mono', 'Consolas', monospace;
```

### Type Scale

| Element | Font | Size | Weight | Letter-Spacing | Transform |
|---------|------|------|--------|----------------|-----------|
| Main Title | Antonio | 32px | 700 | 4px | UPPERCASE |
| Section Headers | Antonio | 16px | 600 | 3px | UPPERCASE |
| Reference Numbers | Antonio | 12px | 600 | 1px | UPPERCASE |
| Body Text | Saira Condensed | 14px | 400 | 0.5px | Normal |
| Technical Data | JetBrains Mono | 12px | 400 | 0 | UPPERCASE |
| Button Labels | Antonio | 14px | 600 | 2px | UPPERCASE |
| Status Text | Saira Condensed | 12px | 500 | 1px | UPPERCASE |

---

## SECTION 10: SPACING & LAYOUT

### Base Unit System

All measurements based on `--lcars-base: 24px`:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 6px | Tight gaps, icon padding |
| `--space-sm` | 12px | Half-base, small margins |
| `--space-md` | 24px | Standard padding, gaps |
| `--space-lg` | 48px | Double-base, section gaps |
| `--space-xl` | 72px | Triple-base, major divisions |

### Layout Grid

```
┌─────────────────────────────────────────────────────────────┐
│ 24px margin                                                 │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 24px padding                                        │  │
│  │  ┌───────────────────────────────────────────────┐    │  │
│  │  │ Content area                                  │    │  │
│  │  │                                               │    │  │
│  │  └───────────────────────────────────────────────┘    │  │
│  │                                                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────────┘
```

### Panel Dimensions

| Panel | Width | Notes |
|-------|-------|-------|
| Left Sidebar | 280px | Includes 24px conduit |
| Center Panel | Flexible | Fills remaining space |
| Right Sidebar | 320px | Includes 24px conduit |
| Header Height | 96px | 4× base unit |
| Bottom Bar Height | 72px | 3× base unit |

---

## CONCLUSION

This specification provides the complete blueprint for transforming the Mission Control dashboard into an authentic LCARS interface. The implementation prioritizes:

1. **Structural Authenticity:** Elbows, conduits, and numbered labels
2. **Visual Accuracy:** Correct color distribution and typography
3. **Functional Integrity:** All existing features preserved
4. **Interactive Feedback:** Subtle animations for state changes

Following this plan will result in an interface indistinguishable from those aboard the USS Enterprise-D.

**End of Technical Document**

---

*"The LCARS interface was designed to give a sense that the technology was much more advanced than in the original Star Trek."* — Michael Okuda, Scenic Art Supervisor

**Document Version:** 1.0  
**Stardate:** 2026.078.1732  
**Classification:** Technical Specification — Level 1 Clearance
