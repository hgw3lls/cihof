// The admin panel's only way to the app: a fixed list of requests, each
// checked again by the main process before anything happens.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cihofAdmin', {
  state: () => ipcRenderer.invoke('admin:state'),
  unlock: (code) => ipcRenderer.invoke('admin:unlock', code),
  setPasscode: (code) => ipcRenderer.invoke('admin:set-passcode', code),
  setDebug: (next) => ipcRenderer.invoke('admin:set-debug', next),
  setSetting: (name, value) => ipcRenderer.invoke('admin:set-setting', { name, value }),
  previewAttract: (candidate) => ipcRenderer.invoke('admin:preview-attract', candidate),
  action: (name) => ipcRenderer.invoke('admin:action', name),
  chooseVideos: () => ipcRenderer.invoke('admin:choose-videos'),
  clearVideos: () => ipcRenderer.invoke('admin:clear-videos'),
  // Content updates from the staff portal. The file is chosen with the
  // system's own picker in the main process; the panel never names a path.
  chooseUpdate: () => ipcRenderer.invoke('admin:content-choose'),
  applyUpdate: (options) => ipcRenderer.invoke('admin:content-apply', options),
  restoreContent: (options) => ipcRenderer.invoke('admin:content-restore', options),
  exportContent: () => ipcRenderer.invoke('admin:content-export'),
  showContentNow: () => ipcRenderer.invoke('admin:content-show-now'),
  cancelUpdate: () => ipcRenderer.invoke('admin:content-cancel'),
  // The staff connection: open for so many minutes, or close it.
  openConnection: (minutes) => ipcRenderer.invoke('admin:connection-open', { minutes }),
  closeConnection: () => ipcRenderer.invoke('admin:connection-close'),
});
