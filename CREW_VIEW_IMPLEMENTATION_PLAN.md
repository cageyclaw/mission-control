# Crew View Implementation Plan for Mission Control

## Overview
This document outlines the implementation plan for the Crew View feature in Mission Control, which will display a single-column list of crew cards showing context usage, agent status, and other vital information as specified in Barclay's spec.

## 1. Data Storage Strategy

### Current State Analysis
The gateway store already tracks:
- `activeCrew`: Array of CrewMember objects with status, model, and contextPercent
- `sessions`: Array of Session objects with detailed token usage

### Persistence Requirements
Based on the requirements, we need to:
1. Show agents even when offline (no active session)
2. Display last known context %
3. Display last model used
4. If agent spawns again, context continues to accumulate

### Recommended Approach
**Enhance the existing gateway store rather than creating new stores**

#### Modifications to Gateway Store (`src/stores/gateway.ts`):

1. **Enhance CrewMember interface** to persist last known values:
```typescript
export interface CrewMember {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'active' | 'idle' | 'offline' | 'error';
  model?: string;
  currentTask?: string;
  tokens?: number;
  contextPercent?: number;
  
  // NEW: Persistent storage fields
  lastKnownModel?: string;      // Last model used when offline
  lastKnownContextPercent?: number; // Last context % when offline
  lastSeen?: number;            // Timestamp when last seen active
}
```

2. **Update the updateStatus action** to preserve last known values:
```typescript
updateStatus: (status) => {
  const sessions = status.sessions?.recent ?? [];
  const { subagentMappings, feed, activeCrew: currentActiveCrew } = get();
  
  // ... existing cleanup and mapping logic ...
  
  // Build crew status with PROPER session matching
  const crewStatusMap = new Map<string, { 
    status: CrewMember['status']; 
    model?: string;
    contextPercent?: number;
    currentTask?: string;
    lastSeen?: number;
  }>();

  // ... existing session processing logic ...

  // Preserve last known values for offline agents
  const activeCrew = CREW_MEMBERS.map(c => {
    const status = crewStatusMap.get(c.id);
    const currentMember = currentActiveCrew.find(m => m.id === c.id);
    
    return {
      ...c,
      status: status?.status ?? 'offline',
      model: status?.model ?? currentMember?.model ?? undefined,
      contextPercent: status?.contextPercent ?? currentMember?.contextPercent ?? undefined,
      currentTask: status?.currentTask ?? currentMember?.currentTask ?? undefined,
      
      // Preserve last known values when going offline
      lastKnownModel: status?.model 
        ? undefined 
        : (currentMember?.lastKnownModel ?? currentMember?.model),
      lastKnownContextPercent: status?.contextPercent 
        ? undefined 
        : (currentMember?.lastKnownContextPercent ?? currentMember?.contextPercent),
      lastSeen: status?.contextPercent !== undefined 
        ? Date.now() 
        : (currentMember?.lastSeen ?? undefined),
    };
  });

  set({
    sessions,
    activeCrew,
    subagentMappings: newMappings,
    // ... rest unchanged
  });
},
```

3. **Add utility function** to get display values (prioritizing current over last known):
```typescript
// In utils/crew.ts
export function getDisplayValues(crewMember: CrewMember): {
  displayModel: string | undefined;
  displayContextPercent: number | undefined;
  displayStatus: CrewMember['status'];
} {
  return {
    displayModel: crewMember.model ?? crewMember.lastKnownModel,
    displayContextPercent: 
      crewMember.contextPercent ?? 
      crewMember.lastKnownContextPercent ?? 
      0,
    displayStatus: crewMember.status
  };
}
```

### Why This Approach
- **Leverages existing patterns**: Uses the same update mechanism as current system
- **Minimal changes**: Enhances existing store rather than creating new complexity
- **Robust**: Preserves data gracefully when agents go offline/online
- **Compatible**: Works with existing CrewDetail and other components

## 2. Component Structure

### Components to Create/Modify

#### New Components:
1. `src/components/views/CrewView.tsx` - Main view component
2. `src/components/crew/CrewCard.tsx` - Individual crew card component
3. `src/components/crew/ContextBar.tsx` - Reusable context bar component

