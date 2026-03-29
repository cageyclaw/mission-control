import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const isLinux = process.platform === 'linux';

function getIconPath() {
  const iconFile = isLinux ? 'icon-linux.png' : 'iconTemplate.png';
  const primaryPath = path.resolve(__dirname, '..', 'public', iconFile);
  if (fs.existsSync(primaryPath)) return primaryPath;

  // Fallback so macOS behavior remains intact if Linux icon is missing
  const fallbackPath = path.resolve(__dirname, '..', 'public', 'iconTemplate.png');
  return fs.existsSync(fallbackPath) ? fallbackPath : null;
}

const iconPath = getIconPath();
const APP_ICON = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();

const defaultSettings = {
  gatewayHost: '127.0.0.1',
  gatewayPort: 18789,
  gatewayProtocol: 'ws',
  proxyBaseUrl: 'http://127.0.0.1:5181',
  metricsBaseUrl: 'http://127.0.0.1:18790',
};

let mainWindow = null;
let tray = null;
let proxyProc = null;
let metricsProc = null;
let runtimeSettings = null;

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const p = settingsPath();
    if (!fs.existsSync(p)) return { ...defaultSettings };
    const raw = fs.readFileSync(p, 'utf8');
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

function broadcastSettings(settings) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('settings:changed', settings);
  }
}

function saveSettings(settings) {
  const merged = { ...defaultSettings, ...settings };
  runtimeSettings = merged;
  fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2), 'utf8');
  broadcastSettings(merged);
  return merged;
}

function handleServiceMessage(name, line) {
  if (name !== 'metrics') return;

  try {
    const message = JSON.parse(line);
    if (message?.type === 'metrics-ready' && Number.isInteger(message.port)) {
      const nextSettings = saveSettings({ ...(runtimeSettings ?? loadSettings()), metricsBaseUrl: `http://127.0.0.1:${message.port}` });
      console.log(`[metrics] Updated metricsBaseUrl to ${nextSettings.metricsBaseUrl}`);
    }
  } catch {
    // Ignore non-JSON log lines
  }
}

function spawnService(scriptPath, name) {
  const child = spawn(process.execPath, [scriptPath], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout?.on('data', (d) => {
    const output = String(d);
    console.log(`[${name}] ${output.trim()}`);
    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed) handleServiceMessage(name, trimmed);
    }
  });
  child.stderr?.on('data', (d) => console.error(`[${name}] ${String(d).trim()}`));
  child.on('exit', (code) => console.log(`[${name}] exited ${code}`));

  return child;
}

function startServices() {
  const base = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
  const proxyScript = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'proxy-server.mjs')
    : path.join(base, 'proxy-server.mjs');

  const metricsScript = app.isPackaged
    ? path.join(process.resourcesPath, 'system-metrics-server', 'server.mjs')
    : path.resolve(base, '..', '..', 'system-metrics-server', 'server.mjs');

  if (fs.existsSync(proxyScript)) proxyProc = spawnService(proxyScript, 'proxy');
  else console.error('Proxy script not found:', proxyScript);

  if (fs.existsSync(metricsScript)) metricsProc = spawnService(metricsScript, 'metrics');
  else console.error('Metrics script not found:', metricsScript);
}

function stopServices() {
  for (const proc of [proxyProc, metricsProc]) {
    if (proc && !proc.killed) proc.kill('SIGTERM');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    title: 'Mission Control',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5180');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  try {
    if (!APP_ICON || APP_ICON.isEmpty()) {
      console.warn('[tray] No tray icon available; skipping tray initialization');
      return;
    }

    tray = new Tray(APP_ICON);
    tray.setToolTip('Mission Control');

    const refreshMenu = () => {
      const menu = Menu.buildFromTemplate([
        {
          label: mainWindow?.isVisible() ? 'Hide Mission Control' : 'Show Mission Control',
          click: () => {
            if (!mainWindow) return;
            if (mainWindow.isVisible()) mainWindow.hide();
            else {
              mainWindow.show();
              mainWindow.focus();
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            app.isQuiting = true;
            app.quit();
          },
        },
      ]);
      tray?.setContextMenu(menu);
    };

    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) mainWindow.hide();
      else {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    refreshMenu();
  } catch (error) {
    console.warn('[tray] Failed to create tray; continuing without tray support:', error.message);
    tray = null;
  }
}

app.whenReady().then(() => {
  runtimeSettings = loadSettings();
  startServices();
  createWindow();
  createTray();

  ipcMain.handle('settings:get', () => runtimeSettings ?? loadSettings());
  ipcMain.handle('settings:set', (_event, settings) => saveSettings(settings));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuiting = true;
  stopServices();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
