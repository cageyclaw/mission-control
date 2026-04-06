import { getSettings, saveSettings } from '../config';

export interface DeviceIdentity {
  id: string;
  publicKey: string;
  privateKey: string;
}

export interface SignedDevicePayload {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce: string;
}

export interface DeviceAuthSignatureParams {
  nonce: string;
  token?: string | null;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  platform: string;
  deviceFamily?: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const data = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return hex(new Uint8Array(digest));
}

function normalizeDeviceMetadataForAuth(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

function buildDeviceAuthPayloadV3(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
  platform: string;
  deviceFamily?: string;
}): string {
  const scopes = params.scopes.join(',');
  const token = params.token ?? '';
  const platform = normalizeDeviceMetadataForAuth(params.platform);
  const deviceFamily = normalizeDeviceMetadataForAuth(params.deviceFamily);

  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join('|');
}

async function generateDeviceIdentity(): Promise<DeviceIdentity> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'Ed25519',
    },
    true,
    ['sign', 'verify'],
  );

  const exportedPrivateKey = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
  const exportedPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  const id = await sha256(exportedPublicKey);

  return {
    id,
    publicKey: bytesToBase64Url(exportedPublicKey),
    privateKey: bytesToBase64Url(exportedPrivateKey),
  };
}

export async function getOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  const settings = await getSettings();
  if (settings.deviceIdentity?.id && settings.deviceIdentity.publicKey && settings.deviceIdentity.privateKey) {
    return settings.deviceIdentity;
  }

  const identity = await generateDeviceIdentity();
  await saveSettings({ deviceIdentity: identity });
  return identity;
}

export async function signGatewayChallenge(params: DeviceAuthSignatureParams): Promise<SignedDevicePayload> {
  const identity = await getOrCreateDeviceIdentity();
  const signedAt = Date.now();
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    base64UrlToArrayBuffer(identity.privateKey),
    {
      name: 'Ed25519',
    },
    false,
    ['sign'],
  );

  const payload = buildDeviceAuthPayloadV3({
    deviceId: identity.id,
    clientId: params.clientId,
    clientMode: params.clientMode,
    role: params.role,
    scopes: params.scopes,
    signedAtMs: signedAt,
    token: params.token ?? '',
    nonce: params.nonce,
    platform: params.platform,
    deviceFamily: params.deviceFamily,
  });

  const signature = await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(payload));

  return {
    id: identity.id,
    publicKey: identity.publicKey,
    signature: bytesToBase64Url(new Uint8Array(signature)),
    signedAt,
    nonce: params.nonce,
  };
}
