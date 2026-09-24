// The admin panel. Everything it does goes through window.cihofAdmin, which
// the main process checks again; this page decides only what to show.
(() => {
  const api = window.cihofAdmin;
  const view = document.getElementById('view');
  document.getElementById('close').addEventListener('click', () => api.action('close'));

  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (value !== undefined && value !== null) node.setAttribute(key, value);
    }
    for (const child of children.flat()) node.append(child);
    return node;
  };

  async function render() {
    const state = await api.state();
    view.replaceChildren();
    if (!state.hasPasscode) return state.setupAllowed ? setup() : notSetUp();
    if (state.unlocked) return panel(state);
    if (state.lockedForMs > 0) return locked(state.lockedForMs);
    return keypad({
      prompt: 'Enter the admin passcode',
      onSubmit: async (code, fail) => {
        const result = await api.unlock(code);
        if (result.ok) return render();
        if (result.lockedForMs > 0) return locked(result.lockedForMs);
        fail('That passcode is not right.');
      },
    });
  }

  function notSetUp() {
    view.append(
      el('p', {}, 'Admin settings have not been set up on this display yet.'),
      el('p', { class: 'muted' }, 'With a keyboard attached, press Ctrl+Shift+A to choose an admin passcode.'),
    );
  }

  function locked(ms) {
    const seconds = Math.ceil(ms / 1000);
    view.replaceChildren(el('p', { class: 'prompt' }, `Too many tries. Try again in ${seconds} seconds.`));
    setTimeout(render, Math.min(ms, 5000));
  }

  function setup() {
    let first = null;
    const ask = (prompt) => keypad({
      prompt,
      onSubmit: async (code, fail) => {
        if (first === null) {
          if (!/^\d{4,12}$/.test(code)) return fail('Use 4 to 12 digits.');
          first = code;
          view.replaceChildren();
          return ask('Enter the same passcode again');
        }
        if (code !== first) { first = null; view.replaceChildren(); ask('Choose an admin passcode (4 to 12 digits)'); return; }
        const result = await api.setPasscode(code);
        if (!result.ok) return fail(result.problem);
        render();
      },
    });
    ask('Choose an admin passcode (4 to 12 digits)');
  }

  function keypad({ prompt, onSubmit }) {
    let code = '';
    const dots = el('p', { class: 'dots', 'aria-label': 'Digits entered' });
    const error = el('p', { class: 'error prompt', role: 'alert' });
    const show = () => { dots.textContent = '•'.repeat(code.length); };
    const press = (digit) => { if (code.length < 12) { code += digit; error.textContent = ''; show(); } };
    const fail = (message) => { code = ''; show(); error.textContent = message; };
    const submit = () => { if (code) onSubmit(code, fail); };
    const pad = el('div', { class: 'pad' },
      ...'123456789'.split('').map((digit) => el('button', { type: 'button', onclick: () => press(digit) }, digit)),
      el('button', { type: 'button', onclick: () => { code = code.slice(0, -1); show(); }, 'aria-label': 'Delete' }, '⌫'),
      el('button', { type: 'button', onclick: () => press('0') }, '0'),
      el('button', { type: 'button', onclick: submit }, 'OK'),
    );
    document.onkeydown = (event) => {
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') { code = code.slice(0, -1); show(); }
      else if (event.key === 'Enter') submit();
    };
    view.append(el('p', { class: 'prompt' }, prompt), dots, error, pad);
  }

  function panel(state) {
    document.onkeydown = null;
    const act = (name, confirmText) => async () => {
      if (confirmText && !window.confirm(confirmText)) return;
      await api.action(name);
    };
    const toggle = (key, label, help) => el('div', { class: 'toggle' },
      el('div', {}, el('strong', {}, label), el('p', { class: 'muted' }, help)),
      el('button', {
        type: 'button', 'aria-pressed': String(state.debug[key]),
        onclick: async () => { const next = await api.setDebug({ [key]: !state.debug[key] }); panel({ ...state, ...next, unlocked: true }); },
      }, state.debug[key] ? 'On' : 'Off'),
    );
    const times = ['off', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00'];
    if (!times.includes(state.settings.restartAt)) times.push(state.settings.restartAt);

    view.replaceChildren(
      el('h2', {}, 'This display'),
      el('dl', {},
        el('dt', {}, 'Release'), el('dd', {}, state.app.release),
        el('dt', {}, 'Content'), el('dd', {}, state.app.content),
        el('dt', {}, 'People'), el('dd', {}, String(state.app.people)),
        el('dt', {}, 'App'), el('dd', {}, `${state.app.version} · ${state.app.platform} · port ${state.settings.port}`),
      ),

      el('h2', {}, 'Exhibit'),
      el('div', { class: 'row' },
        el('button', { type: 'button', onclick: act('home') }, 'Back to the start'),
        el('button', { type: 'button', onclick: act('reload') }, 'Reload'),
        el('button', { type: 'button', onclick: act('recovery') }, 'Recovery panel'),
      ),

      el('h2', {}, 'Application'),
      el('div', { class: 'row' },
        el('button', { type: 'button', onclick: act('restart', 'Restart the exhibit app now?') }, 'Restart app'),
        el('button', { type: 'button', class: 'danger', onclick: act('exit', 'Close the exhibit and show the desktop? It stays closed until it is started again or the PC restarts.') }, 'Exit to desktop'),
      ),

      el('h2', {}, 'Debugging'),
      el('p', { class: 'note' }, 'These turn themselves off when the app next restarts, including the nightly restart.'),
      toggle('devtools', 'Developer tools', 'Opens Chromium developer tools and allows browser shortcuts (reload, zoom, inspect).'),
      toggle('menus', 'Menus and window', 'Shows the app in a normal window with its menu bar and a right-click menu.'),
      toggle('cursor', 'Mouse pointer', 'Shows the pointer, which is hidden on the touchscreen.'),

      el('h2', {}, 'Settings'),
      el('div', { class: 'toggle' },
        el('div', {}, el('strong', {}, 'Daily restart'), el('p', { class: 'muted' }, 'Keeps a display that runs for months from slowing down.')),
        el('select', {
          'aria-label': 'Daily restart time',
          onchange: async (event) => { await api.setSetting('restartAt', event.target.value); },
        }, ...times.map((time) => el('option', { value: time, ...(time === state.settings.restartAt ? { selected: '' } : {}) }, time === 'off' ? 'Off' : time))),
      ),
      el('div', { class: 'toggle' },
        el('div', {}, el('strong', {}, 'Start at sign-in'), el('p', { class: 'muted' }, 'Opens the exhibit when this computer account signs in.')),
        el('button', {
          type: 'button', 'aria-pressed': String(state.settings.startAtLogin),
          onclick: async () => { const next = await api.setSetting('startAtLogin', !state.settings.startAtLogin); panel({ ...state, ...next, unlocked: true }); },
        }, state.settings.startAtLogin ? 'On' : 'Off'),
      ),
      el('div', { class: 'row' }, el('button', { type: 'button', onclick: () => changePasscode(state) }, 'Change passcode')),
    );
  }

  function changePasscode(state) {
    let first = null;
    view.replaceChildren();
    const ask = (prompt) => keypad({
      prompt,
      onSubmit: async (code, fail) => {
        if (first === null) {
          if (!/^\d{4,12}$/.test(code)) return fail('Use 4 to 12 digits.');
          first = code; view.replaceChildren(); return ask('Enter the new passcode again');
        }
        if (code !== first) { first = null; view.replaceChildren(); return ask('They did not match. Choose a new passcode'); }
        const result = await api.setPasscode(code);
        if (!result.ok) return fail(result.problem);
        panel({ ...state, unlocked: true });
      },
    });
    ask('Choose a new passcode (4 to 12 digits)');
  }

  render().catch((error) => { view.textContent = error.message; });
})();
