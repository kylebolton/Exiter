const { app, BrowserWindow, Tray, Menu, globalShortcut, shell, nativeImage, nativeTheme, session, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const updater = require('./updater');

const DEFAULT_SETTINGS = {
  theme: 'light', accent: 'zinc', radius: 8, fontSize: 15, density: 'comfortable',
  feedWidth: 'fill', mediaMax: 620,
  fontFamily: 'geist', lineHeight: 'normal', uiZoom: 100, caps: 'names',
  hideAds: true, hideRightRail: true, hideSuggestions: true, hideFloating: true, hideLogo: true, hideMetrics: false,
  launchAtLogin: false, autoUpdate: true,
  nav: {
    home: true, explore: true, notifications: true, chat: true, profile: true, more: true,
    bookmarks: false, lists: false, communities: false, calls: false, history: false, articles: false, premium: false, grok: false, creator: false, jobs: false,
  },
};
const store = new Store({ defaults: { bounds: { width: 1280, height: 900 }, settings: DEFAULT_SETTINGS } });
const isMac = process.platform === 'darwin';

function getSettings() {
  let saved = store.get('settings') || {};
  // v2: Geist became the default font; anyone still on the old "system" default moves over once
  if ((saved.v || 1) < 2) {
    saved = { ...saved, v: 2, fontFamily: !saved.fontFamily || saved.fontFamily === 'system' || saved.fontFamily === 'inter' ? 'geist' : saved.fontFamily };
    store.set('settings', saved);
  }
  return { ...DEFAULT_SETTINGS, ...saved, nav: { ...DEFAULT_SETTINGS.nav, ...(saved.nav || {}) } };
}
const HOME = 'https://x.com/home';
const ALLOWED_HOSTS = /(^|\.)(x\.com|twitter\.com|twimg\.com|google\.com|googleusercontent\.com|apple\.com|gstatic\.com|recaptcha\.net)$/;

let win = null;
let tray = null;
let quitting = false;

const css = (name) => fs.readFileSync(path.join(__dirname, 'theme', name), 'utf8');

// The skin is injected by preload.js at document start (synchronously, before first paint), so a reload never flashes unstyled X.
const CSS_FILES = ['tokens', 'shell', 'nav', 'feed', 'composer', 'overlays', 'pages', 'loading', 'hide'];
ipcMain.on('exiter:get-css', (e) => { e.returnValue = CSS_FILES.map((n) => css(`${n}.css`)).join('\n'); });
ipcMain.on('exiter:get-fonts', (e) => { e.returnValue = JSON.parse(fs.readFileSync(path.join(__dirname, 'theme', 'fonts.json'), 'utf8')).faces; });
ipcMain.on('exiter:get-settings-sync', (e) => { e.returnValue = getSettings(); });

function applyZoom() {
  if (win && !win.isDestroyed()) win.webContents.setZoomFactor(getSettings().uiZoom / 100);
}

// Force X's native Light/Dark theme (night_mode cookie) so our skin layers on a matching base.
async function applyThemeCookie() {
  const dark = getSettings().theme === 'dark';
  nativeTheme.themeSource = dark ? 'dark' : 'light';
  const ses = session.fromPartition('persist:exiter');
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
  for (const url of ['https://x.com', 'https://twitter.com']) {
    const host = new URL(url).hostname;
    for (const c of await ses.cookies.get({ name: 'night_mode' })) {
      await ses.cookies.remove(`https://${c.domain.replace(/^\./, '')}`, 'night_mode');
    }
    await ses.cookies.set({ url, domain: `.${host}`, name: 'night_mode', value: dark ? '2' : '0', path: '/', secure: true, expirationDate: exp });
  }
}

// ---------- Settings: persisted, pushed live to the X window and the settings window ----------
let settingsWin = null;
let lastLogin = false;

function broadcastSettings() {
  const s = getSettings();
  for (const w of [win, settingsWin]) if (w && !w.isDestroyed()) w.webContents.send('exiter:settings', s);
  if (lastLogin !== !!s.launchAtLogin) {
    lastLogin = !!s.launchAtLogin;
    try { app.setLoginItemSettings({ openAtLogin: lastLogin }); } catch (err) { console.warn('login item:', err.message); }
  }
}

ipcMain.handle('exiter:get-settings', () => getSettings());
ipcMain.handle('exiter:set-settings', async (_e, patch) => {
  const before = getSettings();
  const next = { ...before, ...patch, nav: { ...before.nav, ...(patch.nav || {}) } };
  store.set('settings', next);
  if (next.theme !== before.theme) {
    await applyThemeCookie();
    if (win && !win.isDestroyed()) win.webContents.reloadIgnoringCache();
  }
  applyZoom();
  if (next.autoUpdate !== before.autoUpdate) updater.setAutomatic(next.autoUpdate);
  broadcastSettings();
  rebuildTrayMenu();
  return next;
});
ipcMain.handle('exiter:reset-settings', async () => {
  store.set('settings', DEFAULT_SETTINGS);
  await applyThemeCookie();
  if (win && !win.isDestroyed()) win.webContents.reloadIgnoringCache();
  broadcastSettings();
  rebuildTrayMenu();
  return getSettings();
});

// The Settings window is built hidden shortly after launch and hidden (not destroyed) on close, so opening it is instant.
let settingsReady = false;
let settingsWantShow = false;

function buildSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) return settingsWin;
  settingsReady = false;
  settingsWin = new BrowserWindow({
    show: false,
    width: 560, height: 720, minWidth: 480, minHeight: 480,
    title: 'Exiter Settings',
    backgroundColor: getSettings().theme === 'dark' ? '#09090b' : '#ffffff',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 18 },
    fullscreenable: false,
    webPreferences: { preload: path.join(__dirname, 'settings', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  settingsWin.loadFile(path.join(__dirname, 'settings', 'index.html'));
  if (process.env.EXITER_DEBUG_PORT) console.log('EXITER_SETTINGS_WINDOW_ID', settingsWin.getMediaSourceId().split(':')[1]);
  settingsWin.once('ready-to-show', () => {
    settingsReady = true;
    if (settingsWantShow) { settingsWin.show(); settingsWin.focus(); }
  });
  settingsWin.on('close', (e) => {
    if (!quitting) { e.preventDefault(); settingsWantShow = false; settingsWin.hide(); }
  });
  settingsWin.on('closed', () => { settingsWin = null; });
  return settingsWin;
}

function openSettings() {
  settingsWantShow = true;
  const w = buildSettingsWindow();
  if (settingsReady) { w.show(); w.focus(); }
}

function createWindow() {
  win = new BrowserWindow({
    ...store.get('bounds'),
    minWidth: 700,
    minHeight: 500,
    show: false,
    backgroundColor: getSettings().theme === 'dark' ? '#09090b' : '#ffffff',
    title: 'Exiter',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 12, y: 20 },
    ...(isMac ? {} : { titleBarOverlay: { color: '#ffffff', symbolColor: '#0f1419', height: 36 } }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:exiter',
    },
  });

  // Show on first paint (no white flash); fall back after 4s so a slow network never leaves the window hidden
  const showTimer = setTimeout(() => { if (win && !win.isDestroyed()) win.show(); }, 4000);
  win.once('ready-to-show', () => { clearTimeout(showTimer); win.show(); });

  win.loadURL(HOME);
  if (process.env.EXITER_DEBUG_PORT) console.log('EXITER_WINDOW_ID', win.getMediaSourceId().split(':')[1]);

  const wc = win.webContents;
  // insertCSS survives in-page (SPA) navigation, so only re-inject on a fresh document; removing and re-adding on every route change flashes unstyled content.
  wc.on('dom-ready', applyZoom);

  // Recovery: a failed load shows a themed offline page that retries on its own; a crashed renderer reloads
  wc.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted: normal during redirects */ || url.startsWith('file:')) return;
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { dark: getSettings().theme === 'dark' ? '1' : '' } });
  });
  wc.on('render-process-gone', () => { if (win && !win.isDestroyed()) win.loadURL(HOME); });

  wc.setWindowOpenHandler(({ url }) => {
    const host = new URL(url).hostname;
    if (ALLOWED_HOSTS.test(host)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (!ALLOWED_HOSTS.test(new URL(url).hostname)) { e.preventDefault(); shell.openExternal(url); }
  });

  const saveBounds = () => { if (!win.isMaximized() && !win.isMinimized()) store.set('bounds', win.getBounds()); };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  win.on('close', (e) => {
    if (isMac && !quitting) { e.preventDefault(); win.hide(); }
  });
  // Windows/Linux: a hidden (warm) Settings window must not keep the app alive after the main window closes
  win.on('closed', () => { win = null; if (!isMac) app.quit(); });
}

