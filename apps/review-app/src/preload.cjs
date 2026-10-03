// The only ways the pages in this window reach the app: on the start-up page,
// open a display's content, choose the data folder or try again; in the
// review, show an exported file or a display update.
// Each is checked again by the app before anything happens.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cihofReview', {
  chooseFolder: () => ipcRenderer.invoke('review-app:choose-folder'),
  openContent: () => ipcRenderer.invoke('review-app:open-content'),
  connectDisplay: (address, code) => ipcRenderer.invoke('review-app:connect-display', { address: String(address), code: String(code) }),
  retry: () => ipcRenderer.invoke('review-app:retry'),
  showExport: (path) => ipcRenderer.invoke('review-app:show-export', String(path)),
  showUpdate: (path) => ipcRenderer.invoke('review-app:show-update', String(path)),
});
