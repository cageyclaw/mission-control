let pendingRefresh = false;
let refreshInFlight: Promise<void> | null = null;

async function runImmediateRefresh(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = import('./sessionsStore')
    .then(async ({ useSessionsStore }) => {
      await useSessionsStore.getState().refreshSessions();
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function requestAuthoritativeSessionsRefresh(): Promise<void> {
  const { useSessionsStore } = await import('./sessionsStore');
  const sessionsState = useSessionsStore.getState();

  if (!sessionsState.initialized) {
    pendingRefresh = true;
    return;
  }

  await runImmediateRefresh();
}

export async function flushPendingAuthoritativeSessionsRefresh(): Promise<void> {
  if (!pendingRefresh) return;

  pendingRefresh = false;
  await runImmediateRefresh();
}
