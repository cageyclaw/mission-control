export interface DeviceIdentitySettings {
  id: string;
  publicKey: string;
  privateKey: string;
}

export interface MissionControlSettings {
  gatewayHost: string;
  gatewayPort: number;
  gatewayProtocol: 'ws' | 'wss';
  /** @deprecated Proxy server removed in Phase 7. Use gateway client directly. */
  proxyBaseUrl: string;
  metricsBaseUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  gatewayDeviceToken?: string;
  deviceIdentity?: DeviceIdentitySettings;
}

// Detect if running in Electron or browser
const browserWindow = typeof window !== 'undefined' ? window : undefined;
const isElectron = browserWindow?.missionControl?.isElectron === true;
const browserLocation = browserWindow?.location;

// Phase 7: Native gateway client - no proxy server
// Settings only need gateway endpoint now
const defaults: MissionControlSettings = isElectron
  ? {
      gatewayHost: '127.0.0.1',
      gatewayPort: 18789,
      gatewayProtocol: 'ws',
      proxyBaseUrl: '', // Phase 7: Proxy server removed
      metricsBaseUrl: 'http://127.0.0.1:18790',
      gatewayToken: '',
      gatewayPassword: '',
      gatewayDeviceToken: '',
    }
  : {
      // Web mode - connects directly to gateway via WebSocket
      // Use relative URLs if gateway is on same origin
      gatewayHost: browserLocation?.hostname ?? '127.0.0.1',
      gatewayPort: browserLocation?.protocol === 'https:' ? 443 : 80,
      gatewayProtocol: browserLocation?.protocol === 'https:' ? 'wss' : 'ws',
      proxyBaseUrl: '', // Phase 7: Proxy server removed
      metricsBaseUrl: '/metrics',
      gatewayToken: '',
      gatewayPassword: '',
      gatewayDeviceToken: '',
    };

let cached: MissionControlSettings | null = null;
let settingsChangeSubscribed = false;

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
}

function joinBaseUrl(base: string, pathname: string): string {
  if (!base) return pathname;
  return `${normalizeBaseUrl(base)}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

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

  if (cached) {
    cached.proxyBaseUrl = normalizeBaseUrl(cached.proxyBaseUrl);
    cached.metricsBaseUrl = normalizeBaseUrl(cached.metricsBaseUrl);
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

/**
 * @deprecated Proxy server removed in Phase 7. Use gateway client RPC methods instead.
 * Kept for backward compatibility with external callers.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function resolveProxyUrl(_pathname: string) {
  // Phase 7: Proxy server removed. This function returns an empty string
  // which will cause fetch() calls to fail appropriately.
  console.warn('[config] resolveProxyUrl is deprecated. Proxy server removed in Phase 7.');
  return '';
}

export async function resolveMetricsUrl(pathname: string) {
  const s = await getSettings();
  return joinBaseUrl(s.metricsBaseUrl, pathname);
}
