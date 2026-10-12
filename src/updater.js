// Auto-updates: Sparkle on macOS (electron-sparkle), electron-updater on Windows and Linux.
// Only runs in packaged builds, so `npm start` never tries to update itself.
const { app, dialog } = require('electron');

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

let engine = null;        // 'sparkle' | 'electron-updater' | null
let sparkle = null;
let eu = null;
let timer = null;
let onBeforeQuit = () => {};
let interactive = false;  // true while a user-initiated check is in flight (so "up to date" is shown)

function isSupported() { return app.isPackaged; }

async function start({ beforeQuit, automatic }) {
  if (!isSupported() || engine) return;
  onBeforeQuit = beforeQuit || onBeforeQuit;
  try {
    if (process.platform === 'darwin') {
      ({ updater: sparkle } = require('electron-sparkle'));
      // Close-to-tray must never block the relaunch Sparkle performs after installing
      sparkle.setBeforeRelaunchHandler(async () => { onBeforeQuit(); });
      sparkle.on('error', ({ error }) => console.warn('[updater] sparkle:', error && error.message));
      await sparkle.start();
      sparkle.setAutomaticallyChecksForUpdates(!!automatic);
      engine = 'sparkle';
      maybeCheckOnLaunch();
    } else if (process.platform === 'win32' || process.platform === 'linux') {
      ({ autoUpdater: eu } = require('electron-updater'));
      eu.autoDownload = true;
      eu.autoInstallOnAppQuit = true;
      eu.on('error', (err) => { console.warn('[updater] electron-updater:', err && err.message); if (interactive) { interactive = false; dialog.showMessageBox({ type: 'error', message: "Couldn't check for updates", detail: 'Check your connection and try again.' }); } });
      eu.on('update-not-available', () => { if (interactive) { interactive = false; dialog.showMessageBox({ type: 'info', message: "You're up to date", detail: `Exiter ${app.getVersion()} is the latest version.` }); } });
      eu.on('update-downloaded', (info) => {
        interactive = false;
        dialog.showMessageBox({ type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1, message: `Exiter ${info.version} is ready`, detail: 'Restart to finish updating.' })
          .then(({ response }) => { if (response === 0) { onBeforeQuit(); eu.quitAndInstall(); } });
      });
      engine = 'electron-updater';
      setAutomatic(!!automatic);
    }
  } catch (err) {
    console.warn('[updater] failed to start:', err && err.message);
    engine = null;
  }
}

// Windows/Linux: a background check on launch and every few hours. macOS: Sparkle owns its schedule.
function setAutomatic(on) {
  if (engine === 'sparkle') { sparkle.setAutomaticallyChecksForUpdates(!!on); return; }
  if (engine !== 'electron-updater') return;
  clearInterval(timer);
  timer = null;
  if (on) {
    eu.checkForUpdates().catch(() => {});
    timer = setInterval(() => eu.checkForUpdates().catch(() => {}), CHECK_EVERY_MS);
  }
}

// Test hook: EXITER_CHECK_UPDATES=1 runs one silent background check shortly after launch (used to verify the update path).
function maybeCheckOnLaunch() {
  if (!process.env.EXITER_CHECK_UPDATES || engine !== 'sparkle') return;
  setTimeout(() => { try { sparkle.checkForUpdatesInBackground(); } catch (e) { console.warn('[updater]', e.message); } }, 5000);
}

function checkNow() {
  if (!isSupported()) {
    dialog.showMessageBox({ type: 'info', message: 'Updates are off in development builds' });
    return;
  }
  if (engine === 'sparkle') sparkle.checkForUpdates();           // Sparkle shows its own window
  else if (engine === 'electron-updater') { interactive = true; eu.checkForUpdates().catch(() => {}); }
}

module.exports = { start, checkNow, setAutomatic, isSupported, maybeCheckOnLaunch };
