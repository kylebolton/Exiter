const { app, BrowserWindow, Tray, Menu, Notification, globalShortcut, shell, nativeImage, nativeTheme, session, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const updater = require('./updater');
const { xLinkDestination, xLinkFromArguments } = require('./x-links');

const DEFAULT_SETTINGS = {
  theme: 'light', accent: 'zinc', radius: 8, fontSize: 15, density: 'comfortable',
  feedWidth: 'fill', mediaMax: 620,
  fontFamily: 'geist', lineHeight: 'normal', uiZoom: 100, caps: 'names',
  hideAds: true, hideRightRail: true, hideSuggestions: true, hideFloating: true, hideLogo: true, hideMetrics: false,
  launchAtLogin: false, autoUpdate: true, desktopNotifications: false,
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
const COMPOSE = 'https://x.com/compose/post';
const ALLOWED_HOSTS = /(^|\.)(x\.com|twitter\.com|twimg\.com|google\.com|googleusercontent\.com|apple\.com|gstatic\.com|recaptcha\.net)$/;

let win = null;
let tray = null;
let quitting = false;
let launchDestination = xLinkFromArguments(process.argv);

const css = (name) => fs.readFileSync(path.join(__dirname, 'theme', name), 'utf8');
// Read the theme and fonts once: every document load (and every reload) asks for them synchronously
let cssCache = null;
let fontCache = null;

// The skin is injected by preload.js at document start (synchronously, before first paint), so a reload never flashes unstyled X.
const CSS_FILES = ['tokens', 'shell', 'nav', 'feed', 'cards', 'composer', 'overlays', 'pages', 'search', 'motion', 'loading', 'hide'];
ipcMain.on('exiter:get-css', (e) => { e.returnValue = cssCache || (cssCache = CSS_FILES.map((n) => css(`${n}.css`)).join('\n')); });
ipcMain.on('exiter:get-fonts', (e) => { e.returnValue = fontCache || (fontCache = JSON.parse(fs.readFileSync(path.join(__dirname, 'theme', 'fonts.json'), 'utf8')).faces); });
ipcMain.on('exiter:route', (_e, route) => { if (typeof route === 'string' && route.startsWith('/') && !route.startsWith('//') && route.length < 200) store.set('lastRoute', route); });
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
  for (const c of await ses.cookies.get({ name: 'night_mode' })) {
    await ses.cookies.remove(`https://${c.domain.replace(/^\./, '')}`, 'night_mode');
  }
  for (const url of ['https://x.com', 'https://twitter.com']) {
    const host = new URL(url).hostname;
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
let themeUpdate = Promise.resolve();
async function saveSettings(next) {
  const before = getSettings();
  store.set('settings', next);
  applyZoom();
  if (next.autoUpdate !== before.autoUpdate) updater.setAutomatic(next.autoUpdate);
  if (!next.desktopNotifications && activityNotification) activityNotification.close();
  broadcastSettings();
  rebuildTrayMenu();
  if (next.theme !== before.theme) {
    const update = themeUpdate.then(async () => {
      await applyThemeCookie();
      if (win && !win.isDestroyed()) {
        win.setBackgroundColor(getSettings().theme === 'dark' ? '#09090b' : '#ffffff');
        if (!isMac) win.setTitleBarOverlay(titleBarOverlay());
        if (win.webContents.getURL().startsWith('file:')) showOffline();
        else win.webContents.reloadIgnoringCache();
      }
    });
    themeUpdate = update.catch(() => {});
    await update;
  }
  return getSettings();
}
ipcMain.handle('exiter:set-settings', (_e, patch) => {
  const before = getSettings();
  return saveSettings({ ...before, ...patch, nav: { ...before.nav, ...patch.nav } });
});
ipcMain.handle('exiter:reset-settings', () => saveSettings(DEFAULT_SETTINGS));

const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
let activityNotification = null;
let testNotification = null;

function isMainXFrame(event) {
  const wc = win?.webContents;
  const frame = event.senderFrame;
  return !!wc && event.sender === wc && frame === wc.mainFrame
    && frame?.url.startsWith('https://x.com/');
}

const workspaceAccount = /^[a-z0-9_]{1,15}$/;
const readingRoute = /^\/(?:home|search\?[^#]+|i\/(?:bookmarks|lists\/\d+))$/;
const postRoute = /^\/[A-Za-z0-9_]{1,15}\/status\/\d+$/;
const workspacePath = (route) => typeof route === 'string' && route.length <= 600 && readingRoute.test(route);
const workspaceKey = (account) => `workspace.${account}`;

ipcMain.handle('exiter:workspace', (event, account) => {
  if (!isMainXFrame(event) || typeof account !== 'string' || !workspaceAccount.test(account)) return null;
  return store.get(workspaceKey(account), {});
});

ipcMain.on('exiter:reading-position', (event, account, position) => {
  if (!isMainXFrame(event) || typeof account !== 'string' || !workspaceAccount.test(account)) return;
  if (!position || !workspacePath(position.route) || typeof position.tab !== 'string' ||
      position.tab.length > 80 || typeof position.post !== 'string' || !postRoute.test(position.post) ||
      !Number.isFinite(position.top) || Math.abs(position.top) > 4000) return;
  const key = `${workspaceKey(account)}.reading`;
  const last = store.get(key);
  if (!last || last.route !== position.route || last.tab !== position.tab ||
      last.post !== position.post || Math.abs(last.top - position.top) >= 24) {
    const { route, tab, post, top } = position;
    store.set(key, { route, tab, post, top });
  }
});

ipcMain.handle('exiter:toggle-pin', (event, account, pin) => {
  if (!isMainXFrame(event) || typeof account !== 'string' || !workspaceAccount.test(account) ||
      !pin || !workspacePath(pin.route) || !/^\/(?:search\?|i\/lists\/)/.test(pin.route) ||
      typeof pin.label !== 'string' || !pin.label.trim() || pin.label.length > 100) return null;
  const key = `${workspaceKey(account)}.pins`;
  const pins = store.get(key, []);
  const index = pins.findIndex(item => item.route === pin.route);
  if (index >= 0) pins.splice(index, 1);
  else if (pins.length < 12) pins.push(pin);
  store.set(key, pins);
  return pins;
});

ipcMain.on('exiter:timing', (event, name, duration) => {
  if (!process.env.EXITER_PERF || !isMainXFrame(event)) return;
  if (['launch to timeline', 'navigation to content', 'palette to input'].includes(name) && Number.isFinite(duration)) {
    console.log(`[Exiter timing] ${name}: ${Math.round(duration)} ms`);
  }
});

function openNotifications() {
  showWindow();
  if (win.webContents.getURL().startsWith('https://x.com/')) {
    win.webContents.send('exiter:show-notifications');
  } else {
    win.loadURL('https://x.com/notifications').catch(() => {});
  }
}

function showNotification({ test = false } = {}) {
  if (!Notification.isSupported()) return Promise.resolve('Desktop notifications are unavailable on this system.');
  return new Promise((resolve) => {
    const notification = new Notification({
      title: 'Exiter',
      body: test ? 'Desktop notifications are working.' : 'You have new activity on X.',
      icon: iconPath,
      silent: true,
    });
    if (test) {
      testNotification?.close();
      testNotification = notification;
    } else {
      activityNotification?.close();
      activityNotification = notification;
    }
    const clear = () => {
      if (activityNotification === notification) activityNotification = null;
      if (testNotification === notification) testNotification = null;
    };
    const timeout = setTimeout(() => resolve('Check your system notification settings for Exiter.'), 4000);
    const finish = (message) => { clearTimeout(timeout); resolve(message); };
    notification.once('close', clear);
    notification.once('click', test ? openSettings : openNotifications);
    notification.once('show', () => finish('Test notification sent.'));
    notification.once('failed', () => {
      clear();
      finish('Couldn’t show a notification. Check your system settings for Exiter.');
    });
    notification.show();
  });
}

ipcMain.on('exiter:unread-increased', (event) => {
  if (!isMainXFrame(event) || !getSettings().desktopNotifications || BrowserWindow.getFocusedWindow()) return;
  showNotification().catch((err) => console.warn('[notifications]', err.message));
});

ipcMain.handle('exiter:test-notification', (event) => {
  if (!settingsWin || event.sender !== settingsWin.webContents) return;
  return showNotification({ test: true });
});

function titleBarOverlay() {
  const dark = getSettings().theme === 'dark';
  return { color: dark ? '#09090b' : '#ffffff', symbolColor: dark ? '#fafafa' : '#18181b', height: 36 };
}

let retryURL = HOME;
function showOffline() {
  win.loadFile(path.join(__dirname, 'offline.html'), {
    query: { dark: getSettings().theme === 'dark' ? '1' : '', retry: retryURL },
  }).catch(() => {});
}

// The Settings window is built hidden shortly after launch and hidden (not destroyed) on close, so opening it is instant.
let settingsReady = false;
let settingsWantShow = false;

function buildSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) return settingsWin;
  settingsReady = false;
  settingsWin = new BrowserWindow({
    show: false,
    width: 680, height: 760, minWidth: 480, minHeight: 480,
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

function createWindow(destination) {
  win = new BrowserWindow({
    ...store.get('bounds'),
    minWidth: 700,
    minHeight: 500,
    show: false,
    backgroundColor: getSettings().theme === 'dark' ? '#09090b' : '#ffffff',
    title: 'Exiter',
    icon: iconPath,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 12, y: 20 },
    ...(isMac ? {} : { titleBarOverlay: titleBarOverlay() }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // a hidden-to-tray window keeps its timers, so new-posts stay current
      partition: 'persist:exiter',
    },
  });

  // Show on first paint (no white flash); fall back after 4s so a slow network never leaves the window hidden
  const showTimer = setTimeout(() => { if (win && !win.isDestroyed()) win.show(); }, 4000);
  win.once('ready-to-show', () => { clearTimeout(showTimer); win.show(); });

  // Reopen where the user left off (route is saved by preload.js), but only for plain x.com paths
  const last = store.get('lastRoute');
  const saved = typeof last === 'string' && /^\/[A-Za-z0-9_\/?=&%.+-]*$/.test(last) && !last.startsWith('//') ? `https://x.com${last}` : HOME;
  win.loadURL(destination || saved).catch(() => {});
  if (process.env.EXITER_DEBUG_PORT) console.log('EXITER_WINDOW_ID', win.getMediaSourceId().split(':')[1]);

  const wc = win.webContents;
  // insertCSS survives in-page (SPA) navigation, so only re-inject on a fresh document; removing and re-adding on every route change flashes unstyled content.
  wc.on('dom-ready', applyZoom);

  // Recovery: a failed load shows a themed offline page that retries on its own; a crashed renderer reloads
  wc.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted: normal during redirects */ || url.startsWith('file:')) return;
    retryURL = url.startsWith('https://x.com/') ? url : HOME;
    showOffline();
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
  if (!win || win.isDestroyed()) return;
  if (win.webContents.getURL().startsWith('file:')) win.loadURL(retryURL).catch(() => {});
  else win.webContents.send('exiter:do-refresh');
}

function reloadPage() {
  if (!win || win.isDestroyed()) return;
  if (win.webContents.getURL().startsWith('file:')) win.loadURL(retryURL).catch(() => {});
  else win.webContents.reloadIgnoringCache();
}
ipcMain.on('exiter:press-refresh-key', () => {
  if (process.env.EXITER_DEBUG_PORT) console.log('EXITER press-refresh-key received');
  if (!win || win.isDestroyed()) return;
  win.webContents.focus();
  for (const type of ['keyDown', 'char', 'keyUp']) win.webContents.sendInputEvent({ type, keyCode: '.' });
});
ipcMain.on('exiter:open-settings', openSettings);
ipcMain.on('exiter:check-updates', () => updater.checkNow());
ipcMain.handle('exiter:get-version', () => ({ version: app.getVersion(), updatesEnabled: updater.isSupported() }));
ipcMain.on('exiter:reload-page', reloadPage);

function showWindow() {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function openXLink(destination) {
  if (!destination) return;
  if (!win) {
    launchDestination = destination;
    return;
  }
  showWindow();
  if (win.webContents.getURL() !== destination) win.loadURL(destination).catch(() => {});
}

function toggleWindow() {
  if (win && win.isVisible() && win.isFocused()) win.hide();
  else showWindow();
}

function newPost() {
  showWindow();
  const wc = win.webContents;
  const open = () => {
    if (wc.isDestroyed()) return;
    if (wc.getURL().startsWith('https://x.com/')) wc.send('exiter:open-composer');
    else wc.loadURL(COMPOSE).catch(() => {});
  };
  if (wc.isLoadingMainFrame()) wc.once('did-stop-loading', open);
  else open();
}

function trayMenu() {
  const st = getSettings();
  return Menu.buildFromTemplate([
    { label: 'Show / Hide Exiter', accelerator: 'CmdOrCtrl+Shift+X', click: toggleWindow },
    { label: 'New Post', accelerator: 'CmdOrCtrl+Shift+N', click: newPost },
    { label: 'Home', click: () => {
      showWindow();
      const wc = win.webContents;
      if (wc.getURL().startsWith('https://x.com/') && !wc.isLoadingMainFrame()) wc.send('exiter:show-home');
      else wc.loadURL(HOME).catch(() => {});
    } },
    { label: 'Refresh Timeline', accelerator: 'CmdOrCtrl+R', click: () => { showWindow(); refreshTimeline(); } },
    { label: 'Reload Page', accelerator: 'CmdOrCtrl+Shift+R', click: reloadPage },
    { type: 'separator' },
    {
      label: 'Hide Ads & Upsells', type: 'checkbox', checked: st.hideAds,
      click: (item) => saveSettings({ ...getSettings(), hideAds: item.checked }),
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
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => win?.webContents.navigationHistory.goBack() },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => win?.webContents.navigationHistory.goForward() },
        { label: 'Refresh Timeline', accelerator: 'CmdOrCtrl+R', click: refreshTimeline },
        { label: 'Reload Page', accelerator: 'CmdOrCtrl+Shift+R', click: reloadPage },
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

const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on('open-url', (event, url) => {
  event.preventDefault();
  openXLink(xLinkDestination(url));
});
app.on('second-instance', (_event, args) => {
  const destination = xLinkFromArguments(args);
  if (destination) openXLink(destination);
  else if (win) showWindow();
});

app.whenReady().then(async () => {
  if (!primaryInstance) return;
  if (app.isPackaged && process.platform === 'win32') app.setAsDefaultProtocolClient('exiter');
  if (process.platform === 'win32') app.setAppUserModelId('me.kylebolton.exiter');
  // Open connections to X's hosts before the first request needs them
  try { for (const h of ['https://x.com', 'https://api.x.com', 'https://pbs.twimg.com', 'https://abs.twimg.com', 'https://video.twimg.com']) session.fromPartition('persist:exiter').preconnect({ url: h, numSockets: 2 }); } catch {}
  if (isMac) app.dock.setIcon(path.join(__dirname, '..', 'assets', 'icon.png'));
  buildAppMenu();
  await applyThemeCookie();
  createWindow(launchDestination);
  launchDestination = null;
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
