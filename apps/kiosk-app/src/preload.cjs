// Runs beside the exhibit page, in its own isolated world. It does two things:
// the hidden staff gesture (hold the top-left corner for five seconds), and a
// check-in every few seconds. It shares the page's thread, so a frozen page
// stops checking in, and the app restarts it (watch.mjs).
const { ipcRenderer } = require('electron');

const corner = 80; // CSS pixels from the top-left
const holdMs = 5000;
let timer = null;

const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };

window.addEventListener('pointerdown', (event) => {
  cancel();
  if (event.clientX > corner || event.clientY > corner) return;
  timer = setTimeout(() => {
    timer = null;
    ipcRenderer.send('exhibit:admin-gesture');
  }, holdMs);
}, { capture: true, passive: true });

window.addEventListener('pointermove', (event) => {
  if (timer && (event.clientX > corner || event.clientY > corner)) cancel();
}, { capture: true, passive: true });

for (const type of ['pointerup', 'pointercancel', 'blur']) {
  window.addEventListener(type, cancel, { capture: true, passive: true });
}

ipcRenderer.send('exhibit:alive');
setInterval(() => ipcRenderer.send('exhibit:alive'), 5000);
