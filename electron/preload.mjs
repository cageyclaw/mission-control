import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('missionControl', {
  isElectron: true,
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  onSettingsChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('settings:changed', listener);
    return () => ipcRenderer.removeListener('settings:changed', listener);
  },
  confirmAction: (options) => ipcRenderer.invoke('dialog:confirm', options),
  showNotice: (options) => ipcRenderer.invoke('dialog:notice', options),
  reloadWindow: () => ipcRenderer.invoke('app:reload-window'),
});
