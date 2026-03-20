import { useGatewayStore } from '../../stores/gateway';
import ContextMeter from './ContextMeter';
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

  return (
    <nav className="lcars-bottom-bar">
      {/* Left elbow */}
      <div className="lcars-elbow lcars-elbow--bottom-left lcars-elbow--orange">
        <span className="lcars-elbow__label">47-90</span>
      </div>
      
      {/* Mode buttons */}
      <div className="lcars-bottom-bar__left">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`lcars-mode-button lcars-mode-button--${item.color} ${activeView === item.id ? 'lcars-mode-button--active' : ''}`}
            onClick={() => setActiveView(item.id)}
          >
            <span className="lcars-mode-button__number">{item.number}</span>
            <span className="lcars-mode-button__label">{item.label}</span>
            {item.sublabel && <span className="lcars-mode-button__label">{item.sublabel}</span>}
          </button>
        ))}
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
      <div className="lcars-bottom-bar__right">
        <button className="lcars-action-button lcars-action-button--red">
          <span className="lcars-action-button__number">47-99</span>
          <span>ALERT</span>
        </button>
        <button className="lcars-action-button lcars-action-button--orange" onClick={() => window.location.reload()}>
          <span className="lcars-action-button__number">47-A0</span>
          <span>REFRESH</span>
        </button>
      </div>
      
      {/* Right elbow */}
      <div className="lcars-elbow lcars-elbow--bottom-right lcars-elbow--orange">
        <span className="lcars-elbow__label">47-A1</span>
      </div>
    </nav>
  );
}
