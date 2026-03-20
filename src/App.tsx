import { useEffect } from 'react';
import { useGatewayStore } from './stores/gateway';
import { connectGateway, startStatusPolling, stopStatusPolling } from './api/gateway';
import { startHealthPolling, stopHealthPolling } from './api/status';
import { stardate } from './utils/crew';
import CrewRoster from './components/crew/CrewRoster';
import CrewDetail from './components/crew/CrewDetail';
import ActivityFeed from './components/feed/ActivityFeed';
import ShipStatus from './components/panels/ShipStatus';
import CostPanel from './components/panels/CostPanel';
import NavBar from './components/layout/NavBar';
import CostView from './components/views/CostView';
import SystemView from './components/views/SystemView';

function App() {
  const { activeView, connected } = useGatewayStore();

  useEffect(() => {
    connectGateway();
    startStatusPolling();
    startHealthPolling();
    return () => {
      stopStatusPolling();
      stopHealthPolling();
    };
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--lcars-bg)' }}>
      {/* LCARS Header with Elbows */}
      <header className="lcars-header-container">
        {/* Left Elbow with reference number */}
        <div className="lcars-elbow lcars-elbow--top-left lcars-elbow--orange">
          <span className="lcars-elbow__label">47-11</span>
        </div>
        
        {/* Header Bar */}
        <div className="lcars-header">
          {/* Left segment */}
          <div className="lcars-header-bar lcars-header-bar--left" />
          
          {/* Center - Title */}
          <div className="lcars-header-bar lcars-header-bar--center">
            <div className="lcars-header__title">Mission Control</div>
          </div>
          
          {/* Right segment with status */}
          <div className="lcars-header-bar lcars-header-bar--right">
            <div className="lcars-header__status-block">
              <div className={`status-dot ${connected ? 'status-dot--active' : 'status-dot--error'}`} />
              <span className={`lcars-header__status-text ${connected ? 'lcars-header__status-text--online' : 'lcars-header__status-text--offline'}`}>
                {connected ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div className="lcars-stardate">
              {stardate()}
            </div>
          </div>
        </div>
        
        {/* Right Elbow with reference number */}
        <div className="lcars-elbow lcars-elbow--top-right lcars-elbow--orange">
          <span className="lcars-elbow__label">47-12</span>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="lcars-main-container">
        {activeView === 'home' && (
          <>
            {/* Left Sidebar - Crew Roster */}
            <aside className="lcars-sidebar-left">
              <div className="lcars-sidebar-left__header">
                <span className="lcars-sidebar-left__header-number">47-15</span>
                Crew Roster
              </div>
              <div className="lcars-sidebar-left__content">
                <CrewRoster />
              </div>
            </aside>

            {/* Center Panel - Activity Feed */}
            <main className="lcars-center-panel">
              <div className="lcars-center-panel__header">
                <span className="lcars-center-panel__header-number-left">47-21</span>
                Activity Feed
                <span className="lcars-center-panel__header-number-right">47-22</span>
              </div>
              <div className="lcars-center-panel__content">
                <ActivityFeed />
              </div>
            </main>

            {/* Right Sidebar - Ship Status */}
            <aside className="lcars-sidebar-right">
              <div className="lcars-sidebar-right__header">
                Ship Status
                <span className="lcars-sidebar-right__header-number">47-30</span>
              </div>
              <div className="lcars-sidebar-right__content" style={{ position: 'relative' }}>
                <ShipStatus />
                <CostPanel />
                <CrewDetail />
              </div>
            </aside>
          </>
        )}
        
        {activeView === 'cost' && (
          <main className="lcars-center-panel" style={{ width: '100%' }}>
            <div className="lcars-center-panel__header">
              <span className="lcars-center-panel__header-number-left">47-40</span>
              Cost Analysis
              <span className="lcars-center-panel__header-number-right">47-41</span>
            </div>
            <div className="lcars-center-panel__content">
              <CostView />
            </div>
          </main>
        )}
        
        {activeView === 'system' && (
          <main className="lcars-center-panel" style={{ width: '100%' }}>
            <div className="lcars-center-panel__header">
              <span className="lcars-center-panel__header-number-left">47-50</span>
              System Diagnostics
              <span className="lcars-center-panel__header-number-right">47-51</span>
            </div>
            <div className="lcars-center-panel__content">
              <SystemView />
            </div>
          </main>
        )}
        
        {activeView === 'crew' && (
          <main className="lcars-center-panel" style={{ width: '100%' }}>
            <div className="lcars-center-panel__header">
              <span className="lcars-center-panel__header-number-left">47-60</span>
              Crew Detail
              <span className="lcars-center-panel__header-number-right">47-61</span>
            </div>
            <div className="lcars-center-panel__content">
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--lcars-text-muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
                <div style={{ fontSize: 18, fontFamily: 'Antonio', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
                  Crew Detail View
                </div>
                <div style={{ fontSize: 14 }}>
                  Click a crew member in the sidebar to view details.
                </div>
              </div>
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
