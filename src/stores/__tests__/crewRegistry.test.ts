import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CREW_CONFIG, setCrewConfigForRuntime } from '../../config/crewConfig';
import { useCrewRegistryStore } from '../crewRegistryStore';
import { useGatewayStore } from '../gateway';
import type { StatusData } from '../../api/types';

function makeStatus(recent: StatusData['sessions']['recent']): StatusData {
  return {
    runtimeVersion: 'test',
    sessions: { count: recent.length, recent },
    agents: { defaultId: 'main', agents: [], totalSessions: recent.length },
    memory: {
      agentId: 'main',
      files: 0,
      chunks: 0,
      dirty: false,
      provider: 'test',
      model: 'test',
      cache: { enabled: false, entries: 0 },
      fts: { enabled: false, available: false },
      vector: { enabled: false, available: false, dims: 0 },
    },
    securityAudit: { summary: { critical: 0, warn: 0, info: 0 }, findings: [] },
    channelSummary: [],
    gateway: { mode: 'test', reachable: true, url: 'ws://test' },
    heartbeat: { agents: [] },
  };
}

describe('crew registry/session attribution regression', () => {
  beforeEach(() => {
    setCrewConfigForRuntime(DEFAULT_CREW_CONFIG);
    useCrewRegistryStore.setState({ bySessionId: {}, pendingByRequestId: {}, pendingBySessionKey: {} });
    useGatewayStore.setState({
      sessions: [],
      activeCrew: DEFAULT_CREW_CONFIG.crew.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji, role: c.role, status: 'offline' as const })),
      subagentMappings: new Map(),
      qContextData: null,
      memory: null,
      security: null,
      channels: [],
    });
  });

  it('shows registered subagent, hides unregistered subagent, and keeps Q main session working', () => {
    useCrewRegistryStore.getState().registerPendingSpawn({
      crewId: 'geordi',
      requestId: 'req-geordi-1',
      sessionKey: 'agent:main:subagent:registered-uuid',
      modelRequested: 'openai-codex/gpt-5.3-codex',
      task: 'Fix warp core',
    });
    useCrewRegistryStore.getState().confirmRegistration({
      requestId: 'req-geordi-1',
      sessionKey: 'agent:main:subagent:registered-uuid',
      sessionId: 'registered-session-id',
      modelActive: 'openai-codex/gpt-5.3-codex',
    });

    const status = makeStatus([
      {
        agentId: 'main',
        key: 'agent:main:telegram:direct:test',
        kind: 'active',
        sessionId: 'q-main',
        updatedAt: Date.now(),
        age: 10,
        inputTokens: 1,
        outputTokens: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        remainingTokens: 100,
        percentUsed: 2,
        model: 'hunter-alpha',
        contextTokens: 1024,
        flags: ['active'],
      },
      {
        agentId: 'main',
        key: 'agent:main:subagent:registered-uuid',
        kind: 'active',
        sessionId: 'registered-session-id',
        updatedAt: Date.now(),
        age: 20,
        inputTokens: 1,
        outputTokens: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        remainingTokens: 100,
        percentUsed: 2,
        model: 'openai-codex/gpt-5.3-codex',
        contextTokens: 1024,
        flags: ['active'],
      },
      {
        agentId: 'main',
        key: 'agent:main:subagent:unregistered-uuid',
        kind: 'active',
        sessionId: 'unregistered-session-id',
        updatedAt: Date.now(),
        age: 20,
        inputTokens: 1,
        outputTokens: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        remainingTokens: 100,
        percentUsed: 2,
        model: 'ollama/nemotron-3-super:cloud',
        contextTokens: 1024,
        flags: ['active'],
      },
    ]);

    useGatewayStore.getState().updateStatus(status);

    const activeCrew = useGatewayStore.getState().activeCrew;
    const q = activeCrew.find((c) => c.id === 'q');
    const geordi = activeCrew.find((c) => c.id === 'geordi');
    const data = activeCrew.find((c) => c.id === 'data');

    expect(q?.status).toBe('active');
    expect(q?.model).toBe('hunter-alpha');

    expect(geordi?.status).toBe('active');
    expect(geordi?.model).toBe('openai-codex/gpt-5.3-codex');

    // Unregistered subagent session must not be attributed to Data.
    expect(data?.status).toBe('offline');
  });
});
