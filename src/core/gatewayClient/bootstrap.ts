import { getSettings, resolveGatewayWsUrl } from '../../config';
import type { GatewayBootstrapConfig } from './types';

function detectPlatform(): string {
  const raw = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? 'unknown';
  const normalized = raw.toLowerCase();
  if (normalized.includes('mac')) return 'macos';
  if (normalized.includes('win')) return 'windows';
  if (normalized.includes('linux')) return 'linux';
  return normalized || 'unknown';
}

function detectDeviceFamily(): 'desktop' | 'browser' {
  return window.missionControl?.isElectron ? 'desktop' : 'browser';
}

function detectLocale(): string {
  return (navigator.language || 'en').toLowerCase();
}

function detectUserAgent(): string {
  return navigator.userAgent || 'mission-control';
}

function buildInstanceId(): string {
  const base = `${detectDeviceFamily()}-${detectPlatform()}`;
  return `mission-control:${base}`;
}

export async function loadGatewayBootstrapConfig(): Promise<GatewayBootstrapConfig> {
  const [settings, wsUrl] = await Promise.all([getSettings(), resolveGatewayWsUrl()]);
  const token = settings.gatewayToken?.trim() || undefined;
  const password = settings.gatewayPassword?.trim() || undefined;
  const deviceToken = settings.gatewayDeviceToken?.trim() || undefined;

  return {
    wsUrl,
    protocol: {
      min: 3,
      max: 3,
    },
    caps: ['tool-events'],
    userAgent: detectUserAgent(),
    locale: detectLocale(),
    client: {
      id: 'openclaw-control-ui',
      displayName: 'Mission Control',
      version: import.meta.env.VITE_APP_VERSION ?? '0.1.0',
      platform: detectPlatform(),
      deviceFamily: detectDeviceFamily(),
      mode: 'webchat',
      instanceId: buildInstanceId(),
    },
    auth: {
      token,
      password,
      deviceToken,
      role: 'operator',
      scopes: ['operator.read', 'operator.write', 'control.read', 'control.write'],
    },
  };
}
