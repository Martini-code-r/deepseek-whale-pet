'use strict';

const fsBoot = require('fs');
const pathBoot = require('path');
const BOOT_LOG = pathBoot.join(__dirname, '.userdata', 'boot.log');
const DEBUG = process.env.PET_DEBUG === '1';
function bootLog(message) {
  if (!DEBUG) return;
  try {
    fsBoot.mkdirSync(pathBoot.dirname(BOOT_LOG), { recursive: true });
    fsBoot.appendFileSync(BOOT_LOG, `${new Date().toISOString()} ${message}\n`);
  } catch {}
}
if (DEBUG) {
  try { fsBoot.writeFileSync(BOOT_LOG, ''); } catch {}
}
bootLog(`main.js loaded | argv=${JSON.stringify(process.argv)} | ELECTRON_RUN_AS_NODE=${process.env.ELECTRON_RUN_AS_NODE}`);

process.on('uncaughtException', (err) => {
  bootLog(`uncaughtException: ${err && err.stack}`);
});
process.on('unhandledRejection', (err) => {
  bootLog(`unhandledRejection: ${err && err.stack}`);
});
process.on('exit', (code) => {
  bootLog(`process exit ${code}`);
});

const electron = require('electron');
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell } = electron;
const path = require('path');
const fs = require('fs');
bootLog('electron modules required');

// Portable user data: keeps the pet's position/settings next to the app and
// avoids host-shell ACL restrictions on %APPDATA%.
const USER_DATA = path.join(__dirname, '.userdata');
try { fs.mkdirSync(USER_DATA, { recursive: true }); } catch {}
app.setPath('userData', USER_DATA);
app.setPath('sessionData', path.join(USER_DATA, 'session'));

const ROOT = __dirname;
const BASE_WIDTH = 310;
const BASE_HEIGHT = 400;
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.25;
const ASSETS = path.join(ROOT, 'assets');
const IS_SMOKE = process.env.PET_SMOKE === '1' || process.argv.includes('--smoke');
const PET_WIDTH = 180;
const PET_BOTTOM = 10;
const PET_ASPECT = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ASSETS, 'art-meta.json'), 'utf8')).aspect || 1.0383;
  } catch {
    return 1.0383;
  }
})();

let alphaMask = null;
try {
  const source = fs.readFileSync(path.join(ASSETS, 'alpha-mask.js'), 'utf8');
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start >= 0 && end > start) alphaMask = JSON.parse(source.slice(start, end + 1));
} catch (err) {
  console.error('alpha mask unavailable:', err.message);
}

let win = null;
let tray = null;
let quitting = false;
let dragState = null;
let saveTimer = null;
let smokeStarted = false;
let cursorTimer = null;
let uiState = { bubble: null, dock: null, modal: false };
let lastInteractive = null;
let isPrimary = false;

const defaultConfig = {
  x: null,
  y: null,
  scale: 1,
  alwaysOnTop: true,
  sound: true,
  autoStart: false,
  clickCount: 0
};

function configPath() {
  return path.join(app.getPath('userData'), 'pet-config.json');
}

const PID_FILE = path.join(USER_DATA, 'pet.pid');
const SHOW_REQUEST = path.join(USER_DATA, 'show.request');
let showRequestTimer = null;

function claimProcessLock() {
  try {
    const oldPid = Number(fs.readFileSync(PID_FILE, 'utf8').trim());
    if (oldPid && oldPid !== process.pid) {
      try {
        process.kill(oldPid, 0);
        bootLog(`another pet is already running: pid ${oldPid}`);
        try { fs.writeFileSync(SHOW_REQUEST, '1'); } catch {}
        app.quit();
        return false;
      } catch (err) {
        if (err && err.code === 'EPERM') {
          bootLog(`another pet is already running (EPERM): pid ${oldPid}`);
          try { fs.writeFileSync(SHOW_REQUEST, '1'); } catch {}
          app.quit();
          return false;
        }
      }
    }
  } catch {}
  try { fs.writeFileSync(PID_FILE, String(process.pid), 'utf8'); } catch {}
  return true;
}

