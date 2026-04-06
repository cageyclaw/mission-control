import type { MissionControlSettings } from './config';

declare global {
  interface Window {
    missionControl?: {
      isElectron: boolean;
      getSettings: () => Promise<MissionControlSettings>;
      saveSettings: (settings: Partial<MissionControlSettings>) => Promise<MissionControlSettings>;
      onSettingsChanged: (callback: (settings: MissionControlSettings) => void) => () => void;
      confirmAction: (options: { title?: string; message: string; detail?: string; confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>;
      showNotice: (options: { title?: string; message: string; detail?: string }) => Promise<void>;
      reloadWindow: () => Promise<void>;
    };
  }
}

export {};
