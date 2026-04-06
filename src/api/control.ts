/**
 * Control Actions API — Phase 7
 *
 * These control actions (Red Alert, etc.) require elevated permissions.
 * In Phase 7, these actions should be implemented via the gateway control API
 * when available, or through Electron IPC for desktop builds.
 *
 * For web deployment, these actions may not be available.
 */

export interface ControlActionOptions {
  title?: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ControlNoticeOptions {
  title?: string;
  message: string;
  detail?: string;
}

export async function runRedAlertSequence() {
  // Phase 7: Red Alert requires gateway control API or direct CLI access
  // This function is a placeholder - actual implementation depends on
  // the control API availability in the gateway

  console.warn('[Control] Red Alert sequence requires gateway control API');

  // Attempt to use Electron IPC if available
  const missionControl = (window as unknown as { missionControl?: { runRedAlert?: () => Promise<void> } }).missionControl;
  if (missionControl?.runRedAlert) {
    await missionControl.runRedAlert();
    return;
  }

  throw new Error('Red Alert requires gateway control API or Electron app');
}

export async function confirmControlAction(options: ControlActionOptions) {
  const missionControl = (window as unknown as { missionControl?: { confirmAction?: (opts: ControlActionOptions) => Promise<boolean> } }).missionControl;
  if (missionControl?.confirmAction) {
    return missionControl.confirmAction(options);
  }

  const detail = options.detail ? `\n\n${options.detail}` : '';
  return window.confirm(`${options.message}${detail}`);
}

export async function showControlNotice(options: ControlNoticeOptions) {
  const missionControl = (window as unknown as { missionControl?: { showNotice?: (opts: ControlNoticeOptions) => Promise<void> } }).missionControl;
  if (missionControl?.showNotice) {
    await missionControl.showNotice(options);
    return;
  }

  const detail = options.detail ? `\n\n${options.detail}` : '';
  window.alert(`${options.message}${detail}`);
}

export async function reloadControlApp() {
  const missionControl = (window as unknown as { missionControl?: { reloadWindow?: () => Promise<void> } }).missionControl;
  if (missionControl?.reloadWindow) {
    await missionControl.reloadWindow();
    return;
  }

  window.location.reload();
}