function watchShowRequests() {
  clearInterval(showRequestTimer);
  showRequestTimer = setInterval(() => {
    try {
      if (fs.existsSync(SHOW_REQUEST)) {
        fs.unlinkSync(SHOW_REQUEST);
        showPet();
      }
    } catch {}
  }, 700);
}

function releaseProcessLock() {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8').trim());
    if (pid === process.pid) fs.unlinkSync(PID_FILE);
  } catch {}
}

let config = { ...defaultConfig };

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    config = { ...defaultConfig, ...raw };
    config.scale = clamp(Number(config.scale) || 1, MIN_SCALE, MAX_SCALE);
  } catch {
    config = { ...defaultConfig };
  }
}

function writeConfig() {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeConfig, 180);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function insideRect(rect, x, y) {
  if (!rect) return false;
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function petHitTest(winX, winY, bounds) {
  const scale = bounds.width / BASE_WIDTH;
  const petW = PET_WIDTH * scale;
  const petH = petW * PET_ASPECT;
  const left = (bounds.width - petW) / 2;
  const top = bounds.height - PET_BOTTOM * scale - petH;
  if (winX < left || winX > left + petW || winY < top || winY > top + petH) return false;
  if (!alphaMask || !alphaMask.data) return true;
  const mx = Math.floor(((winX - left) / petW) * alphaMask.w);
  const my = Math.floor(((winY - top) / petH) * alphaMask.h);
  if (mx < 0 || my < 0 || mx >= alphaMask.w || my >= alphaMask.h) return false;
  return alphaMask.data[my * alphaMask.w + mx] === '1';
}

function setInteractive(next) {
  if (lastInteractive === next) return;
  lastInteractive = next;
  bootLog(`interactive=${next}`);
  if (!win || win.isDestroyed()) return;
  win.setIgnoreMouseEvents(!next, { forward: true });
  win.webContents.send('hover-state', { interactive: next });
}

function updateCursorInteractive() {
  if (!win || win.isDestroyed() || !win.isVisible()) return;
  if (dragState || uiState.modal) {
    setInteractive(true);
    return;
  }
  const cursor = screen.getCursorScreenPoint();
  const bounds = win.getBounds();
  const x = cursor.x - bounds.x;
  const y = cursor.y - bounds.y;
  if (x < -2 || y < -2 || x > bounds.width + 2 || y > bounds.height + 2) {
    setInteractive(false);
    return;
  }
  const hit =
    petHitTest(x, y, bounds) ||
    insideRect(uiState.bubble, x, y) ||
    insideRect(uiState.dock, x, y);
  if (hit !== lastInteractive) bootLog(`cursor ${Math.round(x)},${Math.round(y)} hit=${hit} pet=${petHitTest(x, y, bounds)} bubble=${insideRect(uiState.bubble, x, y)} dock=${insideRect(uiState.dock, x, y)} modal=${uiState.modal}`);
  setInteractive(hit);
}

function startCursorWatch() {
  clearInterval(cursorTimer);
  cursorTimer = setInterval(updateCursorInteractive, 40);
  updateCursorInteractive();
}

function workAreaFor(x, y) {
  return screen.getDisplayNearestPoint({ x, y }).workArea;
}

function clampToVisible(x, y, w, h) {
  const area = workAreaFor(x + Math.round(w / 2), y + Math.round(h / 2));
  const edge = 4;
  return {
    x: clamp(x, area.x - edge, area.x + area.width - w + edge),
    y: clamp(y, area.y - edge, area.y + area.height - h + edge)
  };
}

function applyPosition(x, y, w, h) {
  const p = clampToVisible(Math.round(x), Math.round(y), w, h);
  win.setPosition(p.x, p.y, false);
  config.x = p.x;
  config.y = p.y;
  scheduleSave();
}

function defaultPosition(w, h) {
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: area.x + area.width - w - 22,
    y: area.y + area.height - h - 8
  };
}

