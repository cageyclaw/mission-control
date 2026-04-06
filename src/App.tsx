import { Suspense, lazy, useEffect } from 'react';
import { useGatewayStore } from './stores/gateway';
import { stardate } from './utils/crew';
import { useChatStore } from './stores/chat';
import { useSessionsStore } from './stores/sessionsStore';
import { startSpawnRegistryBridgePolling, stopSpawnRegistryBridgePolling } from './stores/crewRegistryStore';
import { loadCrewConfig, wireCrewConfigRuntimeReload } from './config/crewConfig';
import CrewRoster from './components/crew/CrewRoster';
import CrewDetail from './components/crew/CrewDetail';
import ActivityFeed from './components/feed/ActivityFeed';
import ShipStatus from './components/panels/ShipStatus';
import CostPanel from './components/panels/CostPanel';
import NavBar from './components/layout/NavBar';
import ViewErrorBoundary from './components/common/ViewErrorBoundary';
const SystemView = lazy(() => import('./components/views/SystemView'));
const CrewView = lazy(() => import('./components/views/CrewView'));
const ChatView = lazy(() => import('./components/chat/ChatView'));

function App() {
  const { activeView, connected } = useGatewayStore();
  const initializeChat = useChatStore((state) => state.initialize);
  const disconnectChat = useChatStore((state) => state.disconnect);
  const initializeSessions = useSessionsStore((state) => state.initialize);

  useEffect(() => {
    // Phase 7: Native gateway client handles all connection state.
    // Sessions are sourced from gateway events in sessionsStore.
    // Health status comes from systemStore, no polling needed.
    loadCrewConfig()
      .catch((error) => {
        console.warn('[CrewConfig] Initialization failed:', error);
      })
      .finally(() => {
        wireCrewConfigRuntimeReload();
        initializeSessions().catch((error) => {
          console.warn('[Sessions] Initialization failed:', error);
        });
      });
    startSpawnRegistryBridgePolling();
    initializeChat().catch((error) => {
      console.warn('[Chat] Initialization failed:', error);
    });

    return () => {
      disconnectChat();
      stopSpawnRegistryBridgePolling();
    };
  }, [disconnectChat, initializeChat, initializeSessions]);

  const lazyViewFallback = (
    <div style={{ padding: 24, color: 'var(--occ-text-muted)', fontFamily: 'var(--occ-font-display)', letterSpacing: 1 }}>
      Loading view...
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--occ-bg)' }}>
      {/* OCC Header with Elbows */}
      <header className="occ-header-container">
        {/* Left Elbow with reference number */}
        <div className="occ-elbow occ-elbow--top-left occ-elbow--orange">
          <span className="occ-elbow__label">47-11</span>
        </div>
        
        {/* Header Bar */}
        <div className="occ-header">
          {/* Left segment */}
          <div className="occ-header-bar occ-header-bar--left" />
          
          {/* Center - Title */}
          <div className="occ-header-bar occ-header-bar--center">
            <div className="occ-header__title">Command Center</div>
          </div>
          
          {/* Right segment with status */}
          <div className="occ-header-bar occ-header-bar--right">
            <div className="occ-header__status-block">
              <div className={`status-dot ${connected ? 'status-dot--active' : 'status-dot--error'}`} />
              <span className={`occ-header__status-text ${connected ? 'occ-header__status-text--online' : 'occ-header__status-text--offline'}`}>
                {connected ? 'CONNECTED' : 'DISRUPTED'}
              </span>
            </div>
            <div className="occ-stardate">
              {stardate()}
            </div>
          </div>
        </div>
        
        {/* Right Elbow with reference number */}
        <div className="occ-elbow occ-elbow--top-right occ-elbow--orange">
          <span className="occ-elbow__label">47-12</span>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="occ-main-container">
        {activeView === 'home' && (
          <>
            {/* Left Sidebar - Crew Roster */}
            <aside className="occ-sidebar-left">
              <div className="occ-sidebar-left__header">
                <span className="occ-sidebar-left__header-number">47-15</span>
                Crew Roster
              </div>
              <div className="occ-sidebar-left__content">
                <CrewRoster />
              </div>
            </aside>

            {/* Center Panel - Activity Feed */}
            <main className="occ-center-panel">
              <div className="occ-center-panel__header">
                <span className="occ-center-panel__header-number-left">47-21</span>
                Activity Feed
                <span className="occ-center-panel__header-number-right">47-22</span>
              </div>
              <div className="occ-center-panel__content">
                <ActivityFeed />
              </div>
            </main>

            {/* Right Sidebar - Ship Status */}
            <aside className="occ-sidebar-right">
              <div className="occ-sidebar-right__header">
                Ship Status
                <span className="occ-sidebar-right__header-number">47-30</span>
              </div>
              <div className="occ-sidebar-right__content" style={{ position: 'relative' }}>
                <ShipStatus />
                <CostPanel />
                <CrewDetail />
              </div>
            </aside>
          </>
        )}
        
        {activeView === 'system' && (
          <main className="occ-center-panel" style={{ width: '100%' }}>
            <div className="occ-center-panel__header">
              <span className="occ-center-panel__header-number-left">47-50</span>
              System Operations
              <span className="occ-center-panel__header-number-right">47-51</span>
            </div>
            <div className="occ-center-panel__content">
              <ViewErrorBoundary fallbackTitle="System view unavailable">
                <Suspense fallback={lazyViewFallback}>
                  <SystemView />
                </Suspense>
              </ViewErrorBoundary>
            </div>
          </main>
        )}

        {activeView === 'crew' && (
          <main className="occ-center-panel" style={{ width: '100%' }}>
            <div className="occ-center-panel__header">
              <span className="occ-center-panel__header-number-left">47-60</span>
              Crew Context Monitor
              <span className="occ-center-panel__header-number-right">47-61</span>
            </div>
            <div className="occ-center-panel__content">
              <ViewErrorBoundary fallbackTitle="Crew view unavailable">
                <Suspense fallback={lazyViewFallback}>
                  <CrewView />
                </Suspense>
              </ViewErrorBoundary>
            </div>
          </main>
        )}

        {activeView === 'chat' && (
          <main className="occ-center-panel" style={{ width: '100%' }}>
            <div className="occ-center-panel__header">
              <span className="occ-center-panel__header-number-left">47-70</span>
              Command Chat
              <span className="occ-center-panel__header-number-right">47-71</span>
            </div>
            <div className="occ-center-panel__content" style={{ padding: 0 }}>
              <ViewErrorBoundary
                fallbackTitle="Chat view unavailable"
                fallbackMessage="The chat module failed to load. This is usually a chunk/network/base-path issue."
              >
                <Suspense fallback={lazyViewFallback}>
                  <ChatView />
                </Suspense>
              </ViewErrorBoundary>
            </div>
          </main>
        )}
      </div>

      {/* Bottom Control Bar */}
      <NavBar />
    </div>
  );
}

export default App;
