import { signGatewayChallenge } from '../../api/device-auth';
import { TypedEventBus } from './events';
import type {
  GatewayBootstrapConfig,
  GatewayChatSendOptions,
  GatewayClientOptions,
  GatewayConnectionState,
  GatewayConnectPayload,
  GatewayDeviceProof,
  GatewayEventFrame,
  GatewayHelloPayload,
  GatewayIncomingFrame,
  GatewayRpcRequest,
  GatewayRpcResponse,
  GatewaySessionsListParams,
  JsonObject,
} from './types';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type ClientEvents = {
  state: GatewayConnectionState;
  event: GatewayEventFrame;
  reconnect: { attempt: number; delayMs: number };
  seqGap: { previousSeq: number; currentSeq: number; missed: number };
};

const DEFAULTS: Required<Pick<GatewayClientOptions, 'requestTimeoutMs' | 'reconnect' | 'reconnectMinDelayMs' | 'reconnectMaxDelayMs' | 'reconnectJitterRatio' | 'challengeWaitMs'>> = {
  requestTimeoutMs: 15000,
  reconnect: true,
  reconnectMinDelayMs: 800,
  reconnectMaxDelayMs: 15000,
  reconnectJitterRatio: 0.3,
  challengeWaitMs: 1200,
};

function asRecord(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null ? (value as JsonObject) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function extractNonce(payload: unknown): string | null {
  const raw = asRecord(payload);
  if (!raw) return null;

  const challenge = asRecord(raw.payload) ?? raw;
  return asString(challenge.nonce) ?? asString(challenge.challenge) ?? asString(challenge.token) ?? asString(challenge.value);
}

function createRpcError(method: string, frame: GatewayRpcResponse): Error {
  const code = frame.error?.code;
  const message = frame.error?.message ?? `Gateway request failed (${frame.id})`;
  const err = new Error(message) as Error & { code?: string; method?: string };
  err.code = code;
  err.method = method;
  return err;
}

function isAuthFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('unauthorized')
    || message.includes('forbidden')
    || message.includes('auth')
    || message.includes('401')
    || message.includes('403')
  );
}

export class NativeGatewayClient {
  private readonly options: GatewayClientOptions;
  private readonly logger: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
  private readonly bus = new TypedEventBus<ClientEvents>();
  private readonly eventListeners = new Map<string, Set<(frame: GatewayEventFrame) => void>>();
  private readonly pending = new Map<string, PendingRequest>();
  private readonly pendingMethods = new Map<string, string>();
  private readonly bootstrapLoader: () => Promise<GatewayBootstrapConfig>;

  private ws: WebSocket | null = null;
  private state: GatewayConnectionState = 'idle';
  private connectPromise: Promise<void> | null = null;
  private bootstrap: GatewayBootstrapConfig | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = true;
  private lastChallengeNonce: string | null = null;
  private challengeWaiter: {
    resolve: (nonce: string) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private lastHello: GatewayHelloPayload | null = null;
  private lastEventSeq: number | null = null;

  constructor(
    bootstrapLoader: () => Promise<GatewayBootstrapConfig>,
    options: GatewayClientOptions = {},
  ) {
    this.bootstrapLoader = bootstrapLoader;
    this.options = { ...DEFAULTS, ...options };
    this.logger = options.logger ?? console;
  }

  get connectionState(): GatewayConnectionState {
    return this.state;
  }

  get hello(): GatewayHelloPayload | null {
    return this.lastHello;
  }

  onState(listener: (state: GatewayConnectionState) => void): () => void {
    return this.bus.on('state', listener);
  }

  onReconnect(listener: (meta: { attempt: number; delayMs: number }) => void): () => void {
    return this.bus.on('reconnect', listener);
  }

  onSeqGap(listener: (gap: { previousSeq: number; currentSeq: number; missed: number }) => void): () => void {
    return this.bus.on('seqGap', listener);
  }

  onEvent(eventName: string, listener: (frame: GatewayEventFrame) => void): () => void {
    const listeners = this.eventListeners.get(eventName) ?? new Set<(frame: GatewayEventFrame) => void>();
    listeners.add(listener);
    this.eventListeners.set(eventName, listeners);

    return () => {
      const current = this.eventListeners.get(eventName);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.eventListeners.delete(eventName);
    };
  }

  async connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;

    this.shouldReconnect = this.options.reconnect ?? true;
    this.connectPromise = this.openAndAuthenticate();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.resetLifecycleState('Gateway disconnected');
    this.rejectAllPending(new Error('Gateway disconnected'));

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
  }