function currentSize(scale = config.scale) {
  return {
    width: Math.round(BASE_WIDTH * scale),
    height: Math.round(BASE_HEIGHT * scale)
  };
}

function maxScaleForArea(area) {
  return Math.max(
    MIN_SCALE,
    Math.min(MAX_SCALE, (area.width - 24) / BASE_WIDTH, (area.height - 20) / BASE_HEIGHT)
  );
}

function createWindow() {
  const primaryArea = screen.getPrimaryDisplay().workArea;
  const fitScale = Math.floor(maxScaleForArea(primaryArea) * 100) / 100;
  if (config.scale > fitScale) {
    config.scale = Math.max(MIN_SCALE, fitScale);
    scheduleSave();
  }
  const size = currentSize();
  const fallback = defaultPosition(size.width, size.height);
  const safeStart = clampToVisible(
    Number.isFinite(config.x) ? config.x : fallback.x,
    Number.isFinite(config.y) ? config.y : fallback.y,
    size.width,
    size.height
  );
  const startX = safeStart.x;
  const startY = safeStart.y;

  win = new BrowserWindow({
    width: size.width,
    height: size.height,
    x: startX,
    y: startY,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: config.alwaysOnTop,
    icon: path.join(ASSETS, 'pet.ico'),
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  if (config.alwaysOnTop) win.setAlwaysOnTop(true, 'floating');
  win.setMenuBarVisibility(false);
  win.setAutoHideMenuBar(true);
  win.loadFile(path.join(ROOT, 'index.html'));
  bootLog('loadFile called');

  win.once('ready-to-show', () => {
    bootLog('ready-to-show');
    win.showInactive();
    win.moveTop();
    bootLog(`after showInactive visible=${win.isVisible()} bounds=${JSON.stringify(win.getBounds())}`);
    setTimeout(() => {
      if (!win || win.isDestroyed()) return;
      if (!win.isVisible()) {
        bootLog('window still hidden; falling back to show()');
        win.show();
        win.moveTop();
      }
      startCursorWatch();
      bootLog(`after 400ms visible=${win.isVisible()}`);
    }, 400);
  });

  win.webContents.on('did-finish-load', () => {
    bootLog('did-finish-load');
    win.webContents.send('config', publicConfig());
    if (IS_SMOKE && !smokeStarted) {
      smokeStarted = true;
      setTimeout(runSmokeTest, 1800);
    }
  });

  win.webContents.on('render-process-gone', (_e, details) => {
    bootLog(`render-process-gone ${JSON.stringify(details)}`);
  });

  win.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    win = null;
  });

  win.on('show', () => refreshTray());
  win.on('hide', () => refreshTray());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

function publicConfig() {
  return {
    scale: config.scale,
    alwaysOnTop: config.alwaysOnTop,
    sound: config.sound,
    autoStart: config.autoStart,
    isSmoke: IS_SMOKE
  };
}

function showPet() {
  if (!win) return;
  win.show();
  win.setAlwaysOnTop(config.alwaysOnTop, 'floating');
  win.moveTop();
  updateCursorInteractive();
  win.focus();
}

function sendAction(action) {
  if (!win) return;
  showPet();
  win.webContents.send('pet-action', action);
}

function resetPosition() {
  if (!win) return;
  const { width, height } = currentSize();
  const p = defaultPosition(width, height);
  win.setSize(width, height, false);
  applyPosition(p.x, p.y, width, height);
  win.webContents.send('pet-action', 'returned');
}

function setScale(nextScale) {
  if (!win) return;
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const cap = Math.floor(maxScaleForArea(area) * 100) / 100;
  const scale = clamp(Math.round(nextScale * 100) / 100, MIN_SCALE, cap);
  if (Math.abs(scale - config.scale) < 0.001) return;
  const old = win.getBounds();
  const size = currentSize(scale);
  config.scale = scale;
  const p = clampToVisible(old.x + old.width - size.width, old.y + old.height - size.height, size.width, size.height);
  win.setBounds({ x: p.x, y: p.y, width: size.width, height: size.height }, true);
  config.x = p.x;
  config.y = p.y;
  scheduleSave();
  win.webContents.send('config', publicConfig());
  win.webContents.send('pet-action', 'resized');
}

function setAlwaysOnTop(enabled) {
  config.alwaysOnTop = Boolean(enabled);
  if (win) win.setAlwaysOnTop(config.alwaysOnTop, 'floating');
  scheduleSave();
  refreshTray();
  if (win) win.webContents.send('config', publicConfig());
}

function setAutoStart(enabled) {
  config.autoStart = Boolean(enabled);
  try {
    const args = [app.getAppPath()];
    if (process.argv.includes('--no-sandbox')) args.push('--no-sandbox');
    app.setLoginItemSettings({
      openAtLogin: config.autoStart,
      path: process.execPath,
      args
    });
  } catch (err) {
    console.error('auto start failed', err);
  }
  scheduleSave();
  refreshTray();
  if (win) win.webContents.send('config', publicConfig());
}

function createTray() {
  try {
    const iconPath = path.join(ASSETS, 'icon.png');
    let image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) image = image.resize({ width: 32, height: 32, quality: 'best' });
    tray = new Tray(image);
    tray.setToolTip('DeepSeek 鲸鱼娘 · 溟月桌宠');
    tray.on('click', () => {
      if (!win) return;
      if (win.isVisible()) win.hide();
      else showPet();
    });
    refreshTray();
  } catch (err) {
    console.error('tray creation failed:', err);
    tray = null;
  }
}

