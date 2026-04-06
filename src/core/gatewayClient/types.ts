export type JsonObject = Record<string, unknown>;

export interface GatewayClientInfo {
  id: string;
  displayName: string;
  version: string;
  platform: string;
  deviceFamily: 'desktop' | 'browser' | string;
  mode: string;
  instanceId?: string;
}

export interface GatewayAuthConfig {
  token?: string;
  password?: string;
  deviceToken?: string;
  role: string;
  scopes: string[];
}

export interface GatewayBootstrapConfig {
  wsUrl: string;
  client: GatewayClientInfo;
  auth: GatewayAuthConfig;
  protocol: {
    min: number;
    max: number;
  };
  caps?: string[];
  userAgent?: string;
  locale?: string;
}

export interface GatewayConnectPayload {
  minProtocol: number;
  maxProtocol: number;
  client: GatewayClientInfo;
  role: string;
  scopes: string[];
  caps?: string[];
  userAgent?: string;
  locale?: string;
  nonce?: string;
  auth?: {
    token?: string;
    password?: string;
    deviceToken?: string;
  };
  device?: GatewayDeviceProof;
}

export interface GatewayHelloPayload {
  protocol?: number;
  sessionId?: string;
  operatorId?: string;
  serverVersion?: string;
  instanceId?: string;
  capabilities?: JsonObject;
  [key: string]: unknown;
}

export interface GatewayRpcRequest {
  type: 'req';
  id: string;
  method: string;
  params?: JsonObject;
}

export interface GatewayRpcResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message?: string;
    [key: string]: unknown;
  };
}

export interface GatewayEventFrame {
  type: 'event';
  event: string;
  payload?: unknown;
  agentId?: string;
  sessionKey?: string;
  seq?: number;
}

export type GatewayIncomingFrame = GatewayRpcResponse | GatewayEventFrame | JsonObject;

export interface GatewayClientOptions {
  requestTimeoutMs?: number;
  reconnect?: boolean;
  reconnectMinDelayMs?: number;
  reconnectMaxDelayMs?: number;
  reconnectJitterRatio?: number;
  challengeWaitMs?: number;
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}

export interface GatewayChallengePayload {
  nonce?: string;
  challenge?: string;
  token?: string;
  value?: string;
  [key: string]: unknown;
}

export interface GatewayDeviceProof {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce: string;
}

export interface GatewaySessionsListParams {
  includeGlobal?: boolean;
  includeUnknown?: boolean;
  activeMinutes?: number;
  limit?: number;
  [key: string]: unknown;
}

export interface GatewayChatSendOptions {
  runId?: string;
  idempotencyKey?: string;
  deliver?: boolean;
  // Attachments intentionally omitted in Phase 1.5 transport pass.
}

export type GatewayConnectionState = 'idle' | 'connecting' | 'authenticating' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
