import type { MissionControlSettings } from './config';

declare global {
  interface Window {
    missionControl?: {
      isElectron: boolean;
      getSettings: () => Promise<MissionControlSettings>;
      saveSettings: (settings: Partial<MissionControlSettings>) => Promise<MissionControlSettings>;
      onSettingsChanged: (callback: (settings: MissionControlSettings) => void) => () => void;
    };
  }
}

export {};
