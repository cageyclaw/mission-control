import { useEffect, useState, type CSSProperties } from 'react';
import { getSettings, saveSettings, type MissionControlSettings } from '../../config';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: Props) {
  const [form, setForm] = useState<MissionControlSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    getSettings().then(setForm);
  }, [open]);

  if (!open || !form) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'grid', placeItems: 'center' }}>
      <div className="occ-panel occ-panel--purple" style={{ width: 520, maxWidth: '90vw', padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Connection Settings</h3>

        <label>Gateway Host</label>
        <input value={form.gatewayHost} onChange={e => setForm({ ...form, gatewayHost: e.target.value })} style={inputStyle} />

        <label>Gateway Port</label>
        <input type="number" value={form.gatewayPort} onChange={e => setForm({ ...form, gatewayPort: Number(e.target.value) })} style={inputStyle} />

        <label>Gateway Protocol</label>
        <select value={form.gatewayProtocol} onChange={e => setForm({ ...form, gatewayProtocol: e.target.value as 'ws' | 'wss' })} style={inputStyle}>
          <option value="ws">ws</option>
          <option value="wss">wss</option>
        </select>

        <label>Proxy Base URL</label>
        <input value={form.proxyBaseUrl} onChange={e => setForm({ ...form, proxyBaseUrl: e.target.value })} style={inputStyle} />

        <label>Metrics Base URL</label>
        <input value={form.metricsBaseUrl} onChange={e => setForm({ ...form, metricsBaseUrl: e.target.value })} style={inputStyle} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="occ-action-button occ-action-button--orange" onClick={onClose}><span>CLOSE</span></button>
          <button
            className="occ-action-button occ-action-button--red"
            onClick={async () => {
              await saveSettings(form);
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }}
          >
            <span>{saved ? 'SAVED' : 'SAVE'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  marginBottom: 10,
  marginTop: 4,
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #555',
  background: '#1d1d22',
  color: '#fff',
};