function refreshTray() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: '摸摸溟月', click: () => sendAction('pat') },
    { label: '喂一碗白饭', click: () => sendAction('feed') },
    { type: 'separator' },
    {
      label: win && win.isVisible() ? '隐藏桌宠' : '显示桌宠',
      click: () => {
        if (!win) return;
        if (win.isVisible()) win.hide();
        else showPet();
      }
    },
    { label: '回到屏幕右下角', click: resetPosition },
    {
      label: '始终置顶',
      type: 'checkbox',
      checked: config.alwaysOnTop,
      click: (item) => setAlwaysOnTop(item.checked)
    },
    {
      label: '开机自动启动',
      type: 'checkbox',
      checked: config.autoStart,
      click: (item) => setAutoStart(item.checked)
    },
    { type: 'separator' },
    { label: '关于与署名', click: () => sendAction('about') },
    { label: '退出', click: () => quitApp() }
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(win && win.isVisible() ? 'DeepSeek 鲸鱼娘 · 溟月桌宠' : '溟月在托盘里打盹');
}

function quitApp() {
  quitting = true;
  writeConfig();
  if (tray) tray.destroy();
  app.quit();
}

function registerIpc() {
  ipcMain.on('ui-state', (_event, next) => {
    if (!next || typeof next !== 'object') return;
    const rect = (value) => {
      if (!value) return null;
      const x = Number(value.x);
      const y = Number(value.y);
      const width = Number(value.width);
      const height = Number(value.height);
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
      return { x, y, width, height };
    };
    uiState = {
      bubble: rect(next.bubble),
      dock: rect(next.dock),
      modal: Boolean(next.modal)
    };
    updateCursorInteractive();
  });

  ipcMain.on('drag-start', () => {
    if (!win) return;
    const cursor = screen.getCursorScreenPoint();
    const b = win.getBounds();
    dragState = {
      offsetX: cursor.x - b.x,
      offsetY: cursor.y - b.y,
      moved: false,
      startX: b.x,
      startY: b.y
    };
    setInteractive(true);
  });

  ipcMain.on('drag-move', () => {
    if (!win || !dragState) return;
    const cursor = screen.getCursorScreenPoint();
    const nextX = cursor.x - dragState.offsetX;
    const nextY = cursor.y - dragState.offsetY;
    if (Math.abs(nextX - dragState.startX) > 2 || Math.abs(nextY - dragState.startY) > 2) dragState.moved = true;
    const b = win.getBounds();
    const p = clampToVisible(nextX, nextY, b.width, b.height);
    win.setPosition(p.x, p.y, false);
  });

  ipcMain.handle('drag-end', () => {
    if (!win || !dragState) return { moved: false };
    const moved = dragState.moved;
    dragState = null;
    const b = win.getBounds();
    config.x = b.x;
    config.y = b.y;
    scheduleSave();
    updateCursorInteractive();
    return { moved };
  });

  ipcMain.on('set-scale', (_e, scale) => setScale(Number(scale)));
  ipcMain.on('set-always-on-top', (_e, enabled) => setAlwaysOnTop(enabled));
  ipcMain.on('set-auto-start', (_e, enabled) => setAutoStart(enabled));
  ipcMain.on('save-config', (_e, patch) => {
    if (!patch || typeof patch !== 'object') return;
    if (typeof patch.sound === 'boolean') config.sound = patch.sound;
    if (Number.isFinite(patch.scale)) config.scale = clamp(patch.scale, MIN_SCALE, MAX_SCALE);
    scheduleSave();
  });
  ipcMain.on('reset-position', resetPosition);
  ipcMain.on('hide-pet', () => win && win.hide());
  ipcMain.on('quit-app', quitApp);
  ipcMain.handle('get-config', () => publicConfig());
  ipcMain.on('open-external', (_e, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
  });
}

