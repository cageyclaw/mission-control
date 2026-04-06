import { useState } from 'react';
import { useGatewayStore } from '../../stores/gateway';
import ContextMeter from './ContextMeter';
import SettingsDialog from './SettingsDialog';
import type { View } from '../../api/types';
import { confirmControlAction, reloadControlApp, runRedAlertSequence, showControlNotice } from '../../api/control';

/**
 * STORES USED:
 * - useGatewayStore: activeView (current navigation), setActiveView, qContextData
 */

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
  { id: 'system', label: 'SYSTEM', color: 'cyan', number: '47-93' },
  { id: 'chat', label: 'CHAT', color: 'yellow', number: '47-94' },
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
          const confirmed = await confirmControlAction({
            title: 'RED ALERT',
            message: 'Execute emergency control sequence?',
            detail: 'This will end active sessions, flush memory to daily log, and restart the OpenClaw gateway.',
            confirmLabel: 'Execute',
            cancelLabel: 'Cancel',
          });
          if (!confirmed) return;

          try {
            await runRedAlertSequence();
            await showControlNotice({
              title: 'RED ALERT Complete',
              message: 'Emergency control sequence completed.',
              detail: 'Sessions ended and gateway restart requested.',
            });
          } catch (err) {
            console.error('RED ALERT failed:', err);
            await showControlNotice({
              title: 'RED ALERT Failed',
              message: 'Emergency control sequence failed.',
              detail: 'Check proxy/gateway logs for details.',
            });
          }
        }}>
          <span className="occ-action-button__number">47-99</span>
          <span>ALERT</span>
        </button>
        <button className="occ-action-button occ-action-button--orange" onClick={() => setSettingsOpen(true)}>
          <span className="occ-action-button__number">47-A0</span>
          <span>SETTINGS</span>
        </button>
        <button className="occ-action-button occ-action-button--orange" onClick={() => { void reloadControlApp(); }}>
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
