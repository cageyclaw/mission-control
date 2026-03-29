import { useState } from 'react';
import { useGatewayStore } from '../../stores/gateway';
import ContextMeter from './ContextMeter';
import SettingsDialog from './SettingsDialog';
import type { View } from '../../api/types';

interface NavItem {
  id: View;
  label: string;
  sublabel?: string;
  color: 'orange' | 'purple' | 'cyan' | 'yellow';
  number: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'MAIN', sublabel: 'BRIDGE', color: 'orange', number: '47-91' },
  { id: 'crew', label: 'CREW', color: 'purple', number: '47-92' },
  { id: 'cost', label: 'SYSTEMS', color: 'cyan', number: '47-93' },
  { id: 'system', label: 'DIAG', sublabel: 'NOSTICS', color: 'yellow', number: '47-94' },
];

export default function NavBar() {
  const { activeView, setActiveView, qContextData } = useGatewayStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
    <nav className="occ-bottom-bar">
      {/* Left elbow */}
      <div className="occ-elbow occ-elbow--bottom-left occ-elbow--orange">
        <span className="occ-elbow__label">47-90</span>
      </div>
      
      {/* Mode buttons */}
      <div className="occ-bottom-bar__left">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`occ-mode-button occ-mode-button--${item.color} ${activeView === item.id ? 'occ-mode-button--active' : ''}`}
            onClick={() => setActiveView(item.id)}
          >
            <span className="occ-mode-button__number">{item.number}</span>
            <span className="occ-mode-button__label">{item.label}</span>
            {item.sublabel && <span className="occ-mode-button__label">{item.sublabel}</span>}
          </button>
        ))}
      </div>
      
      {/* Context Meter */}
      <div className="occ-bottom-bar__middle">
        {qContextData && (
          <ContextMeter
            contextPercent={qContextData.contextPercent}
            tokensUsed={qContextData.tokensUsed}
            tokensTotal={qContextData.tokensTotal}
            referenceNumber="47-95"
          />
        )}
        <div className="occ-bottom-bar__spacer-flex" />
      </div>

      {/* Action buttons */}
      <div className="occ-bottom-bar__right">
        <button className="occ-action-button occ-action-button--red" onClick={async () => {
          if (confirm('🔴 RED ALERT 🔴\n\nThis will:\n1. End all active sessions\n2. Write session memory to daily log\n3. Restart the OpenClaw gateway\n\nContinue?')) {
            try {
              // 1. End all sessions
              await fetch('/api/session/end', { method: 'POST' });
              // 2. Write memory
              await fetch('/api/memory/flush', { method: 'POST' });
              // 3. Restart gateway
              await fetch('/api/gateway/restart', { method: 'POST' });
              alert('✅ RED ALERT executed!\nSessions ended, gateway restarting...');
            } catch (err) {
              console.error('RED ALERT failed:', err);
              alert('❌ RED ALERT failed. Check console.');
            }
          }
        }}>
          <span className="occ-action-button__number">47-99</span>
          <span>ALERT</span>
        </button>
        <button className="occ-action-button occ-action-button--orange" onClick={() => setSettingsOpen(true)}>
          <span className="occ-action-button__number">47-A0</span>
          <span>SETTINGS</span>
        </button>
        <button className="occ-action-button occ-action-button--orange" onClick={() => window.location.reload()}>
          <span className="occ-action-button__number">47-A1</span>
          <span>REFRESH</span>
        </button>
      </div>
      
      {/* Right elbow */}
      <div className="occ-elbow occ-elbow--bottom-right occ-elbow--orange">
        <span className="occ-elbow__label">47-A2</span>
      </div>
    </nav>
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