async function capture(name) {
  if (!win || win.isDestroyed()) return;
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(ROOT, 'shots', `${name}.png`), image.toPNG());
}

async function runSmokeTest() {
  const shots = path.join(ROOT, 'shots');
  fs.mkdirSync(shots, { recursive: true });
  await new Promise((r) => setTimeout(r, 1200));
  await capture('01-idle');
  await win.webContents.executeJavaScript("window.__petDemo && window.__petDemo('feed')");
  await new Promise((r) => setTimeout(r, 900));
  await capture('02-feed');
  await win.webContents.executeJavaScript("window.__petDemo && window.__petDemo('menu')");
  await new Promise((r) => setTimeout(r, 450));
  await capture('03-menu');
  await win.webContents.executeJavaScript("window.__petDemo && window.__petDemo('about')");
  await new Promise((r) => setTimeout(r, 450));
  await capture('04-about');
  setTimeout(() => {
    quitting = true;
    app.quit();
  }, 500);
}

function attachDisplayGuards() {
  const fix = () => {
    if (!win || win.isDestroyed()) return;
    const b = win.getBounds();
    const p = clampToVisible(b.x, b.y, b.width, b.height);
    if (p.x !== b.x || p.y !== b.y) win.setPosition(p.x, p.y, false);
  };
  screen.on('display-added', fix);
  screen.on('display-removed', fix);
  screen.on('display-metrics-changed', fix);
}

// Electron's ProcessSingleton creates a named pipe on Windows. Some sandboxed
// or hosted shells deny that pipe, which aborts the process before the first
// window. A PID file gives us the same guard without the named pipe.
app.whenReady().then(() => {
  bootLog('app ready');
  if (!claimProcessLock()) return;
  isPrimary = true;
  app.setAppUserModelId('com.mingyue.deepseek-whale-pet');
  loadConfig();
  registerIpc();
  createWindow();
  createTray();
  attachDisplayGuards();
  watchShowRequests();
  bootLog('window and tray created');

  if (config.autoStart !== app.getLoginItemSettings().openAtLogin) {
    // Keep the checkbox honest if the OS entry was removed manually.
    config.autoStart = app.getLoginItemSettings().openAtLogin;
    scheduleSave();
    if (win) win.webContents.send('config', publicConfig());
  }

  app.on('activate', () => {
    if (!win) createWindow();
    else showPet();
  });
});

app.on('before-quit', () => {
  quitting = true;
  clearInterval(cursorTimer);
  clearInterval(showRequestTimer);
  if (isPrimary) {
    releaseProcessLock();
    writeConfig();
  }
});

app.on('window-all-closed', (event) => {
  if (!IS_SMOKE && !quitting) event.preventDefault();
});
