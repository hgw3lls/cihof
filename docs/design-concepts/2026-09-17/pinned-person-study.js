const installation = document.getElementById('installation');
const fieldContent = document.getElementById('fieldContent');
const focusImage = document.getElementById('focusImage');
const focusInitials = document.getElementById('focusInitials');
const assetRoot = location.pathname.startsWith('/cihof/') ? '/cihof/' : '/';

const state = {
  people: [],
  byId: new Map(),
  relationships: [],
  years: [],
  selectedId: '',
  history: [],
  view: 'people',
  yearIndex: 0,
  query: '',
  theme: 'light',
};

function element(tag, className, value) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (value !== undefined) item.textContent = value;
  return item;
}

function selectedPerson() {
  return state.byId.get(state.selectedId);
}

function portraitUrl(person) {
  return `${assetRoot}${person.primaryImageUrl.replace(/^\/+/, '')}`;
}

function initials(person) {
  return person.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('');
}

function portrait(person) {
  const frame = element('span', 'photo');
  const fallback = element('span', 'photo__initials', initials(person));
  const image = element('img');
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.draggable = false;
  image.onload = async () => {
    const loadedSrc = image.currentSrc;
    try { await image.decode(); } catch { /* Keep the initials if decoding fails. */ }
    if (!image.isConnected || image.currentSrc !== loadedSrc) return;
    if (image.naturalWidth >= 80 && image.naturalHeight >= 80) frame.classList.add('is-ready');
  };
  image.onerror = () => image.remove();
  frame.append(fallback, image);
  image.src = portraitUrl(person);
  return frame;
}

function updateSummaryTabStop() {
  const summary = document.getElementById('focusSummary');
  summary.tabIndex = summary.scrollHeight > summary.clientHeight + 1 ? 0 : -1;
}

function renderFocus() {
  const person = selectedPerson();
  if (!person) return;
  document.getElementById('focusYear').textContent = `CLASS OF ${person.classYear}`;
  const name = document.getElementById('focusName');
  name.textContent = person.name;
  name.classList.toggle('is-long', person.name.length > 26);
  document.getElementById('focusSummary').textContent = person.storySummary || person.lifeWorkSummary || '';
  requestAnimationFrame(updateSummaryTabStop);
  document.getElementById('backButton').hidden = state.history.length === 0;

  focusImage.style.visibility = 'hidden';
  focusInitials.textContent = initials(person);
  focusInitials.hidden = false;
  focusImage.alt = `Portrait of ${person.name}`;
  const currentId = person.id;
  focusImage.onload = async () => {
    const loadedSrc = focusImage.currentSrc;
    try { await focusImage.decode(); } catch { /* Keep the initials if decoding fails. */ }
    if (focusImage.currentSrc !== loadedSrc) return;
    if (state.selectedId !== currentId || focusImage.naturalWidth < 80 || focusImage.naturalHeight < 80) return;
    focusImage.style.visibility = 'visible';
    focusInitials.hidden = true;
  };
  focusImage.onerror = () => { if (state.selectedId === currentId) focusInitials.hidden = false; };
  focusImage.src = portraitUrl(person);
}

function selectPerson(id, remember = true) {
  if (!state.byId.has(id) || id === state.selectedId) return;
  if (remember) state.history.push(state.selectedId);
  state.selectedId = id;
  if (state.view !== 'years') state.yearIndex = Math.max(0, state.years.indexOf(selectedPerson().classYear));
  renderFocus();
  renderField();
}