#### Existing Components to Modify:
1. `src/App.tsx` - Add route for crew view
2. `src/components/layout/NavBar.tsx` - Add navigation item

### CrewView.tsx Implementation
```typescript
import { useGatewayStore } from '../../stores/gateway';
import { getDisplayValues } from '../../utils/crew';
import CrewCard from '../crew/CrewCard';

export default function CrewView() {
  const { activeCrew } = useGatewayStore();
  
  // Sort by context % descending, put offline/error at bottom
  const sortedCrew = [...activeCrew].sort((a, b) => {
    const aDisplay = getDisplayValues(a);
    const bDisplay = getDisplayValues(b);
    
    // Offline/error always go to bottom
    const aIsOffline = aDisplay.displayStatus === 'offline' || aDisplay.displayStatus === 'error';
    const bIsOffline = bDisplay.displayStatus === 'offline' || bDisplay.displayStatus === 'error';
    
    if (aIsOffline && !bIsOffline) return 1;
    if (!aIsOffline && bIsOffline) return -1;
    
    // Both online/active/idle - sort by context % descending
    const aCtx = aDisplay.displayContextPercent ?? 0;
    const bCtx = bDisplay.displayContextPercent ?? 0;
    return bCtx - aCtx; // Descending order
  });

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px' }}>
      {/* Header */}
      <div className="lcars-section-header lcars-section-header--orange" style={{ marginBottom: 24 }}>
        <span className="lcars-section-header__number">47-60</span>
        <span style={{ marginLeft: 8 }}>CREW CONTEXT MONITOR</span>
      </div>
      
      {/* Crew Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sortedCrew.map(crewMember => (
          <CrewCard key={crewMember.id} crewMember={crewMember} />
        ))}
        
        {/* Show message if no crew members */}
        {sortedCrew.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px', 
            color: 'var(--lcars-text-muted)' 
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
            <div style={{ fontSize: 18, fontFamily: 'Antonio', textTransform: 'uppercase', letterSpacing: 2 }}>
              NO CREW MEMBERS DETECTED
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### CrewCard.tsx Implementation
```typescript
import { getDisplayValues, getStatusColor } from '../../utils/crew';

interface CrewCardProps {
  crewMember: {
    id: string;
    name: string;
    emoji: string;
    role: string;
    status: 'active' | 'idle' | 'offline' | 'error';
    model?: string;
    currentTask?: string;
    contextPercent?: number;
    lastKnownModel?: string;
    lastKnownContextPercent?: number;
    lastSeen?: number;
  };
}

