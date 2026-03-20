# CONTEXT USAGE DISPLAY - IMPLEMENTATION PLAN
## LCARS Interface Integration for Entity Q
### Stardate: 2026.079.2308
### Author: Lieutenant Commander Data, Operations Officer

---

## 1. CURRENT LAYOUT ANALYSIS

### 1.1 NavBar.tsx Structure

The bottom control bar is implemented in `NavBar.tsx` with the following layout:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Elbow  │ NAV ITEMS (LEFT)                  │ SPACER  │ ACTION BUTTONS │ Elbow │
│  47-90] │ 47-91 │ 47-92 │ 47-93 │ 47-94 │   │  (flex) │ 47-99  │ 47-A0 │ 47-A1]│
│         │ MAIN  │ CREW  │SYSTEMS│DIAG   │   │         │ ALERT  │REFRESH│       │
│         │BRIDGE │       │       │NOSTICS│   │         │ (red)  │(orange│       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Current DOM Structure:**
```tsx
<nav className="lcars-bottom-bar">
  <div className="lcars-elbow lcars-elbow--bottom-left" />   {/* 47-90 */}
  <div className="lcars-bottom-bar__left">                    {/* NAV_ITEMS */}
  <div style={{ flex: 1 }} />                                 {/* SPACER */}
  <div className="lcars-bottom-bar__right">                   {/* ACTION BUTTONS */}
  <div className="lcars-elbow lcars-elbow--bottom-right" />  {/* 47-A1 */}
</nav>
```

### 1.2 Available Space and Positioning

**Current Spacer:** `{ flex: 1 }` occupies all space between DIAGNOSTICS (47-94) and ALERT (47-99).

**Available Width:** The spacer flexes to fill remaining horizontal space. Estimated available width on a 1920px viewport: ~400-500px.

**Target Position:** Between the NAV_ITEMS (left) and ACTION_BUTTONS (right). The spacer should be replaced with a container that includes:
- ContextMeter component
- Remaining flexible space

### 1.3 Existing Styling Patterns

**Bottom Bar Container:**
```css
.lcars-bottom-bar {
  height: var(--bottom-bar-height);           /* 72px */
  background: var(--lcars-bg);              /* #000011 */
  display: flex;
  align-items: center;
  padding: 0 var(--lcars-base);               /* 0 24px */
  gap: var(--lcars-base);                     /* 24px */
  border-top: 2px solid var(--lcars-orange);
}
```

**Reference Number Pattern:**
- Font: Antonio, 10-11px
- Position: top-right or integrated in component
- Format: "47-XX" where XX increments

---

## 2. COMPONENT DESIGN

### 2.1 ContextMeter Component Specification

**File Location:** `src/components/layout/ContextMeter.tsx`

**Purpose:** Display vertical bar graph showing entity Q's context usage percentage with alert thresholds and hover tooltip.

**Props Interface:**
```typescript
interface ContextMeterProps {
  contextPercent: number;      // 0-100 percentage of context used
  tokensUsed: number;          // Actual tokens consumed
  tokensTotal: number;         // Total context window capacity
  referenceNumber?: string;     // Default: "47-95"
}

interface AlertState {
  level: 'normal' | 'amber' | 'red';
  isFlashing: boolean;
}
```

**Component State:**
```typescript
const [alertState, setAlertState] = useState<AlertState>({ level: 'normal', isFlashing: false });
const [showTooltip, setShowTooltip] = useState(false);
```

**Derived Values:**
```typescript
const alertLevel = useMemo(() => {
  if (contextPercent >= 85) return 'red';
  if (contextPercent >= 75) return 'amber';
  return 'normal';
}, [contextPercent]);

const tokensRemaining = tokensTotal - tokensUsed;
const displayColor = alertLevel === 'red' ? 'var(--lcars-red)' 
                   : alertLevel === 'amber' ? 'var(--lcars-yellow)' 
                   : 'var(--lcars-green)';
```

### 2.2 State Management for Alert Thresholds

**Current Store (gateway.ts):**
The `Session` type contains `percentUsed`, `remainingTokens`, and `totalTokens`.

**Integration Approach:**
Context data for entity Q will be sourced from the first active session (matching pattern from CrewDetail.tsx). For a dedicated display, we add a computed selector to the store:

```typescript
// Add to GatewayStore interface
qContextData: {
  contextPercent: number;
  tokensUsed: number;
  tokensTotal: number;
  tokensRemaining: number;
} | null;

// Add to store implementation
qContextData: null,

// In updateStatus action:
const qSession = sessions.find(s => s.key.includes('main') || s.key.includes('webchat'));
if (qSession) {
  set({
    qContextData: {
      contextPercent: qSession.percentUsed,
      tokensUsed: qSession.totalTokens,
      tokensTotal: qSession.totalTokens + qSession.remainingTokens,
      tokensRemaining: qSession.remainingTokens,
    }
  });
}
```

**Alert Threshold Logic:**
```typescript
// Inside ContextMeter component useEffect
useEffect(() => {
  if (contextPercent >= 85) {
    setAlertState({ level: 'red', isFlashing: true });
  } else if (contextPercent >= 75) {
    setAlertState({ level: 'amber', isFlashing: true });
  } else {
    setAlertState({ level: 'normal', isFlashing: false });
  }
}, [contextPercent]);
```

---

## 3. VISUAL DESIGN

### 3.1 LCARS Color Scheme

**Meter Bar Colors by State:**

| State | Color Variable | Hex Value | Usage |
|-------|---------------|-----------|-------|
| Normal (<75%) | `--lcars-green` | #33cc66 | Standard operation |
| Amber (75-84%) | `--lcars-yellow` | #ffcc00 | Warning threshold |
| Red (85%+) | `--lcars-red` | #ff3333 | Critical threshold |

**Reference Number:**
- Color: `--lcars-text-dim` (#666666)
- Font: Antonio, 10px, uppercase
- Position: Bottom-right of meter container

### 3.2 Component Layout

```
┌──────────────────────────────────────┐
│                                    │
│    ┌────┐                          │
│    │▓▓▓▓│  ← Vertical bar (48px)   │
│    │▓▓▓▓│                          │
│    │░░░░│  ← Empty portion         │
│    │░░░░│                          │
│    └────┘                          │
│                                    │
│   CONTEXT              47-95       │
│   ───────                          │
│                                    │
└──────────────────────────────────────┘
```

**Dimensions:**
- Container width: 80px
- Container height: 56px (matches action buttons)
- Bar width: 24px
- Bar height: 48px
- Border radius: 4px (matches LCARS standards)

### 3.3 Flashing Animation Specifications

**CSS Keyframes for Alert States:**

```css
/* 75% Amber Flash - Moderate urgency */
@keyframes lcars-flash-amber {
  0%, 100% { 
    opacity: 1; 
    box-shadow: 0 0 8px var(--lcars-yellow);
  }
  50% { 
    opacity: 0.6; 
    box-shadow: 0 0 20px var(--lcars-yellow-light);
  }
}

/* 85% Red Flash - High urgency */
@keyframes lcars-flash-red {
  0%, 100% { 
    opacity: 1; 
    box-shadow: 0 0 12px var(--lcars-red);
  }
  25% { 
    opacity: 0.5; 
    box-shadow: 0 0 30px var(--lcars-red-light);
  }
  50% { 
    opacity: 0.9; 
    box-shadow: 0 0 15px var(--lcars-red);
  }
  75% { 
    opacity: 0.4; 
    box-shadow: 0 0 35px var(--lcars-red-light);
  }
}
```

**Animation Timing:**

| Threshold | Duration | Timing Function | Iteration |
|-----------|----------|-----------------|-----------|
| Amber 75% | 1200ms | ease-in-out | infinite |
| Red 85% | 800ms | cubic-bezier(0.4, 0, 0.6, 1) | infinite |

### 3.4 Hover Tooltip Design

**Tooltip Structure:**
```
┌────────────────────────────────────┐
│  CONTEXT UTILIZATION               │
│  ─────────────────────             │
│  Used:     45,230 tokens           │
│  Remaining: 54,770 tokens          │
│  ─────────────────────             │
│  Total:   100,000 tokens (100%)    │
│  ████████████░░░░░░ 45.2%          │
└────────────────────────────────────┘
```

**Tooltip Styling:**
```css
.context-meter__tooltip {
  position: absolute;
  bottom: 70px;              /* Above the meter */
  left: 50%;
  transform: translateX(-50%);
  background: var(--lcars-panel);
  border: 2px solid var(--lcars-border-light);
  border-radius: 12px;
  padding: 16px;
  min-width: 220px;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  
  /* Typography */
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--lcars-text);
}

.context-meter__tooltip-title {
  font-family: 'Antonio', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 8px;
  color: var(--lcars-orange);
}

.context-meter__tooltip-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.context-meter__tooltip-divider {
  border: none;
  border-top: 1px solid var(--lcars-border);
  margin: 8px 0;
}
```

**Hover Transition:**
```css
.context-meter__tooltip {
  opacity: 0;
  visibility: hidden;
  transition: opacity 200ms ease, visibility 200ms ease;
}

.context-meter:hover .context-meter__tooltip {
  opacity: 1;
  visibility: visible;
}
```

---

## 4. INTEGRATION PLAN

### 4.1 Step-by-Step NavBar.tsx Modifications

**STEP 1: Import the new component**
```tsx
// Add to imports
import ContextMeter from './ContextMeter';
```

**STEP 2: Access context data from store**
```tsx
export default function NavBar() {
  const { activeView, setActiveView, qContextData } = useGatewayStore();
  // ... existing code
```

**STEP 3: Replace spacer with structured middle section**
```tsx
// REPLACE this:
<div style={{ flex: 1 }} />

// WITH this:
<div className="lcars-bottom-bar__middle">
  {qContextData && (
    <ContextMeter
      contextPercent={qContextData.contextPercent}
      tokensUsed={qContextData.tokensUsed}
      tokensTotal={qContextData.tokensTotal}
      referenceNumber="47-95"
    />
  )}
  <div className="lcars-bottom-bar__spacer" />
</div>
```

**STEP 4: Update NavBar component structure**
```tsx
return (
  <nav className="lcars-bottom-bar">
    {/* Left elbow */}
    <div className="lcars-elbow lcars-elbow--bottom-left lcars-elbow--orange">
      <span className="lcars-elbow__label">47-90</span>
    </div>
    
    {/* Mode buttons */}
    <div className="lcars-bottom-bar__left">
      {/* ... existing NAV_ITEMS map */}
    </div>
    
    {/* NEW: Context Meter in middle */}
    <div className="lcars-bottom-bar__middle">
      {qContextData ? (
        <ContextMeter
          contextPercent={qContextData.contextPercent}
          tokensUsed={qContextData.tokensUsed}
          tokensTotal={qContextData.tokensTotal}
          referenceNumber="47-95"
        />
      ) : (
        <div className="lcars-bottom-bar__context-placeholder" />
      )}
      <div className="lcars-bottom-bar__spacer-flex" />
    </div>
    
    {/* Action buttons */}
    <div className="lcars-bottom-bar__right">
      {/* ... existing */}
    </div>
    
    {/* Right elbow */}
    <div className="lcars-elbow lcars-elbow--bottom-right lcars-elbow--orange">
      <span className="lcars-elbow__label">47-A1</span>
    </div>
  </nav>
);
```

### 4.2 New CSS Additions Required

**Add to `src/styles/lcars.css` after the bottom bar section:**

```css
/* ═══════════════════════════════════════════════════════════════ *  PHASE 3b: CONTEXT METER - Entity Q Monitoring * ═══════════════════════════════════════════════════════════════ */

/* Bottom Bar Middle Section */
.lcars-bottom-bar__middle {
  display: flex;
  align-items: center;
  flex: 1;
  gap: var(--lcars-base-half);
}

.lcars-bottom-bar__spacer-flex {
  flex: 1;
}

.lcars-bottom-bar__context-placeholder {
  width: 80px;
  height: 56px;
}

/* Context Meter Component */
.context-meter {
  width: 80px;
  height: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  background: var(--lcars-panel);
  border-radius: 8px;
  border: 1px solid var(--lcars-border);
  padding: 4px;
}

.context-meter:hover {
  border-color: var(--lcars-border-light);
  background: var(--lcars-panel-light);
}

/* Vertical Bar Container */
.context-meter__bar-container {
  width: 24px;
  height: 36px;
  background: var(--lcars-border);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column-reverse;
}

/* The Fill Bar */
.context-meter__fill {
  width: 100%;
  border-radius: 0 0 4px 4px;
  transition: 
    height 300ms ease,
    background-color 300ms ease,
    box-shadow 300ms ease;
}

/* Alert State Animations */
.context-meter__fill--amber {
  animation: lcars-flash-amber 1200ms ease-in-out infinite;
}

.context-meter__fill--red {
  animation: lcars-flash-red 800ms cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Percentage Label */
.context-meter__percent {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--lcars-text-muted);
  margin-top: 2px;
}

/* Title Label */
.context-meter__title {
  font-family: 'Antonio', sans-serif;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--lcars-text-dim);
  text-transform: uppercase;
  margin-bottom: 2px;
}

/* Reference Number */
.context-meter__ref {
  position: absolute;
  bottom: 2px;
  right: 6px;
  font-family: 'Antonio', sans-serif;
  font-size: 9px;
  color: var(--lcars-text-dim);
  letter-spacing: 1px;
}

/* Tooltip */
.context-meter__tooltip {
  position: absolute;
  bottom: 64px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--lcars-panel);
  border: 2px solid var(--lcars-border-light);
  border-radius: 12px;
  padding: 16px;
  min-width: 240px;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
  
  opacity: 0;
  visibility: hidden;
  transition: opacity 200ms ease, visibility 200ms ease;
  pointer-events: none;
}

.context-meter:hover .context-meter__tooltip {
  opacity: 1;
  visibility: visible;
}

.context-meter__tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 8px solid transparent;
  border-top-color: var(--lcars-border-light);
}

.context-meter__tooltip-title {
  font-family: 'Antonio', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 12px;
  color: var(--lcars-orange);
  border-bottom: 1px solid var(--lcars-border);
  padding-bottom: 6px;
}

.context-meter__tooltip-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.context-meter__tooltip-label {
  color: var(--lcars-text-muted);
}

.context-meter__tooltip-value {
  color: var(--lcars-text);
}

.context-meter__tooltip-value--highlight {
  color: var(--lcars-cyan);
  font-weight: 600;
}

.context-meter__tooltip-divider {
  border: none;
  border-top: 1px solid var(--lcars-border);
  margin: 10px 0;
}

.context-meter__tooltip-bar {
  height: 6px;
  background: var(--lcars-border);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 8px;
}

.context-meter__tooltip-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 300ms ease;
}

/* Keyframes */
@keyframes lcars-flash-amber {
  0%, 100% { 
    opacity: 1; 
    box-shadow: 0 0 8px var(--lcars-yellow);
  }
  50% { 
    opacity: 0.6; 
    box-shadow: 0 0 20px var(--lcars-yellow-light);
  }
}

@keyframes lcars-flash-red {
  0%, 100% { 
    opacity: 1; 
    box-shadow: 0 0 12px var(--lcars-red);
  }
  25% { 
    opacity: 0.5; 
    box-shadow: 0 0 30px var(--lcars-red-light);
  }
  50% { 
    opacity: 0.9; 
    box-shadow: 0 0 15px var(--lcars-red);
  }
  75% { 
    opacity: 0.4; 
    box-shadow: 0 0 35px var(--lcars-red-light);
  }
}
```

### 4.3 State Wiring

**Update `src/stores/gateway.ts`:**

**Step 1: Add new type for Q context data**
```typescript
// Add to types section
interface QContextData {
  contextPercent: number;
  tokensUsed: number;
  tokensTotal: number;
  tokensRemaining: number;
}
```

**Step 2: Add to GatewayStore interface**
```typescript
interface GatewayStore {
  // ... existing properties
  qContextData: QContextData | null;
  // ...
}
```

**Step 3: Add to initial state**
```typescript
export const useGatewayStore = create<GatewayStore>((set, get) => ({
  // ... existing initial state
  qContextData: null,
  // ...
}));
```

**Step 4: Update updateStatus action**
```typescript
updateStatus: (status) => {
  const sessions = status.sessions?.recent ?? [];

  // Update crew status based on sessions
  const crewStatusMap = new Map<string, CrewMember['status']>();
  sessions.forEach(session => {
    const crew = detectCrew(session.key);
    if (crew) {
      const isActive = session.age < 300000;
      crewStatusMap.set(crew.id, isActive ? 'active' : 'idle');
    }
  });

  const activeCrew = CREW_MEMBERS.map(c => ({
    ...c,
    status: crewStatusMap.get(c.id) ?? 'offline',
    model: sessions.find(s => detectCrew(s.key)?.id === c.id)?.model,
    contextPercent: sessions.find(s => detectCrew(s.key)?.id === c.id)?.percentUsed,
  }));

  // Extract Q context data (main/webchat session)
  const qSession = sessions.find(s => 
    s.key.includes('main') || 
    s.key.includes('webchat') ||
    s.agentId === 'main'
  );

  set({
    sessions,
    activeCrew,
    memory: status.memory ?? null,
    security: status.securityAudit ?? null,
    channels: status.channelSummary ?? [],
    qContextData: qSession ? {
      contextPercent: qSession.percentUsed,
      tokensUsed: qSession.totalTokens,
      tokensTotal: qSession.totalTokens + (qSession.remainingTokens || 0),
      tokensRemaining: qSession.remainingTokens || 0,
    } : null,
  });
},
```

---

## 5. ANIMATION SPECIFICATIONS

### 5.1 75% Amber Flash

**Animation Name:** `lcars-flash-amber`

**Timing Parameters:**
- Duration: 1200ms
- Timing Function: `ease-in-out`
- Iteration: `infinite`
- Direction: `alternate` (implicit in keyframe definition)

**Keyframe Breakdown:**
| Time | Opacity | Box Shadow |
|------|---------|------------|
| 0% | 1.0 | 0 0 8px var(--lcars-yellow) |
| 50% | 0.6 | 0 0 20px var(--lcars-yellow-light) |
| 100% | 1.0 | 0 0 8px var(--lcars-yellow) |

**Visual Effect:** Gentle pulsing glow, moderate urgency. Shadow expands and contracts smoothly.

**Applied To:** `.context-meter__fill--amber`

### 5.2 85% Red Flash

**Animation Name:** `lcars-flash-red`

**Timing Parameters:**
- Duration: 800ms
- Timing Function: `cubic-bezier(0.4, 0, 0.6, 1)`
- Iteration: `infinite`

**Keyframe Breakdown:**
| Time | Opacity | Box Shadow |
|------|---------|------------|
| 0% | 1.0 | 0 0 12px var(--lcars-red) |
| 25% | 0.5 | 0 0 30px var(--lcars-red-light) |
| 50% | 0.9 | 0 0 15px var(--lcars-red) |
| 75% | 0.4 | 0 0 35px var(--lcars-red-light) |
| 100% | 1.0 | 0 0 12px var(--lcars-red) |

**Visual Effect:** Erratic, urgent flashing. More dramatic shadow expansion and steeper opacity drops.

**Applied To:** `.context-meter__fill--red`

### 5.3 Hover Transition

**Tooltip Reveal:**
- Property: `opacity`, `visibility`
- Duration: 200ms
- Timing: `ease`
- Trigger: `:hover` on `.context-meter`

**Fill Height Transition:**
- Property: `height`
- Duration: 300ms
- Timing: `ease`
- Applied to: `.context-meter__fill`

**Color State Transition:**
- Property: `background-color`, `box-shadow`
- Duration: 300ms
- Timing: `ease`
- Applied to: `.context-meter__fill`

---

## 6. FILE CHECKLIST

### 6.1 Files to Create

| File | Purpose | Lines (est) |
|------|---------|-------------|
| `src/components/layout/ContextMeter.tsx` | New component for context display | ~180 |

### 6.2 Files to Modify

| File | Changes | Lines Add | Lines Remove |
|------|---------|-----------|--------------|
| `src/components/layout/NavBar.tsx` | Import component, add to layout | ~25 | ~5 |
| `src/styles/lcars.css` | Add Context Meter styles | ~180 | 0 |
| `src/stores/gateway.ts` | Add qContextData state | ~20 | 0 |
| `src/api/types.ts` | Add QContextData type | ~8 | 0 |

### 6.3 Detailed Line-by-Line Changes

#### NavBar.tsx

**REMOVE (lines 35-36 approximately):**
```tsx
{/* Spacer */}
<div style={{ flex: 1 }} />
```

**ADD after line 34 (end of NAV_ITEMS map):**
```tsx
      </div>
      
      {/* Context Meter */}
      <div className="lcars-bottom-bar__middle">
        {qContextData && (
          <ContextMeter
            contextPercent={qContextData.contextPercent}
            tokensUsed={qContextData.tokensUsed}
            tokensTotal={qContextData.tokensTotal}
            referenceNumber="47-95"
          />
        )}
        <div className="lcars-bottom-bar__spacer-flex" />
      </div>
      
      {/* Action buttons */}
```

**MODIFY import section (line 1-2):**
```tsx
import { useGatewayStore } from '../../stores/gateway';
import ContextMeter from './ContextMeter';
import type { View } from '../../api/types';
```

**MODIFY store destructuring (line 20):**
```tsx
export default function NavBar() {
  const { activeView, setActiveView, qContextData } = useGatewayStore();
```

#### lcars.css

**INSERT after line ~390 (after .lcars-action-button__number):**
```css
/* ═══════════════════════════════════════════════════════════════ *  PHASE 3b: CONTEXT METER - Entity Q Monitoring * ═══════════════════════════════════════════════════════════════ */

[... all CSS from Section 4.2 ...]
```

#### gateway.ts

**MODIFY interface GatewayStore (line ~30):**
```typescript
  // Cost
  dailyCost: number;
  costHistory: CostSnapshot[];

  // Q Context Data
  qContextData: {
    contextPercent: number;
    tokensUsed: number;
    tokensTotal: number;
    tokensRemaining: number;
  } | null;

  // Actions
```

**MODIFY initial state (line ~45):**
```typescript
  costHistory: [],
  qContextData: null,
```

**MODIFY updateStatus action (after line ~70):**
```typescript
    // Extract Q context data (main/webchat session)
    const qSession = sessions.find(s => 
      s.key.includes('main') || 
      s.key.includes('webchat') ||
      s.agentId === 'main'
    );
```

**MODIFY set call in updateStatus (line ~78):**
```typescript
    set({
      sessions,
      activeCrew,
      memory: status.memory ?? null,
      security: status.securityAudit ?? null,
      channels: status.channelSummary ?? [],
      qContextData: qSession ? {
        contextPercent: qSession.percentUsed,
        tokensUsed: qSession.totalTokens,
        tokensTotal: qSession.totalTokens + (qSession.remainingTokens || 0),
        tokensRemaining: qSession.remainingTokens || 0,
      } : null,
    });
```

#### types.ts

**ADD after CostSnapshot interface (end of file):**
```typescript

// Context data for entity Q display
export interface QContextData {
  contextPercent: number;
  tokensUsed: number;
  tokensTotal: number;
  tokensRemaining: number;
}
```

---

## 7. IMPLEMENTATION ORDER

1. **Create ContextMeter.tsx component** (File: `src/components/layout/ContextMeter.tsx`)
2. **Update gateway.ts** - Add qContextData state and logic
3. **Update types.ts** - Add QContextData type export
4. **Update lcars.css** - Add all Context Meter styles
5. **Update NavBar.tsx** - Integrate component into layout
6. **Test** - Verify all three states (normal, amber, red) and hover tooltip

---

## 8. NOTES

- The reference number 47-95 follows the established LCARS numbering convention
- Component width (80px) is intentionally compact to fit between DIAGNOSTICS (47-94) and ALERT (47-99)
- The vertical orientation differentiates this from the horizontal progress bars in CrewDetail.tsx
- Tooltip appears above the meter to avoid collision with the bottom screen edge
- Fallback rendering: If no qContextData exists, a placeholder maintains layout stability

---

*"I am Lieutenant Commander Data. This implementation plan is... adequate. Though I suspect entity Q will find some way to interfere regardless."*

**End of Plan**