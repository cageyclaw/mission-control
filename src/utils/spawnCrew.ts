import { getCrewConfig } from '../config/crewConfig';
import { getSettings } from '../config';

export interface SpawnCrewOptions {
  crewId: string;
  task: string;
  model?: string;
  ownerId?: string;
  label?: string;
}

export interface SpawnCrewResult {
  requestId: string;
  modelRequested?: string;
  modelUsed?: string;
  fallbackUsed: boolean;
  spawnResult: unknown;
  sessionId?: string;
  sessionKey?: string;
}

type SpawnFunction = (input: { label: string; task: string; model?: string; metadata?: Record<string, unknown> }) => Promise<unknown>;

function resolveCrewModelPlan(crewId: string, forcedModel?: string): string[] {
  if (forcedModel) return [forcedModel];
  const crew = getCrewConfig().crew.find((member) => member.id === crewId);
  if (!crew) throw new Error(`Unknown crewId: ${crewId}`);
  const models = [crew.defaultModel, ...(crew.fallbackModels ?? [])].filter((item): item is string => Boolean(item));
  if (models.length === 0) throw new Error(`No model configured for crewId: ${crewId}`);
  return models;
}

function extractSpawnSession(result: unknown): { sessionId?: string; sessionKey?: string } {
  if (!result || typeof result !== 'object') return {};
  const raw = result as Record<string, unknown>;

  const sessionId = typeof raw.sessionId === 'string'
    ? raw.sessionId
    : typeof raw.id === 'string'
      ? raw.id
      : undefined;

  const sessionKey = typeof raw.sessionKey === 'string'
    ? raw.sessionKey
    : typeof raw.key === 'string'
      ? raw.key
      : undefined;

  return { sessionId, sessionKey };
}

export async function spawnCrew(options: SpawnCrewOptions, spawnFn: SpawnFunction): Promise<SpawnCrewResult> {
  const settings = await getSettings();
  const base = (settings.metricsBaseUrl || 'http://127.0.0.1:18790').replace(/\/+$/, '');
  const modelPlan = resolveCrewModelPlan(options.crewId, options.model);

  const intentResponse = await fetch(`${base}/spawn-intent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      crewId: options.crewId,
      task: options.task,
      model: modelPlan[0],
      ownerId: options.ownerId,
    }),
  });

  if (!intentResponse.ok) {
    throw new Error(`spawn-intent failed with HTTP ${intentResponse.status}`);
  }

  const intent = await intentResponse.json() as { requestId?: string };
  if (!intent.requestId) throw new Error('spawn-intent did not return requestId');

  let spawnResult: unknown;
  let modelUsed: string | undefined;
  let fallbackUsed = false;
  let lastError: unknown;

  const baseLabel = options.label ?? options.crewId;

  for (let i = 0; i < modelPlan.length; i += 1) {
    const model = modelPlan[i];
    try {
      spawnResult = await spawnFn({
        label: `${baseLabel} [req:${intent.requestId.slice(0, 8)}]`,
        task: `[crew:${options.crewId} request:${intent.requestId}]\n\n${options.task}`,
        model,
        metadata: {
          crewId: options.crewId,
          requestId: intent.requestId,
          fallbackAttempt: i,
        },
      });
      modelUsed = model;
      fallbackUsed = i > 0;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!spawnResult) {
    throw (lastError instanceof Error ? lastError : new Error('Spawn failed for all configured models'));
  }

  const { sessionId, sessionKey } = extractSpawnSession(spawnResult);

  await fetch(`${base}/spawn-confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      requestId: intent.requestId,
      crewId: options.crewId,
      sessionId,
      sessionKey,
      modelActive: modelUsed,
      fallbackActive: fallbackUsed,
      fallbackCount: fallbackUsed ? 1 : 0,
    }),
  });

  return {
    requestId: intent.requestId,
    modelRequested: modelPlan[0],
    modelUsed,
    fallbackUsed,
    spawnResult,
    sessionId,
    sessionKey,
  };
}