  async request<T = unknown>(method: string, params: JsonObject = {}): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway socket is not connected.');
    }

    const id = crypto.randomUUID();
    const frame: GatewayRpcRequest = { type: 'req', id, method, params };

    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.pendingMethods.delete(id);
        reject(new Error(`Gateway request timed out for method: ${method}`));
      }, this.options.requestTimeoutMs ?? DEFAULTS.requestTimeoutMs);

      this.pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
      this.pendingMethods.set(id, method);
      this.ws?.send(JSON.stringify(frame));
    });
  }

  async sessionsSubscribe(): Promise<void> {
    await this.request('sessions.subscribe');
  }

  async sessionsList(params: GatewaySessionsListParams = {}): Promise<unknown> {
    return await this.request('sessions.list', params);
  }

  async chatHistory(sessionKey: string, limit?: number): Promise<unknown> {
    return await this.request('chat.history', {
      sessionKey,
      ...(typeof limit === 'number' ? { limit } : {}),
    });
  }

  async chatSend(sessionKey: string, text: string, options: GatewayChatSendOptions = {}): Promise<unknown> {
    return await this.request('chat.send', {
      sessionKey,
      message: text,
      idempotencyKey: options.idempotencyKey ?? crypto.randomUUID(),
      deliver: options.deliver ?? false,
      // Note: runId is NOT sent - gateway generates its own
      // Attachments intentionally omitted in Phase 1.5 transport pass.
    });
  }

  async chatAbort(sessionKey: string, runId?: string): Promise<unknown> {
    return await this.request('chat.abort', {
      sessionKey,
      deliver: false,
      ...(runId ? { runId } : {}),
    });
  }

  async health(): Promise<unknown> {
    return await this.request('health');
  }

  async status(): Promise<unknown> {
    return await this.request('status');
  }

  private async openAndAuthenticate(): Promise<void> {
    this.bootstrap = await this.bootstrapLoader();
    this.resetLifecycleState();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    try {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(this.bootstrap!.wsUrl);
        this.ws = ws;

        ws.addEventListener('open', async () => {
          try {
            this.setState('authenticating');
            await this.authenticate();
            this.reconnectAttempt = 0;
            this.setState('connected');
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        ws.addEventListener('message', (event) => {
          this.handleIncoming(event.data);
        });

        ws.addEventListener('close', () => {
          this.ws = null;
          this.resetLifecycleState('Gateway socket closed before challenge completed');
          this.rejectAllPending(new Error('Gateway socket closed'));
          if (this.shouldReconnect && (this.options.reconnect ?? true)) {
            this.scheduleReconnect();
            return;
          }
          this.setState('disconnected');
        });

        ws.addEventListener('error', () => {
          this.setState('error');
        });
      });
    } catch (error) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }

      const authFailure = isAuthFailure(error);
      if (authFailure) {
        this.shouldReconnect = false;
        this.logger.error('[gatewayClient] authentication failed; reconnect disabled until explicit connect()', error);
      }

      this.setState('error');
      if (!authFailure && this.shouldReconnect && (this.options.reconnect ?? true)) {
        this.scheduleReconnect();
      }

      throw error;
    }
  }

  private async authenticate(): Promise<void> {
    if (!this.bootstrap) throw new Error('Gateway bootstrap config unavailable.');

    const nonce = await this.getChallengeNonce();
    const authPayload = this.buildAuthPayload();
    const device = nonce ? await this.signChallenge(nonce) : undefined;

    const params: GatewayConnectPayload = {
      minProtocol: this.bootstrap.protocol.min,
      maxProtocol: this.bootstrap.protocol.max,
      client: this.bootstrap.client,
      role: this.bootstrap.auth.role,
      scopes: this.bootstrap.auth.scopes,
      ...(this.bootstrap.caps ? { caps: this.bootstrap.caps } : {}),
      ...(this.bootstrap.userAgent ? { userAgent: this.bootstrap.userAgent } : {}),
      ...(this.bootstrap.locale ? { locale: this.bootstrap.locale } : {}),
      // Note: nonce is NOT sent to gateway; it's used to create the signed device proof only
      ...(authPayload ? { auth: authPayload } : {}),
      ...(device ? { device } : {}),
    };

    const hello = await this.request<GatewayHelloPayload>('connect', params as unknown as JsonObject);
    this.lastHello = asRecord(hello) as GatewayHelloPayload | null;
  }

  private buildAuthPayload(): { token?: string; password?: string; deviceToken?: string } | undefined {
    if (!this.bootstrap) return undefined;
    const token = this.bootstrap.auth.token?.trim();
    const password = this.bootstrap.auth.password?.trim();
    const deviceToken = this.bootstrap.auth.deviceToken?.trim();

    const auth = {
      ...(token ? { token } : {}),
      ...(password ? { password } : {}),
      ...(deviceToken ? { deviceToken } : {}),
    };

    return Object.keys(auth).length > 0 ? auth : undefined;
  }

  private async getChallengeNonce(): Promise<string | null> {
    const eventNonce = await this.waitForChallengeEvent();
    if (eventNonce) return eventNonce;

    // Compatibility fallback only; event-driven challenge is primary.
    return await this.requestChallengeNonceViaRpc();
  }

  private async waitForChallengeEvent(): Promise<string | null> {
    if (this.lastChallengeNonce) {
      const nonce = this.lastChallengeNonce;
      this.lastChallengeNonce = null;
      return nonce;
    }

    return await new Promise<string | null>((resolve) => {
      const waitMs = this.options.challengeWaitMs ?? DEFAULTS.challengeWaitMs;
      const timer = setTimeout(() => {
        if (this.challengeWaiter) {
          this.challengeWaiter = null;
        }
        resolve(null);
      }, waitMs);

      this.challengeWaiter = {
        resolve: (nonce) => {
          clearTimeout(timer);
          this.challengeWaiter = null;
          resolve(nonce);
        },
        reject: () => {
          clearTimeout(timer);
          this.challengeWaiter = null;
          resolve(null);
        },
        timer,
      };
    });
  }

  private async requestChallengeNonceViaRpc(): Promise<string | null> {
    if (!this.bootstrap) throw new Error('Gateway bootstrap config unavailable.');

    try {
      const payload = await this.request('connect.challenge', {
        client: this.bootstrap.client,
        role: this.bootstrap.auth.role,
        scopes: this.bootstrap.auth.scopes,
        ...(this.bootstrap.caps ? { caps: this.bootstrap.caps } : {}),
        ...(this.bootstrap.userAgent ? { userAgent: this.bootstrap.userAgent } : {}),
        ...(this.bootstrap.locale ? { locale: this.bootstrap.locale } : {}),
        ...(this.buildAuthPayload() ? { auth: this.buildAuthPayload() } : {}),
      });

      return extractNonce(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('method') && message.includes('not found')) {
        this.logger.debug('[gatewayClient] connect.challenge RPC not supported by gateway; continuing with direct connect.');
        return null;
      }
      throw error;
    }
  }

  private async signChallenge(nonce: string): Promise<GatewayDeviceProof> {
    if (!this.bootstrap) throw new Error('Gateway bootstrap config unavailable.');

    return await signGatewayChallenge({
      nonce,
      token: this.bootstrap.auth.token,
      clientId: this.bootstrap.client.id,
      clientMode: this.bootstrap.client.mode,
      role: this.bootstrap.auth.role,
      scopes: this.bootstrap.auth.scopes,
      platform: this.bootstrap.client.platform,
      deviceFamily: this.bootstrap.client.deviceFamily,
    });
  }

  private handleIncoming(raw: unknown): void {
    let frame: GatewayIncomingFrame;
    try {
      frame = JSON.parse(String(raw)) as GatewayIncomingFrame;
    } catch (error) {
      this.logger.warn('[gatewayClient] Failed to parse gateway frame', error);
      return;
    }

    const data = asRecord(frame);
    if (!data) return;

    if (data.type === 'res') {
      this.handleResponse(data as unknown as GatewayRpcResponse);
      return;
    }

    if (data.type === 'event' && typeof data.event === 'string') {
      this.dispatchEvent(data as unknown as GatewayEventFrame);
    }
  }

  private handleResponse(frame: GatewayRpcResponse): void {
    const pending = this.pending.get(frame.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(frame.id);

    const method = this.pendingMethods.get(frame.id) ?? 'unknown';
    this.pendingMethods.delete(frame.id);

    if (frame.ok) {
      pending.resolve(frame.payload);
      return;
    }

    pending.reject(createRpcError(method, frame));
  }

  private dispatchEvent(frame: GatewayEventFrame): void {
    if (frame.event === 'connect.challenge') {
      const nonce = extractNonce(frame.payload);
      if (nonce) {
        this.lastChallengeNonce = nonce;
        if (this.challengeWaiter) {
          this.challengeWaiter.resolve(nonce);
        }
      }
    }

    if (typeof frame.seq === 'number' && Number.isFinite(frame.seq)) {
      if (this.lastEventSeq !== null && frame.seq > this.lastEventSeq + 1) {
        const gap = {
          previousSeq: this.lastEventSeq,
          currentSeq: frame.seq,
          missed: frame.seq - this.lastEventSeq - 1,
        };
        this.bus.emit('seqGap', gap);
        this.logger.warn('[gatewayClient] event sequence gap detected', gap);
      }
      this.lastEventSeq = frame.seq;
    }

    this.bus.emit('event', frame);

    const exact = this.eventListeners.get(frame.event);
    if (exact) {
      for (const listener of exact) listener(frame);
    }

    const wildcard = this.eventListeners.get('*');
    if (wildcard) {
      for (const listener of wildcard) listener(frame);
    }
  }

  private resetLifecycleState(reason?: string): void {
    this.lastChallengeNonce = null;
    this.lastHello = null;
    this.lastEventSeq = null;

    if (this.challengeWaiter) {
      clearTimeout(this.challengeWaiter.timer);
      if (reason) {
        this.challengeWaiter.reject(new Error(reason));
      }
      this.challengeWaiter = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectAttempt += 1;
    const min = this.options.reconnectMinDelayMs ?? DEFAULTS.reconnectMinDelayMs;
    const max = this.options.reconnectMaxDelayMs ?? DEFAULTS.reconnectMaxDelayMs;
    const jitter = this.options.reconnectJitterRatio ?? DEFAULTS.reconnectJitterRatio;

    const exponential = Math.min(max, min * 2 ** Math.max(0, this.reconnectAttempt - 1));
    const randomized = exponential * (1 - jitter + Math.random() * jitter * 2);
    const delayMs = Math.max(min, Math.round(randomized));

    this.bus.emit('reconnect', { attempt: this.reconnectAttempt, delayMs });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openAndAuthenticate().catch((error) => {
        this.logger.error('[gatewayClient] reconnect failed', error);
        if (!isAuthFailure(error)) {
          this.scheduleReconnect();
        }
      });
    }, delayMs);
  }

  private setState(next: GatewayConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.bus.emit('state', next);
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
      this.pendingMethods.delete(id);
    }
  }
}
