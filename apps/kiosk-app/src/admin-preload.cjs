// The admin panel's only way to the app: a fixed list of requests, each
// checked again by the main process before anything happens.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cihofAdmin', {
  state: () => ipcRenderer.invoke('admin:state'),
  unlock: (code) => ipcRenderer.invoke('admin:unlock', code),
  setPasscode: (code) => ipcRenderer.invoke('admin:set-passcode', code),
  setDebug: (next) => ipcRenderer.invoke('admin:set-debug', next),
  setSetting: (name, value) => ipcRenderer.invoke('admin:set-setting', { name, value }),
  action: (name) => ipcRenderer.invoke('admin:action', name),
});
