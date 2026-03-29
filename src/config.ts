export interface MissionControlSettings {
  gatewayHost: string;
  gatewayPort: number;
  gatewayProtocol: 'ws' | 'wss';
  proxyBaseUrl: string;
  metricsBaseUrl: string;
}

// Detect if running in Electron or browser
const isElectron = typeof window !== 'undefined' && window.missionControl?.isElectron;

// For web deployment (Cloudflare tunnel), use relative URLs
// For Electron app, use localhost
const defaults: MissionControlSettings = isElectron
  ? {
      gatewayHost: '127.0.0.1',
      gatewayPort: 18789,
      gatewayProtocol: 'ws',
      proxyBaseUrl: 'http://127.0.0.1:5181',
      metricsBaseUrl: 'http://127.0.0.1:18790',
    }
  : {
      // Web mode - use relative URLs through Cloudflare tunnel
      gatewayHost: window.location.hostname,
      gatewayPort: 443,
      gatewayProtocol: window.location.protocol === 'https:' ? 'wss' : 'ws',
      proxyBaseUrl: '', // Use relative URLs (same origin)
      metricsBaseUrl: '/metrics', // Proxied through Cloudflare tunnel
    };

let cached: MissionControlSettings | null = null;
let settingsChangeSubscribed = false;

function subscribeToElectronSettingsChanges() {
  if (settingsChangeSubscribed || !window.missionControl?.onSettingsChanged) return;
  window.missionControl.onSettingsChanged((settings) => {
    cached = { ...defaults, ...settings };
  });
  settingsChangeSubscribed = true;
}

export async function getSettings(): Promise<MissionControlSettings> {
  if (window.missionControl?.isElectron) subscribeToElectronSettingsChanges();
  if (cached) return cached;

  if (window.missionControl?.isElectron) {
    const loaded = await window.missionControl.getSettings();
    cached = { ...defaults, ...loaded };
  } else {
    const raw = localStorage.getItem('mission-control-settings');
    cached = raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  }

  return cached ?? defaults;
}

export async function saveSettings(settings: Partial<MissionControlSettings>): Promise<MissionControlSettings> {
  const next = { ...(await getSettings()), ...settings };

  if (window.missionControl?.isElectron) {
    cached = await window.missionControl.saveSettings(next);
  } else {
    cached = next;
    localStorage.setItem('mission-control-settings', JSON.stringify(next));
  }

  return cached ?? defaults;
}

export async function resolveGatewayWsUrl() {
  const s = await getSettings();
  return `${s.gatewayProtocol}://${s.gatewayHost}:${s.gatewayPort}`;
}

export async function resolveProxyUrl(pathname: string) {
  const s = await getSettings();
  return `${s.proxyBaseUrl}${pathname}`;
}

export async function resolveMetricsUrl(pathname: string) {
  const s = await getSettings();
  return `${s.metricsBaseUrl}${pathname}`;
}
