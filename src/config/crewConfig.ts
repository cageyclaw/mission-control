import type { CrewMember } from '../api/types';

export interface CrewConfigMember {
  id: string;
  name: string;
  emoji: string;
  role: string;
  description?: string;
  isMainSession?: boolean;
  defaultModel?: string;
  fallbackModels?: string[];
}

export interface CrewConfig {
  version: string;
  spawnBehavior: 'explicitRegistration';
  fallbackBehavior: {
    retryDefault: number;
    fallbackDelayMs: number;
    notifyOnFallback: boolean;
  };
  crew: CrewConfigMember[];
}

export const DEFAULT_CREW_CONFIG: CrewConfig = {
  version: '1.0',
  spawnBehavior: 'explicitRegistration',
  fallbackBehavior: {
    retryDefault: 2,
    fallbackDelayMs: 5000,
    notifyOnFallback: true,
  },
  crew: [
    { id: 'q', name: 'Q', emoji: '🧠', role: 'Commander', isMainSession: true },
    { id: 'data', name: 'Data', emoji: '🔍', role: 'Research', defaultModel: 'ollama/nemotron-3-super:cloud', fallbackModels: [] },
    { id: 'geordi', name: 'Geordi', emoji: '🔧', role: 'Code', defaultModel: 'openai-codex/gpt-5.3-codex', fallbackModels: ['ollama/qwen3-coder-next:cloud'] },
    { id: 'spark', name: 'Spark', emoji: '⚡', role: 'Quick Code', defaultModel: 'openai-codex/gpt-5.3-codex-spark', fallbackModels: [] },
    { id: 'riker', name: 'Riker', emoji: '🎯', role: 'QA/Review', defaultModel: 'openai-codex/gpt-5.4', fallbackModels: ['ollama/glm-5:cloud'] },
    { id: 'troi', name: 'Troi', emoji: '💝', role: 'Marketing', defaultModel: 'openai-codex/gpt-5.2', fallbackModels: [] },
    { id: 'barclay', name: 'Barclay', emoji: '🎨', role: 'Art/UX', defaultModel: 'openai-codex/gpt-5.2', fallbackModels: [] },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function validateCrewConfig(raw: unknown): CrewConfig {
  if (!isRecord(raw)) throw new Error('crew-config must be an object');
  if (raw.spawnBehavior !== 'explicitRegistration') throw new Error('spawnBehavior must be explicitRegistration');

  const crew = Array.isArray(raw.crew) ? raw.crew : [];
  if (crew.length === 0) throw new Error('crew must contain members');

  const ids = new Set<string>();
  let mainCount = 0;

  const normalizedCrew: CrewConfigMember[] = crew.map((item) => {
    if (!isRecord(item)) throw new Error('crew member must be object');
    const id = typeof item.id === 'string' ? item.id : '';
    const name = typeof item.name === 'string' ? item.name : '';
    const emoji = typeof item.emoji === 'string' ? item.emoji : '👤';
    const role = typeof item.role === 'string' ? item.role : 'Unknown';
    const isMainSession = Boolean(item.isMainSession);
    const defaultModel = typeof item.defaultModel === 'string' ? item.defaultModel : undefined;
    const fallbackModels = Array.isArray(item.fallbackModels)
      ? item.fallbackModels.filter((m): m is string => typeof m === 'string')
      : [];

    if (!id || !name) throw new Error('crew member requires id and name');
    if (ids.has(id)) throw new Error(`duplicate crew id: ${id}`);
    ids.add(id);

    if (isMainSession) mainCount += 1;
    if (!isMainSession && !defaultModel) throw new Error(`crew member ${id} requires defaultModel`);

    return { id, name, emoji, role, isMainSession, defaultModel, fallbackModels };
  });

  if (mainCount !== 1) throw new Error('exactly one crew member must have isMainSession=true');

  const fb = isRecord(raw.fallbackBehavior) ? raw.fallbackBehavior : {};
  const retryDefault = typeof fb.retryDefault === 'number' && fb.retryDefault >= 0 ? fb.retryDefault : 0;
  const fallbackDelayMs = typeof fb.fallbackDelayMs === 'number' && fb.fallbackDelayMs >= 0 ? fb.fallbackDelayMs : 0;
  const notifyOnFallback = Boolean(fb.notifyOnFallback);

  return {
    version: typeof raw.version === 'string' ? raw.version : '1.0',
    spawnBehavior: 'explicitRegistration',
    fallbackBehavior: { retryDefault, fallbackDelayMs, notifyOnFallback },
    crew: normalizedCrew,
  };
}

let cachedConfig: CrewConfig = DEFAULT_CREW_CONFIG;
let degraded = false;
let loaded = false;
let reloading: Promise<CrewConfig> | null = null;
let focusReloadWired = false;
const configListeners = new Set<(config: CrewConfig) => void>();

function emitCrewConfigChanged(config: CrewConfig): void {
  configListeners.forEach((listener) => {
    try {
      listener(config);
    } catch (error) {
      console.warn('[CrewConfig] config change listener failed:', error);
    }
  });
}

export function setCrewConfigForRuntime(raw: unknown): CrewConfig {
  try {
    cachedConfig = validateCrewConfig(raw);
    degraded = false;
  } catch (error) {
    console.warn('[CrewConfig] Invalid crew-config, falling back to defaults:', error);
    cachedConfig = DEFAULT_CREW_CONFIG;
    degraded = true;
  }
  emitCrewConfigChanged(cachedConfig);
  return cachedConfig;
}

export function getCrewConfig(): CrewConfig {
  return cachedConfig;
}

export function isCrewConfigDegraded(): boolean {
  return degraded;
}

async function fetchCrewConfig(): Promise<CrewConfig> {
  if (reloading) return reloading;

  reloading = (async () => {
    try {
      const response = await fetch('/crew-config.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json();
      setCrewConfigForRuntime(raw);
    } catch (error) {
      console.warn('[CrewConfig] Failed to load crew-config.json, using defaults:', error);
      setCrewConfigForRuntime(DEFAULT_CREW_CONFIG);
    }

    loaded = true;
    return cachedConfig;
  })();

  try {
    return await reloading;
  } finally {
    reloading = null;
  }
}

export async function loadCrewConfig(forceReload = false): Promise<CrewConfig> {
  if (loaded && !forceReload) return cachedConfig;
  return fetchCrewConfig();
}

export async function reloadCrewConfig(): Promise<CrewConfig> {
  return loadCrewConfig(true);
}

export function wireCrewConfigRuntimeReload(): void {
  if (focusReloadWired || typeof window === 'undefined') return;

  const triggerReload = () => {
    void reloadCrewConfig();
  };

  window.addEventListener('focus', triggerReload);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') triggerReload();
  });

  focusReloadWired = true;
}

export function onCrewConfigChanged(listener: (config: CrewConfig) => void): () => void {
  configListeners.add(listener);
  return () => {
    configListeners.delete(listener);
  };
}

export function resetCrewConfigRuntimeForTests(): void {
  cachedConfig = DEFAULT_CREW_CONFIG;
  degraded = false;
  loaded = false;
  reloading = null;
  focusReloadWired = false;
  configListeners.clear();
}

export function getCrewMembersBase(): CrewMember[] {
  return getCrewConfig().crew.map((member) => ({
    id: member.id,
    name: member.name,
    emoji: member.emoji,
    role: member.role,
    status: 'offline' as const,
  }));
}
