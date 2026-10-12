const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('exiter', {
  get: () => ipcRenderer.invoke('exiter:get-settings'),
  set: (patch) => ipcRenderer.invoke('exiter:set-settings', patch),
  reset: () => ipcRenderer.invoke('exiter:reset-settings'),
  version: () => ipcRenderer.invoke('exiter:get-version'),
  checkForUpdates: () => ipcRenderer.send('exiter:check-updates'),
  onChange: (cb) => ipcRenderer.on('exiter:settings', (_e, s) => cb(s)),
});