export default function CrewCard({ crewMember }: CrewCardProps) {
  const { 
    displayModel, 
    displayContextPercent, 
    displayStatus 
  } = getDisplayValues(crewMember);
  
  const isOffline = displayStatus === 'offline' || displayStatus === 'error';
  const contextPercent = displayContextPercent ?? 0;
  
  // Determine risk level color
  let riskColor: string;
  if (isOffline) {
    riskColor = 'var(--lcars-gray)';
  } else if (contextPercent > 85) {
    riskColor = 'var(--lcars-red)';
  } else if (contextPercent >= 70) {
    riskColor = 'var(--lcars-yellow)';
  } else {
    riskColor = 'var(--lcars-green)';
  }
  
  // Format model name (truncate if too long)
  const formattedModel = displayModel 
    ? displayModel.split('/').pop()?.toUpperCase() ?? displayModel.toUpperCase()
    : 'UNKNOWN';
  
  // Status text
  let statusText: string;
  switch (displayStatus) {
    case 'active': statusText = '[ACTIVE]'; break;
    case 'idle': statusText = '[IDLE]'; break;
    case 'offline': statusText = '[OFFLINE]'; break;
    case 'error': statusText = '[ERROR]'; break;
    default: statusText = '[UNKNOWN]';
  }
  
  // Context percentage display
  const ctxPercentDisplay = isOffline ? '--' : `${contextPercent}%`;

  return (
    <div className="lcars-panel" style={{ 
      borderLeft: `8px solid ${riskColor}`,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Context Bar */}
      <div style={{ 
        height: 24,
        background: 'var(--lcars-border)',
        borderRadius: '0 4px 4px 0',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(contextPercent, 100)}%`,
            background: riskColor,
            transition: 'width 300ms ease'
          }}
        />
        {/* Percentage overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 12,
          fontFamily: 'JetBrains Mono',
          fontSize: 11,
          color: 'var(--lcars-text)',
          pointerEvents: 'none'
        }}>
          {ctxPercentDisplay}
        </div>
      </div>
      
      {/* Card Content */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        padding: '16px 20px',
        gap: '4px'
      }}>
        {/* Agent Info Row */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px'
        }}>
          <span style={{ fontSize: 24 }}>{crewMember.emoji}</span>
          <div>
            <div style={{ 
              fontSize: 16, 
              fontFamily: 'Antonio', 
              fontWeight: 700, 
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'var(--lcars-orange)'
            }}>
              {crewMember.name}
            </div>
            <div style={{ 
              fontSize: 12, 
              color: 'var(--lcars-text-muted)',
              fontFamily: 'JetBrains Mono'
            }}>
              {formattedModel}
            </div>
          </div>
          <div style={{ 
            marginLeft: 'auto',
            fontSize: 11,
            fontFamily: 'Antonio',
            textTransform: 'uppercase',
            color: 'var(--lcars-text-muted)'
          }}>
            {statusText}
          </div>
        </div>
        
        {/* Task Info (if available) */}
        {crewMember.currentTask && (
          <div style={{ 
            fontSize: 11, 
            color: 'var(--lcars-text-dim)',
            fontStyle: 'italic'
          }}>
            {crewMember.currentTask}
          </div>
        )}
      </div>
      
      {/* LCARS Reference Number */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        left: 20,
        fontSize: 10,
        fontFamily: 'Antonio',
        color: 'var(--lcars-text-dim)',
        letterSpacing: 1
      }}>
        {/* Calculate reference number based on crew member order */}
        {(() => {
          const crewOrder = ['q', 'data', 'geordi', 'spark', 'riker', 'troi', 'barclay'];
          const index = crewOrder.indexOf(crewMember.id);
          return index !== -1 ? `47-0${index + 1}` : '47-??';
        })()}
      </div>
    </div>
  );
}
```

### ContextBar.tsx (Reusable Component)
```typescript
interface ContextBarProps {
  contextPercent: number;
  riskLevel: 'safe' | 'warning' | 'danger' | 'offline';
  showPercentage?: boolean;
}

export default function ContextBar({ 
  contextPercent, 
  riskLevel, 
  showPercentage = true 
}: ContextBarProps) {
  // Determine color based on risk level
  let barColor: string;
  switch (riskLevel) {
    case 'safe': barColor = 'var(--lcars-green)'; break;
    case 'warning': barColor = 'var(--lcars-yellow)'; break;
    case 'danger': barColor = 'var(--lcars-red)'; break;
    case 'offline': barColor = 'var(--lcars-gray)'; break;
    default: barColor = 'var(--lcars-border)';
  }
  
  const displayPercent = Math.min(contextPercent, 100);
  
  return (
    <div style={{ 
      height: 24,
      background: 'var(--lcars-border)',
      borderRadius: '0 4px 4px 0',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div
        style={{
          height: '100%',
          width: `${displayPercent}%`,
          background: barColor,
          transition: 'width 300ms ease'
        }}
      />
      {showPercentage && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 12,
          fontFamily: 'JetBrains Mono',
          fontSize: 11,
          color: 'var(--lcars-text)',
          pointerEvents: 'none'
        }}>
          {contextPercent >= 0 ? `${displayPercent}%` : '--'}
        </div>
      )}
    </div>
  );
}
```

### NavBar.tsx Modification
Add a new navigation item for Crew View:
```typescript
// In NavBar.tsx, add to the navigation buttons:
<button
  onClick={() => setActiveView('crew')}
  className={activeView === 'crew' 
    ? 'lcars-nav-button lcars-nav-button--active' 
    : 'lcars-nav-button'
}
>
  CREW
</button>
```

### App.tsx Modification
Add the CrewView import and route:
```typescript
// Add import
import CrewView from './components/views/CrewView';

// Add route condition
{activeView === 'crew' && (
  <main className="lcars-center-panel" style={{ width: '100%' }}>
    <div className="lcars-center-panel__header">
      <span className="lcars-center-panel__header-number-left">47-60</span>
      Crew Context Monitor
      <span className="lcars-center-panel__header-number-right">47-61</span>
    </div>
    <div className="lcars-center-panel__content">
      <CrewView />
    </div>
  </main>
)}
```

## 3. Data Flow

### How Context Data Gets Into The View
1. **Gateway Connection**: The OpenClaw gateway sends status updates via WebSocket polling
2. **Status Processing**: `updateStatus` in gateway store processes sessions and updates crew data
3. **Data Enhancement**: Enhanced store logic preserves last known values when agents go offline
4. **View Subscription**: CrewView subscribes to `activeCrew` from gateway store
5. **Sorting & Display**: CrewView sorts crew by context % and renders CrewCard components
6. **Component Rendering**: Each CrewCard displays current or last known values with appropriate styling

### When Does It Update?
- **Real-time**: Updates occur whenever the gateway receives new status data (polling interval)
- **Immediate**: CrewView re-renders automatically when `activeCrew` changes due to Zustand store subscription
- **Efficient**: Only changed components re-render thanks to React's reconciliation

### How To Handle Offline Agents
1. **Preservation**: When an agent goes offline, store preserves last known model and context %
2. **Display**: Shows last known values with visual indicators (offline status, grayed appearance)
3. **Sorting**: Offline agents automatically sorted to bottom of list
4. **Reconnection**: When agent reconnects, updates overwrite preserved values with current data
5. **Context Accumulation**: If agent respawns, context continues accumulating from where it left off

## 4. Implementation Steps

### Step-by-Step Breakdown

#### Phase 1: Data Layer Enhancement (Day 1)
1. [ ] Modify `src/stores/gateway.ts` to enhance CrewMember interface with persistence fields
2. [ ] Update `updateStatus` action to preserve last known values
3. [ ] Add `getDisplayValues` utility function to `src/utils/crew.ts`
4. [ ] Write unit tests for data persistence logic
5. [ ] Test with manual scenario: agent goes offline → shows last known data → comes back online

#### Phase 2: Component Creation (Day 2)
1. [ ] Create `src/components/crew/ContextBar.tsx` reusable component
2. [ ] Create `src/components/crew/CrewCard.tsx` component
3. [ ] Create `src/components/views/CrewView.tsx` main view
4. [ ] Add basic styling following LCARS design specifications
5. [ ] Test components in isolation with mock data

#### Phase 3: Integration (Day 3)
1. [ ] Modify `src/App.tsx` to import and route CrewView
2. [ ] Modify `src/components/layout/NavBar.tsx` to add navigation button
3. [ ] Update LCARS reference numbers in CrewView header (47-60)
4. [ ] Test full integration: navigate to view → see live data → test offline behavior
5. [ ] Verify sorting works correctly (highest context % first, offline at bottom)

#### Phase 4: Styling & Refinement (Day 4)
1. [ ] Implement exact LCARS styling from Barclay's spec:
   - 8px left border colored by risk level
   - 24px context bar height
   - Proper color coding (green <70%, yellow 70-85%, red >85%)
   - Agent emoji + name formatting
   - LCARS reference numbers (47-01 to 47-07)
2. [ ] Add responsive behavior for different screen sizes
3. [ ] Add hover/tooltips for truncated model names
4. [ ] Add accessibility features (aria labels, proper contrast)

#### Phase 5: Testing & QA (Day 5)
1. [ ] Test all edge cases:
   - All agents offline
   - All agents at 100% context
   - Mixed online/offline states
   - Rapid context changes
   - Agent spawning/respawning
2. [ ] Verify no crashes or errors occur
3. [ ] Performance test with frequent updates
4. [ ] Compare against Barclay's visual spec mockups
5. [ ] Document any deviations and obtain approval

### Files to Modify in Order
1. `src/utils/crew.ts` - Add getDisplayValues utility
2. `src/stores/gateway.ts` - Enhance data persistence
3. `src/components/crew/ContextBar.tsx` - Create reusable context bar
4. `src/components/crew/CrewCard.tsx` - Create crew card component
5. `src/components/views/CrewView.tsx` - Create main view
6. `src/App.tsx` - Add route and import
7. `src/components/layout/NavBar.tsx` - Add navigation button

### Testing Approach
1. **Unit Tests**: Test utility functions and component rendering with mock data
2. **Integration Tests**: Test store updates and view rendering together
3. **Manual Testing**: 
   - Simulate agent states (online/offline/active/idle)
   - Test context percentage boundaries (0%, 70%, 85%, 100%)
   - Verify sorting behavior
   - Test responsive breakpoints
   - Verify no React warnings or errors in console
4. **Regression Testing**: Ensure existing views (Cost, System, Home) still work

## 5. Risk Mitigation

### Potential Issues & Prevention Strategies

#### Risk 1: Store Update Conflicts/Crashes
**Problem**: Previous crashes occurred when handling session data
**Prevention**:
- Defensive programming: Check for null/undefined values before accessing
- Immutable updates: Always create new objects/arrays rather than mutating
- Error boundaries: Wrap store updates in try/catch with logging
- Gradual rollout: Feature flag to enable/disable new view

#### Risk 2: Incorrect Data Persistence
**Problem**: Last known values not properly preserved or overwritten
**Prevention**:
- Clear separation: Current values vs. last known values in CrewMember interface
- Explicit logic: Only update last known when transitioning to offline
- Comprehensive tests: Test all state transition scenarios
- Logging: Add debug logs to track value preservation

#### Risk 3: UI Performance Issues
**Problem**: Frequent updates causing jank or slow rendering
**Prevention**:
- Memoization: Use React.memo for CrewCard and ContextBar
- Efficient sorting: Only sort when activeCrew actually changes
- Virtualization: Consider react-window for large crew lists (though we only have 7)
- Batching: Zustand automatically batches updates

#### Risk 4: Styling Inconsistencies
**Problem**: Not matching Barclay's exact visual specification
**Prevention**:
- Pixel-perfect implementation: Follow spec exactly for measurements
- CSS variables: Define all colors and dimensions as CSS variables
- Visual regression: Compare screenshots against spec mockups
- Component isolation: Storybook-style testing for individual components

#### Risk 5: Offline Agent Handling
**Problem**: Offline agents not showing correctly or confusing UX
**Prevention**:
- Clear visual distinction: Gray styling, offline status badge
- Logical sorting: All offline agents consistently at bottom
- Preserved context: Show meaningful last known data, not blanks
- Transition smoothing: Fade effects when going online/offline

#### Risk 6: Reference Number Calculation
**Problem**: LCARS reference numbers (47-01 to 47-07) incorrect
**Prevention**:
- Lookup table: Use explicit mapping rather than calculation
- Constant definition: Define CREW_REFERENCES object
- Tests: Verify each crew member gets correct reference number
- Documentation: Comment explaining the mapping

### Specific Crash Prevention Measures
Based on previous issues, implement these safeguards:

1. **Null Safety in Store Updates**:
```typescript
// Instead of:
const status = crewStatusMap.get(c.id);
// Do:
const status = crewStatusMap.get(c.id) ?? { 
  status: 'offline', 
  model: undefined, 
  contextPercent: undefined, 
  currentTask: undefined 
};
```

2. **Defensive Component Rendering**:
```typescript
// In CrewCard:
const contextPercent = crewMember.contextPercent ?? 
                      crewMember.lastKnownContextPercent ?? 
                      0;

// In ContextBar:
const safePercent = Math.max(0, Math.min(contextPercent, 100));
```

3. **Error Boundaries** (if using React 16+):
```typescript
// Wrap CrewView in error boundary to prevent app crashes
```

4. **Validation Logs**:
```typescript
// In updateStatus:
if (!crewMember.id) {
  console.warn('Crew member missing ID:', crewMember);
  return;
}
```

## Conclusion
This implementation plan provides a robust, specification-compliant approach to creating the Crew View feature. By enhancing existing patterns rather than creating new complexity, we minimize risk while delivering the required functionality. The plan prioritizes data persistence correctness, visual fidelity to Barclay's spec, and resilience against the types of crashes encountered in previous iterations.