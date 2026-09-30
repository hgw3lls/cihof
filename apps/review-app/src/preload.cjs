// The only ways the pages in this window reach the app: on the start-up page,
// choose the data folder or try again; in the review, show an exported file.
// Each is checked again by the app before anything happens.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cihofReview', {
  chooseFolder: () => ipcRenderer.invoke('review-app:choose-folder'),
  retry: () => ipcRenderer.invoke('review-app:retry'),
  showExport: (path) => ipcRenderer.invoke('review-app:show-export', String(path)),
});
