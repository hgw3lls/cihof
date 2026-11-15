// Runs beside the exhibit page, in its own isolated world. It does two things:
// the hidden staff gesture (hold the top-left corner for five seconds), and a
// check-in every few seconds. It shares the page's thread, so a frozen page
// stops checking in, and the app restarts it (watch.mjs).
const { ipcRenderer } = require('electron');

const corner = 80; // CSS pixels from the top-left
const holdMs = 5000;
let timer = null;
/** The finger (or pointer) holding the corner: only its moves and its lifting count. */
let holding = null;

const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } holding = null; };
const ours = (event) => timer && event.pointerId === holding;

window.addEventListener('pointerdown', (event) => {
  cancel();
  if (event.clientX > corner || event.clientY > corner) return;
  holding = event.pointerId;
  timer = setTimeout(() => {
    timer = null;
    holding = null;
    ipcRenderer.send('exhibit:admin-gesture');
  }, holdMs);
}, { capture: true, passive: true });

window.addEventListener('pointermove', (event) => {
  if (ours(event) && (event.clientX > corner || event.clientY > corner)) cancel();
}, { capture: true, passive: true });

for (const type of ['pointerup', 'pointercancel']) {
  window.addEventListener(type, (event) => { if (ours(event)) cancel(); }, { capture: true, passive: true });
}
// Only the window itself losing focus (the admin panel or another window
// coming in front). Listened for in the capture phase, `blur` is also every
// button in the exhibit losing focus, which the exhibit moves on its own while
// a finger is held: the invitation appearing, the attract screen changing.
// That cancelled every hold, so staff could not get in on the touchscreen.
window.addEventListener('blur', (event) => { if (event.target === window) cancel(); });

ipcRenderer.send('exhibit:alive');
setInterval(() => ipcRenderer.send('exhibit:alive'), 5000);