function refreshTimeline() {
  if (win && !win.isDestroyed()) win.webContents.send('exiter:do-refresh');
}
ipcMain.on('exiter:press-refresh-key', () => {
  if (process.env.EXITER_DEBUG_PORT) console.log('EXITER press-refresh-key received');
  if (!win || win.isDestroyed()) return;
  win.webContents.focus();
  for (const type of ['keyDown', 'char', 'keyUp']) win.webContents.sendInputEvent({ type, keyCode: '.', ...(type === 'char' ? {} : {}) });
});
ipcMain.on('exiter:open-settings', openSettings);
ipcMain.on('exiter:check-updates', () => updater.checkNow());
ipcMain.handle('exiter:get-version', () => ({ version: app.getVersion(), updatesEnabled: updater.isSupported() }));
ipcMain.on('exiter:reload-page', () => { if (win && !win.isDestroyed()) win.webContents.reloadIgnoringCache(); });

function showWindow() {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function toggleWindow() {
  if (win && win.isVisible() && win.isFocused()) win.hide();
  else showWindow();
}

function newPost() {
  showWindow();
  win.webContents.loadURL('https://x.com/compose/post');
}

function trayMenu() {
  const st = getSettings();
  return Menu.buildFromTemplate([
    { label: 'Show / Hide Exiter', accelerator: 'CmdOrCtrl+Shift+X', click: toggleWindow },
    { label: 'New Post', accelerator: 'CmdOrCtrl+Shift+N', click: newPost },
    { label: 'Home', click: () => { showWindow(); win.webContents.loadURL(HOME); } },
    { label: 'Refresh Timeline', accelerator: 'CmdOrCtrl+R', click: () => { showWindow(); refreshTimeline(); } },
    { label: 'Reload Page', accelerator: 'CmdOrCtrl+Shift+R', click: () => win && win.webContents.reloadIgnoringCache() },
    { type: 'separator' },
    {
      label: 'Hide Ads & Upsells', type: 'checkbox', checked: st.hideAds,
      click: (item) => { store.set('settings', { ...getSettings(), hideAds: item.checked }); broadcastSettings(); },
    },
    { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettings },
    { label: 'Check for Updates…', click: () => updater.checkNow() },
    { type: 'separator' },
    { label: 'Quit Exiter', role: 'quit' },
  ]);
}

function rebuildTrayMenu() { if (tray) tray.setContextMenu(trayMenu()); }

function buildTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', isMac ? 'trayTemplate.png' : 'icon.png'));
  if (isMac) img.setTemplateImage(true);
  tray = new Tray(isMac ? img : img.resize({ width: 18, height: 18 }));
  tray.setToolTip('Exiter');
  tray.setContextMenu(trayMenu());
  tray.on('click', () => { if (!isMac) toggleWindow(); });
}

function buildAppMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { label: 'Check for Updates…', click: () => updater.checkNow() },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettings },
        { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' },
      ],
    }] : [{ label: 'File', submenu: [{ label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettings }, { type: 'separator' }, { role: 'quit' }] }]),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => win && win.webContents.goBack() },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => win && win.webContents.goForward() },
        { label: 'Refresh Timeline', accelerator: 'CmdOrCtrl+R', click: refreshTimeline },
        { label: 'Reload Page', accelerator: 'CmdOrCtrl+Shift+R', click: () => win && win.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' }, { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
    ...(isMac ? [] : [{ label: 'Help', submenu: [{ label: 'Check for Updates…', click: () => updater.checkNow() }] }]),
  ]));
}

if (process.env.EXITER_DEBUG_PORT) app.commandLine.appendSwitch('remote-debugging-port', process.env.EXITER_DEBUG_PORT);

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', showWindow);

app.whenReady().then(async () => {
  if (isMac) app.dock.setIcon(path.join(__dirname, '..', 'assets', 'icon.png'));
  buildAppMenu();
  await applyThemeCookie();
  createWindow();
  buildTray();
  broadcastSettings();
  setTimeout(() => { if (app.isReady()) buildSettingsWindow(); }, 2500);
  updater.start({ beforeQuit: () => { quitting = true; }, automatic: getSettings().autoUpdate });
  if (process.env.EXITER_OPEN_SETTINGS) openSettings();
  globalShortcut.register('CommandOrControl+Shift+X', toggleWindow);
  globalShortcut.register('CommandOrControl+Shift+N', newPost);
  app.on('activate', showWindow);
});

app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
