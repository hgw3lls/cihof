// Runs beside the exhibit page, in its own isolated world. Its only job is the
// hidden staff gesture: hold the top-left corner for five seconds.
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
