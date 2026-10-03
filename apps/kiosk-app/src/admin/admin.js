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
      attractSection(state),

      el('h2', {}, 'This display'),
      el('dl', {},
        el('dt', {}, 'Release'), el('dd', {}, state.app.release),
        el('dt', {}, 'Content'), el('dd', {}, state.app.content),
        el('dt', {}, 'People'), el('dd', {}, String(state.app.people)),
        el('dt', {}, 'App'), el('dd', {}, `${state.app.version} · ${state.app.platform} · port ${state.settings.port}`),
      ),

      filmsSection(state),

      contentSection(state),
      connectionSection(state),

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

  // Where the films are played from: inside the app, or a folder chosen here.
  function filmsSection(state) {
    const films = state.films ?? { total: 0, inFolder: 0, inApp: 0, missing: [], folder: null, folderFound: false };
    const section = el('section', { 'aria-labelledby': 'filmsTitle' });
    const draw = (current) => {
      const playable = current.inFolder + current.inApp;
      let summary;
      if (current.total === 0) summary = 'This release has no films.';
      else if (current.folder && !current.folderFound) summary = `The films folder cannot be reached: ${current.folder}. Is the drive connected?`;
      else if (current.folder) summary = `${current.inFolder} of ${current.total} films are in the folder${current.inApp ? `, and ${current.inApp} more inside the app` : ''}.`;
      else if (current.inApp === current.total) summary = `All ${current.total} films are inside the app.`;
      else summary = `${current.inApp} of ${current.total} films are inside the app. Choose the folder that holds the films.`;
      const missing = current.total - playable;
      section.replaceChildren(
        el('h2', { id: 'filmsTitle' }, 'Films'),
        el('p', {}, summary),
        ...(current.folder ? [el('p', { class: 'muted' }, current.folder)] : []),
        ...(missing > 0 && current.total > 0 ? [el('p', { class: 'error' }, `${missing} ${missing === 1 ? 'film is' : 'films are'} not found, and show their captions and transcript instead${current.missing.length ? `: ${current.missing.slice(0, 3).join(', ')}${current.missing.length > 3 ? '…' : ''}` : ''}.`)] : []),
        el('div', { class: 'row' },
          el('button', { type: 'button', onclick: async () => draw((await api.chooseVideos()).films) }, current.folder ? 'Choose another folder…' : 'Choose the films folder…'),
          ...(current.folder ? [el('button', { type: 'button', onclick: async () => draw((await api.clearVideos()).films) }, 'Stop using the folder')] : []),
        ),
      );
    };
    draw(films);
    return section;
  }

  // The display's content: as delivered, or an update made with the staff
  // portal, any of which can be shown again. Updates are files staff bring
  // on a USB stick or from a shared folder.
  function contentSection(state) {
    const section = el('section', { class: 'content', 'aria-labelledby': 'contentTitle' });
    const when = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');
    const short = (id) => String(id ?? '').replace(/^content-/, '').slice(0, 8);
    const run = async (work, message = '') => {
      try { draw(await work(), message); } catch (error) { draw(state.content, '', error.message); }
    };
    const draw = (next, message = '', problem = '') => {
      const current = next.content ?? next;
      state = { ...state, content: current };
      if (current.unavailable) {
        section.replaceChildren(el('h2', { id: 'contentTitle' }, 'Content'), el('p', { class: 'error' }, 'Content updates are not available on this display: its content store could not be opened. The delivered content is shown.'));
        return;
      }
      const showing = current.onDelivered ? current.delivered : current.history.find((entry) => entry.contentVersion === current.active);
      const pending = current.pending;
      const describe = (entry) => [entry.createdBy, when(entry.createdAt)].filter(Boolean).join(' · ');

      const pendingBlock = pending ? el('div', { class: 'pending' },
        el('p', {}, el('strong', {}, pending.file)),
        ...(pending.changes ? [
          el('p', { class: 'muted' }, `Made by ${pending.changes.createdBy ?? 'someone'}${pending.changes.createdAt ? `, ${when(pending.changes.createdAt)}` : ''}.${pending.changes.newFilms ? ` Brings ${pending.changes.newFilms} film(s).` : ''}`),
          ...(pending.changes.summary.length ? [el('ul', {}, ...pending.changes.summary.slice(0, 8).map((line) => el('li', {}, line)))] : []),
        ] : []),
        ...(pending.problems.length
          ? [el('p', { class: 'error' }, `This update cannot be applied: ${pending.problems.join(' ')}`)]
          : [
            ...(pending.stale ? [el('p', { class: 'note' }, pending.stale)] : []),
            el('div', { class: 'row' },
              el('button', {
                type: 'button', class: 'primary',
                onclick: () => {
                  if (pending.stale && !window.confirm('Apply it anyway? What changed on this display since it was made will be replaced. It can be shown again from the list below.')) return;
                  run(() => api.applyUpdate({ force: Boolean(pending.stale), now: true }), 'Applied. The display is showing it now.');
                },
              }, 'Apply and show now'),
              el('button', {
                type: 'button',
                onclick: () => {
                  if (pending.stale && !window.confirm('Apply it anyway? What changed on this display since it was made will be replaced.')) return;
                  run(() => api.applyUpdate({ force: Boolean(pending.stale), now: false }), 'Applied. The display takes it over at its next reset between visitors.');
                },
              }, 'Apply at the next reset'),
            ),
          ]),
        el('div', { class: 'row' }, el('button', { type: 'button', onclick: () => run(() => api.cancelUpdate()) }, 'Cancel')),
      ) : null;

      const versionRow = (entry, delivered) => el('li', { class: 'version' },
        el('div', {},
          el('strong', {}, delivered ? 'The content delivered with the app' : `Update ${short(entry.contentVersion)}`),
          el('p', { class: 'muted' }, delivered ? 'Always kept: going back to it undoes every update.' : `${describe(entry)}${entry.summary[0] ? ` · ${entry.summary[0]}` : ''}`),
        ),
        entry.contentVersion === current.active
          ? el('span', { class: 'muted' }, 'Showing now')
          : el('button', {
            type: 'button',
            onclick: () => {
              if (!window.confirm(delivered ? 'Go back to the content delivered with the app? Every update stays in this list and can be shown again.' : 'Show this version on the display now?')) return;
              run(() => api.restoreContent({ id: delivered ? 'delivered' : entry.contentVersion, now: true }), 'Done. The display is showing it now.');
            },
          }, delivered ? 'Go back to it' : 'Show this version'),
      );

      section.replaceChildren(
        el('h2', { id: 'contentTitle' }, 'Content'),
        el('p', {}, current.onDelivered
          ? 'Showing the content delivered with the app.'
          : `Showing update ${short(current.active)}${showing ? ` (${describe(showing)})` : ''}.`),
        ...(showing && !current.onDelivered && showing.summary.length ? [el('ul', {}, ...showing.summary.slice(0, 5).map((line) => el('li', {}, line)))] : []),
        ...(pendingBlock ? [pendingBlock] : []),
        el('div', { class: 'row' },
          el('button', { type: 'button', onclick: () => run(() => api.chooseUpdate()) }, 'Load a content update…'),
          el('button', {
            type: 'button',
            onclick: async () => {
              try {
                const result = await api.exportContent();
                draw(result, result.exported ? `Exported to ${result.exported.file}. Open it in the staff portal to make the next update.` : '');
              } catch (error) {
                draw(state.content, '', error.message);
              }
            },
          }, 'Export current content…'),
        ),
        el('p', { class: 'muted' }, 'Export gives the staff portal what this display shows now, to make the next update from.'),
        el('h3', {}, 'Versions kept'),
        el('ul', { class: 'versions' },
          ...current.history.map((entry) => versionRow(entry, false)),
          versionRow(current.delivered, true),
        ),
        el('p', { class: 'prompt', role: 'status' }, message),
        ...(problem ? [el('p', { class: 'error', role: 'alert' }, problem)] : []),
      );
    };
    draw(state);
    return section;
  }

  // The staff portal reaching this display over the network, for as long as
  // staff open it. The code is read out to whoever is at the portal.
  function connectionSection(state) {
    const section = el('section', { class: 'connection', 'aria-labelledby': 'connectionTitle' });
    let timer = null;
    const when = (iso) => new Date(iso).toLocaleTimeString([], { timeStyle: 'short' });
    const draw = (connection, problem = '') => {
      clearInterval(timer);
      const choose = el('select', { 'aria-label': 'For how long' }, ...connection.minutes.map((minutes) => el('option', { value: String(minutes), ...(minutes === 30 ? { selected: 'selected' } : {}) }, `${minutes} minutes`)));
      const act = async (work) => {
        try { draw((await work()).connection); } catch (error) { draw(connection, error.message); }
      };
      const log = connection.log.length
        ? [el('h3', {}, 'What happened'), el('ul', { class: 'log' }, ...connection.log.slice(0, 8).map((entry) => el('li', {}, `${when(entry.at)} · ${entry.what}`)))]
        : [];
      section.replaceChildren(
        el('h2', { id: 'connectionTitle' }, 'Staff connection'),
        ...(connection.open
          ? [
            el('p', {}, 'Open. In the staff portal, connect to this display with:'),
            el('p', { class: 'code', 'aria-label': 'Pairing code' }, connection.code),
            el('p', {}, connection.addresses.length
              ? `Address: ${connection.addresses.join(' or ')}`
              : 'This display has no network address: connect it to the museum network first.'),
            el('p', { class: 'muted' }, `It closes by itself at ${when(connection.expiresAt)}. The exhibit carries on meanwhile, and the panel can be closed.`),
            el('div', { class: 'row' }, el('button', { type: 'button', onclick: () => act(() => api.closeConnection()) }, 'Close it now')),
          ]
          : [
            el('p', {}, 'Lets the staff portal fetch what this display shows and send it an update over the museum network, instead of on a USB stick. Closed until you open it, and only for as long as you choose.'),
            el('div', { class: 'row' }, choose, el('button', { type: 'button', class: 'primary', onclick: () => act(() => api.openConnection(Number(choose.value))) }, 'Open a staff connection')),
          ]),
        ...log,
        ...(problem ? [el('p', { class: 'error', role: 'alert' }, problem)] : []),
      );
      // While it is open, keep the time and what happened up to date.
      if (connection.open) {
        timer = setInterval(async () => {
          if (!section.isConnected) { clearInterval(timer); return; }
          try { draw((await api.state()).connection); } catch { /* the panel is closing */ }
        }, 5000);
      }
    };
    draw(state.connection);
    return section;
  }

  // What the display shows while nobody is using it. Choices are held here
  // until Save; Preview shows them for thirty seconds without saving.
  function attractSection(state) {
    const saved = {
      attractMode: state.settings.attractMode,
      attractRotate: state.settings.attractRotate,
      spotlightSeconds: state.settings.spotlightSeconds,
      motion: state.settings.motion,
      theme: state.settings.theme,
    };
    const draft = { ...saved };
    const section = el('section', { class: 'attract', 'aria-labelledby': 'attractTitle' });
    const modes = [
      ['mosaic', 'Mosaic', 'The whole hall in greyscale, one portrait in colour at a time.'],
      ['names', 'Name wall', 'Every name, in slow rows. No photographs, so photo quality never shows.'],
      ['stacked', 'Stacked', 'Names above a strip of portraits; the spotlight moves along the strip.'],
    ];

    const draw = (message = '') => {
      const changed = Object.keys(saved).some((key) => draft[key] !== saved[key]);
      const switchRow = (key, label, help) => el('div', { class: 'toggle' },
        el('div', {}, el('strong', {}, label), el('p', { class: 'muted' }, help)),
        el('button', { type: 'button', 'aria-pressed': String(draft[key]), onclick: () => { draft[key] = !draft[key]; draw(); } }, draft[key] ? 'On' : 'Off'),
      );
      section.replaceChildren(
        el('h2', { id: 'attractTitle' }, 'Attract screen and colours'),
        el('p', { class: 'muted' }, `What the display shows while nobody is using it. Now showing: ${modes.find(([id]) => id === saved.attractMode)?.[1] ?? saved.attractMode}.`),
        el('div', { class: 'cards', role: 'radiogroup', 'aria-label': 'Attract screen' },
          ...modes.map(([id, name, help]) => el('button', {
            type: 'button', role: 'radio', class: `card card--${id}`, 'aria-checked': String(draft.attractMode === id),
            onclick: () => { draft.attractMode = id; draw(); },
          }, el('span', { class: 'card__preview', 'aria-hidden': 'true' }), el('strong', {}, name), el('span', { class: 'muted' }, help))),
        ),
        switchRow('attractRotate', 'Rotate through all three', 'A different screen each time the display returns to idle'),
        el('div', { class: 'toggle' },
          el('div', {}, el('strong', {}, 'Spotlight moves every'), el('p', { class: 'muted' }, 'Mosaic and Stacked only')),
          el('div', { class: 'segments', role: 'radiogroup', 'aria-label': 'Spotlight moves every' },
            ...[4, 6, 10].map((seconds) => el('button', {
              type: 'button', role: 'radio', 'aria-checked': String(draft.spotlightSeconds === seconds),
              onclick: () => { draft.spotlightSeconds = seconds; draw(); },
            }, `${seconds} s`)),
          ),
        ),
        switchRow('motion', 'Motion', 'Off stops the drifting rows; the spotlight still moves, without animating'),
        el('div', { class: 'toggle' },
          el('div', {}, el('strong', {}, 'Colours'), el('p', { class: 'muted' }, 'Dark as designed, or light for a bright room. The whole exhibit; films always play on black.')),
          el('div', { class: 'segments', role: 'radiogroup', 'aria-label': 'Colours' },
            ...[['dark', 'Dark'], ['light', 'Light']].map(([theme, label]) => el('button', {
              type: 'button', role: 'radio', 'aria-checked': String(draft.theme === theme),
              onclick: () => { draft.theme = theme; draw(); },
            }, label)),
          ),
        ),
        el('p', { class: 'muted' }, 'Saved on this display only. The display shows its attract screen, in these colours, as soon as you save.'),
        el('div', { class: 'row' },
          el('button', { type: 'button', onclick: () => api.previewAttract({ ...draft }) }, 'Preview for 30 s'),
          el('button', {
            type: 'button', class: 'primary', ...(changed ? {} : { disabled: '' }),
            onclick: async () => {
              try {
                for (const key of Object.keys(draft)) {
                  if (draft[key] !== saved[key]) await api.setSetting(key, draft[key]);
                }
                Object.assign(saved, draft);
                draw('Saved.');
              } catch (error) {
                draw(error.message);
              }
            },
          }, 'Save'),
        ),
        el('p', { class: 'prompt', role: 'status' }, message),
      );
    };
    draw();
    return section;
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