function setView(view) {
  if (!['people', 'links', 'years'].includes(view)) return;
  state.view = view;
  for (const button of document.querySelectorAll('[data-view]')) {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  renderField();
}

function personTile(person) {
  const button = element('button', 'person-tile');
  button.type = 'button';
  button.setAttribute('aria-label', `Select ${person.name}, Class of ${person.classYear}`);
  button.addEventListener('click', () => selectPerson(person.id));
  const name = element('span', 'person-tile__name', person.name);
  name.append(element('small', '', `Class of ${person.classYear}`));
  button.append(portrait(person), name);
  return button;
}

function renderPeople() {
  const tools = element('div', 'people-tools');
  const count = element('strong');
  const label = element('label');
  const input = element('input');
  input.type = 'search';
  input.placeholder = 'Find a person or year';
  input.value = state.query;
  input.setAttribute('aria-label', 'Find a person or year');
  label.append(input);
  tools.append(count, label);
  const grid = element('div', 'people-grid');
  const update = () => {
    grid.replaceChildren();
    const query = state.query.trim().toLocaleLowerCase();
    const matches = state.people.filter((person) => person.id !== state.selectedId && (
      !query || person.name.toLocaleLowerCase().includes(query) || String(person.classYear).includes(query)
    ));
    count.textContent = `${matches.length} TO EXPLORE`;
    if (matches.length === 0) {
      const selectedMatches = selectedPerson().name.toLocaleLowerCase().includes(query);
      grid.append(element('p', 'empty', selectedMatches ? 'ALREADY IN FOCUS' : 'NO MATCHING PEOPLE'));
    } else {
      grid.append(...matches.map(personTile));
    }
  };
  input.addEventListener('input', () => {
    state.query = input.value;
    update();
  });
  fieldContent.append(tools, grid);
  update();
}

function linkedPeople() {
  const selected = selectedPerson();
  const self = `person:${selected.id}`;
  const seen = new Set([selected.id]);
  const links = [];
  for (const relationship of state.relationships) {
    if (!['inducted_by_candidate', 'related_to'].includes(relationship.type)) continue;
    const outgoing = relationship.sourceEntityId === self;
    const incoming = relationship.targetEntityId === self;
    if (!outgoing && !incoming) continue;
    const id = (outgoing ? relationship.targetEntityId : relationship.sourceEntityId).replace(/^person:/, '');
    const person = state.byId.get(id);
    if (!person || seen.has(id)) continue;
    seen.add(id);
    const context = relationship.shortDescription || relationship.displayLabel || 'Archive relationship reference';
    links.push({ person, context });
  }
  for (const person of state.people) {
    if (person.classYear !== selected.classYear || seen.has(person.id)) continue;
    seen.add(person.id);
    links.push({ person, context: `Also in the Class of ${selected.classYear}` });
  }
  return links;
}

function renderLinks() {
  const links = linkedPeople();
  const heading = element('div', 'links-heading');
  heading.append(element('strong', '', `${links.length} LINKS`));
  const list = element('div', 'links-list');
  if (links.length === 0) list.append(element('p', 'empty', 'NO RECORDED LINKS'));
  for (const [index, item] of links.entries()) {
    const button = element('button', 'link-row');
    button.type = 'button';
    button.setAttribute('aria-label', `Select ${item.person.name}. ${item.context}`);
    button.addEventListener('click', () => selectPerson(item.person.id));
    const copy = element('span');
    copy.append(element('span', 'link-row__name', item.person.name), element('span', 'link-row__context', item.context));
    button.append(element('span', 'link-row__index', String(index + 1).padStart(2, '0')), portrait(item.person), copy);
    list.append(button);
  }
  fieldContent.append(heading, list);
}

function setYearIndex(index) {
  const next = Math.max(0, Math.min(state.years.length - 1, index));
  if (next === state.yearIndex) return;
  state.yearIndex = next;
  fieldContent.scrollTop = 0;
  updateYearView();
}

function updateYearView() {
  const year = state.years[state.yearIndex];
  const strip = document.getElementById('yearStrip');
  if (!strip) return;
  for (const button of strip.querySelectorAll('button')) {
    button.setAttribute('aria-current', String(Number(button.dataset.year) === year));
  }
  const active = strip.querySelector(`[data-year="${year}"]`);
  if (active) {
    const left = active.getBoundingClientRect().left - strip.getBoundingClientRect().left
      + strip.scrollLeft - (strip.clientWidth - active.clientWidth) / 2;
    strip.scrollLeft = left;
  }
  document.getElementById('cohortTitle').textContent = `CLASS OF ${year}`;
  const cohort = state.people.filter((person) => person.classYear === year && person.id !== state.selectedId);
  document.getElementById('cohortCount').textContent = `${cohort.length} ${year === selectedPerson().classYear ? 'OTHER ' : ''}PEOPLE`;
  const grid = document.getElementById('cohortGrid');
  grid.replaceChildren(...cohort.map(personTile));
  if (cohort.length === 0) grid.append(element('p', 'empty', 'THIS CLASS IS IN FOCUS'));
}

function renderYears() {
  const strip = element('div', 'year-strip');
  strip.id = 'yearStrip';
  strip.setAttribute('role', 'group');
  strip.setAttribute('aria-label', 'Induction classes');
  for (const [index, year] of state.years.entries()) {
    const count = state.people.filter((person) => person.classYear === year).length;
    const button = element('button');
    button.type = 'button';
    button.dataset.year = String(year);
    button.setAttribute('aria-label', `Class of ${year}, ${count} people`);
    button.append(element('strong', '', String(year)), element('small', '', `${count} PEOPLE`));
    button.addEventListener('click', () => setYearIndex(index));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = Math.max(0, Math.min(state.years.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
      setYearIndex(next);
      strip.children[next].focus();
    });
    strip.append(button);
  }
  const heading = element('div', 'cohort-heading');
  const title = element('h2');
  title.id = 'cohortTitle';
  const count = element('span');
  count.id = 'cohortCount';
  heading.append(title, count);
  const grid = element('div', 'cohort-grid');
  grid.id = 'cohortGrid';
  let swipeStart = null;
  grid.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches[0];
    swipeStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  grid.addEventListener('touchend', (event) => {
    if (!swipeStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - swipeStart.x;
    const dy = touch.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    event.preventDefault();
    setYearIndex(state.yearIndex + (dx < 0 ? 1 : -1));
  }, { passive: false });
  fieldContent.append(strip, heading, grid);
  updateYearView();
}

function renderField() {
  fieldContent.replaceChildren();
  fieldContent.scrollTop = 0;
  if (state.view === 'people') renderPeople();
  else if (state.view === 'links') renderLinks();
  else renderYears();
}

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});
document.getElementById('themeButton').addEventListener('click', () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  installation.dataset.theme = state.theme;
  const button = document.getElementById('themeButton');
  button.textContent = state.theme === 'light' ? 'DARK' : 'LIGHT';
  button.setAttribute('aria-label', `Switch to ${state.theme === 'light' ? 'dark' : 'light'} mode`);
});
document.getElementById('backButton').addEventListener('click', () => {
  const previous = state.history.pop();
  if (previous) selectPerson(previous, false);
});
window.addEventListener('resize', updateSummaryTabStop);

async function initialize() {
  try {
    const response = await fetch(`${assetRoot}data/cihof-runtime-data.json`);
    if (!response.ok) throw new Error(`Archive data request returned ${response.status}`);
    const data = await response.json();
    state.people = data.inductees.filter((person) => person.primaryImageUrl).sort((a, b) => a.name.localeCompare(b.name));
    state.byId = new Map(state.people.map((person) => [person.id, person]));
    state.relationships = data.entityRelationships.relationships.filter((relationship) => relationship.sourceEntityId.startsWith('person:') && relationship.targetEntityId.startsWith('person:'));
    state.years = [...new Set(state.people.map((person) => person.classYear).filter(Boolean))].sort((a, b) => a - b);
    state.selectedId = state.byId.has('alex-machaskee-2010') ? 'alex-machaskee-2010' : state.people[0].id;
    state.yearIndex = Math.max(0, state.years.indexOf(selectedPerson().classYear));
    renderFocus();
    renderField();
  } catch (error) {
    fieldContent.replaceChildren(element('p', 'load-message', 'ARCHIVE DATA UNAVAILABLE'));
    console.error(error);
  }
}

initialize();
