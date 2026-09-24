import { forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation } from 'd3-force';

const installation = document.getElementById('installation');
const fieldContent = document.getElementById('fieldContent');
const focusImage = document.getElementById('focusImage');
const focusInitials = document.getElementById('focusInitials');
const assetRoot = location.pathname.startsWith('/cihof/') ? '/cihof/' : '/';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let linkMap = null;
let transcriptRequest = null;

const state = {
  people: [],
  byId: new Map(),
  relationships: [],
  years: [],
  mediaById: new Map(),
  selectedId: '',
  history: [],
  view: 'people',
  recordOpen: false,
  returnScroll: 0,
  query: '',
  linkQuery: '',
  activeMedia: null,
  mediaPanel: 'video',
  timelineScrollLeft: null,
  timelineYear: null,
  timelineTargetYear: null,
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

function mediaUrl(path) {
  return `${assetRoot}${path.replace(/^\/+/, '')}`;
}

function portraitUrl(person) {
  return mediaUrl(person.primaryImageUrl);
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
  const yearLabel = document.getElementById('focusYear');
  const name = document.getElementById('focusName');
  const summary = document.getElementById('focusSummary');
  document.querySelector('.focus').setAttribute('aria-label', person ? 'Selected person' : 'Archive overview');
  document.getElementById('backButton').hidden = state.history.length === 0;
  if (!person) {
    yearLabel.textContent = `${state.years.filter((year) => state.people.some((item) => item.classYear === year)).length} CLASSES`;
    name.textContent = `${state.people.length} INDUCTEES`;
    name.classList.remove('is-long');
    name.classList.add('is-neutral');
    summary.textContent = `${state.years[0]} - ${state.years.at(-1)}`;
    focusImage.style.visibility = 'hidden';
    focusImage.removeAttribute('src');
    focusInitials.hidden = true;
    requestAnimationFrame(updateSummaryTabStop);
    return;
  }
  yearLabel.textContent = `CLASS OF ${person.classYear}`;
  name.textContent = person.name;
  name.classList.remove('is-neutral');
  name.classList.toggle('is-long', person.name.length > 26);
  summary.textContent = person.honoredForSummary || person.lifeWorkSummary || person.storySummary || '';
  requestAnimationFrame(updateSummaryTabStop);

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

function selectPerson(id, remember = true, media = null) {
  if ((id && !state.byId.has(id)) || (id === state.selectedId && !media)) return;
  if (remember && id !== state.selectedId) state.history.push(state.selectedId);
  state.selectedId = id;
  state.recordOpen = false;
  state.activeMedia = media;
  state.mediaPanel = 'video';
  renderFocus();
  renderField();
}

function setView(view) {
  if (!['people', 'links', 'years'].includes(view)) return;
  if (view === 'years' && state.view !== 'years') state.timelineTargetYear = selectedPerson()?.classYear ?? state.years.find((year) => state.people.some((person) => (state.mediaById.get(person.id) || []).length && person.classYear === year));
  state.view = view;
  state.recordOpen = false;
  state.activeMedia = null;
  renderField();
}

function setRecordOpen(open) {
  if (state.recordOpen === open || (open && !selectedPerson())) return;
  if (open) state.returnScroll = fieldContent.scrollTop;
  state.recordOpen = open;
  if (open) state.activeMedia = null;
  renderField();
  if (open) document.getElementById('recordTitle')?.focus({ preventScroll: true });
  else {
    fieldContent.scrollTop = state.returnScroll;
    document.getElementById(state.view === 'links' ? 'mapCenterButton' : state.view === 'years' ? 'focusRecordButton' : 'recordButton')?.focus({ preventScroll: true });
  }
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
      const selectedMatches = selectedPerson()?.name.toLocaleLowerCase().includes(query);
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

function biographyParagraphs(person) {
  const raw = (person.bioText || person.lifeWorkSummary || person.storySummary || '').trim();
  const text = /^[a-z]/.test(raw) ? `${person.name} ${raw}` : raw;
  const paragraphs = [];
  let start = 0;
  for (const { index, segment } of new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)) {
    const end = index + segment.length;
    if (end - start < 440 || !/\s$/.test(segment)) continue;
    if (/\b(?:Mr|Mrs|Ms|Dr|Rev|Prof|St|Jr|Sr|[A-Z])\.$/i.test(text.slice(start, end).trim())) continue;
    paragraphs.push(text.slice(start, end).trim());
    start = end;
  }
  if (start < text.length) paragraphs.push(text.slice(start).trim());
  return paragraphs;
}

function renderRecord() {
  const person = selectedPerson();
  const record = element('section', 'record-view');
  record.setAttribute('aria-label', `${person.name} full record`);
  const top = element('div', 'record-view__top');
  const close = element('button', '', 'CLOSE');
  close.type = 'button';
  close.addEventListener('click', () => setRecordOpen(false));
  top.append(element('span', '', 'CIHOF / INDUCTEE RECORD'), close);

  const mast = element('header', 'record-view__mast');
  mast.append(element('span', '', `CLASS OF ${person.classYear}`));
  const title = element('h2', '', 'FULL RECORD');
  title.id = 'recordTitle';
  title.tabIndex = -1;
  mast.append(title);

  const body = element('div', 'record-view__body');
  const story = element('article', 'record-view__story');
  story.append(element('h3', '', 'BIOGRAPHY'));
  for (const paragraph of biographyParagraphs(person)) story.append(element('p', '', paragraph));

  const notes = element('aside', 'record-view__notes');
  notes.append(element('h3', '', 'RECORD NOTES'));
  const facts = element('dl');
  const addFact = (label, value) => {
    if (!value) return;
    facts.append(element('dt', '', label), element('dd', '', value));
  };
  addFact('INDUCTED', String(person.classYear));
  addFact('HERITAGE', person.countryTags?.join(', '));
  addFact('INDUCTED BY', person.inductedBy);
  addFact('COMMUNITY', person.communityTags?.join(', '));
  notes.append(facts);
  if (person.honoredForSummary) {
    const honors = element('div', 'record-view__honors');
    honors.append(element('h3', '', 'HONORED FOR'), element('p', '', person.honoredForSummary));
    notes.append(honors);
  }
  body.append(story, notes);
  record.append(top, mast, body);
  fieldContent.append(record);
}

function linkedPeople() {
  const selected = selectedPerson();
  if (!selected) return [];
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
    links.push({ person, context, kind: 'archive' });
  }
  for (const person of state.people) {
    if (person.classYear !== selected.classYear || seen.has(person.id)) continue;
    seen.add(person.id);
    links.push({ person, context: `Also in the Class of ${selected.classYear}`, kind: 'class' });
  }
  return links;
}

function renderLinkIndex() {
  const view = element('section', 'link-index');
  const header = element('header', 'link-index__header');
  const heading = element('strong', '', 'RELATIONSHIP INDEX');
  const count = element('span');
  const label = element('label');
  const input = element('input');
  input.type = 'search';
  input.placeholder = 'Find a person';
  input.value = state.linkQuery;
  input.setAttribute('aria-label', 'Find a person in the relationship index');
  label.append(input);
  header.append(heading, count, label);
  const grid = element('div', 'link-index__grid');
  const update = () => {
    const query = state.linkQuery.trim().toLocaleLowerCase();
    const matches = state.people.filter((person) => !query || person.name.toLocaleLowerCase().includes(query) || String(person.classYear).includes(query));
    count.textContent = `${matches.length} / ${state.people.length}`;
    grid.replaceChildren();
    for (const person of matches) {
      const referenceCount = state.relationships.filter((relationship) =>
        ['inducted_by_candidate', 'related_to'].includes(relationship.type)
        && (relationship.sourceEntityId === `person:${person.id}` || relationship.targetEntityId === `person:${person.id}`)).length;
      const button = element('button', 'link-index__person');
      button.type = 'button';
      button.setAttribute('aria-label', `Explore links for ${person.name}, Class of ${person.classYear}, ${referenceCount} archive references`);
      button.append(element('strong', '', person.name), element('span', '', `CLASS OF ${person.classYear}`), element('small', '', `${referenceCount} ARCHIVE ${referenceCount === 1 ? 'REFERENCE' : 'REFERENCES'}`));
      button.addEventListener('click', () => selectPerson(person.id));
      grid.append(button);
    }
    if (matches.length === 0) grid.append(element('p', 'empty', 'NO MATCHING PEOPLE'));
  };
  input.addEventListener('input', () => {
    state.linkQuery = input.value;
    update();
  });
  view.append(header, grid);
  fieldContent.append(view);
  update();
}

function mapNode(person) {
  const button = element('button', 'map-node');
  button.type = 'button';
  button.dataset.personId = person.id;
  const caption = element('span', 'map-node__caption');
  caption.append(element('strong', '', person.name), element('small'));
  button.append(portrait(person), caption);
  button.addEventListener('click', () => {
    const id = button.dataset.personId;
    if (id === state.selectedId) setRecordOpen(true);
    else selectPerson(id);
  });
  return button;
}

function mapLayout(items, width, height, positions) {
  const scale = Math.min(2.1, Math.max(0.85, height / 760));
  const center = { x: width / 2, y: height / 2 };
  const outer = Math.min(330 * scale, width / 2 - 85 * scale, height / 2 - 85 * scale);
  const inner = Math.min(210 * scale, outer - 70 * scale);
  const counts = { archive: items.filter((item) => item.kind === 'archive').length, class: items.filter((item) => item.kind === 'class').length };
  const sequence = { archive: 0, class: 0 };
  const nodes = [{ id: state.selectedId, kind: 'center', x: center.x, y: center.y, fx: center.x, fy: center.y }];
  for (const item of items) {
    const radius = item.kind === 'archive' ? inner : outer;
    const angle = -Math.PI / 2 + (sequence[item.kind]++ / counts[item.kind]) * Math.PI * 2 + (item.kind === 'archive' ? 0.36 : 0);
    const previous = positions.get(item.person.id);
    nodes.push({
      id: item.person.id,
      kind: item.kind,
      x: previous?.x ?? center.x + Math.cos(angle) * radius,
      y: previous?.y ?? center.y + Math.sin(angle) * radius,
    });
  }
  const edges = items.map((item) => ({ source: state.selectedId, target: item.person.id, kind: item.kind }));
  const simulation = forceSimulation(nodes)
    .force('link', forceLink(edges).id((node) => node.id).distance((edge) => edge.kind === 'archive' ? inner : outer).strength(0.2))
    .force('collide', forceCollide((node) => (node.kind === 'center' ? 166 : node.kind === 'archive' ? 90 : 78) * scale).iterations(3))
    .force('charge', forceManyBody().strength((node) => node.kind === 'center' ? -170 * scale : -55 * scale))
    .force('radial', forceRadial((node) => node.kind === 'archive' ? inner : outer, center.x, center.y).strength((node) => node.kind === 'center' ? 0 : 0.14))
    .stop();
  simulation.tick(280);
  const targets = new Map();
  for (const node of nodes) {
    const margin = (node.kind === 'center' ? 166 : node.kind === 'archive' ? 90 : 78) * scale;
    targets.set(node.id, {
      x: Math.max(margin, Math.min(width - margin, node.x)),
      y: Math.max(margin, Math.min(height - margin, node.y)),
    });
  }
  return { targets, scale, center };
}

function centerMapViewport() {
  if (!linkMap) return;
  const { viewport, stage } = linkMap;
  viewport.scrollLeft = (stage.clientWidth - viewport.clientWidth) / 2;
  viewport.scrollTop = (stage.clientHeight - viewport.clientHeight) / 2;
}

function clearMapLabelOverlaps(targets, buttons, stage) {
  const ids = [...targets.keys()];
  const boxes = new Map(ids.map((id) => {
    const { width, height } = buttons.get(id).getBoundingClientRect();
    return [id, { width, height }];
  }));
  const keepInside = (id) => {
    const point = targets.get(id);
    const box = boxes.get(id);
    point.x = Math.max(box.width / 2 + 8, Math.min(stage.clientWidth - box.width / 2 - 8, point.x));
    point.y = Math.max(box.height / 2 + 8, Math.min(stage.clientHeight - box.height / 2 - 8, point.y));
  };
  for (let pass = 0; pass < 30; pass += 1) {
    let collisions = 0;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = targets.get(ids[i]);
        const b = targets.get(ids[j]);
        const aBox = boxes.get(ids[i]);
        const bBox = boxes.get(ids[j]);
        const overlapX = (aBox.width + bBox.width) / 2 + 6 - Math.abs(a.x - b.x);
        const overlapY = (aBox.height + bBox.height) / 2 + 6 - Math.abs(a.y - b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;
        collisions += 1;
        const aShare = ids[i] === state.selectedId ? 0 : ids[j] === state.selectedId ? 1 : 0.5;
        const directionX = a.x <= b.x ? -1 : 1;
        a.x += directionX * overlapX * aShare;
        b.x -= directionX * overlapX * (1 - aShare);
        keepInside(ids[i]);
        keepInside(ids[j]);
        if ((aBox.width + bBox.width) / 2 + 6 - Math.abs(a.x - b.x) <= 0) continue;
        const directionY = a.y <= b.y ? -1 : 1;
        a.y += directionY * overlapY * aShare;
        b.y -= directionY * overlapY * (1 - aShare);
        keepInside(ids[i]);
        keepInside(ids[j]);
      }
    }
    if (!collisions) break;
  }
}

function updateLinkMap(animate = true) {
  if (!linkMap) return;
  if (linkMap.frame) cancelAnimationFrame(linkMap.frame);
  const items = linkedPeople();
  const archiveCount = items.filter((item) => item.kind === 'archive').length;
  const classCount = items.length - archiveCount;
  linkMap.count.textContent = `${items.length} CONNECTED LIVES`;
  linkMap.archiveCount.textContent = `${archiveCount} ARCHIVE ${archiveCount === 1 ? 'REFERENCE' : 'REFERENCES'}`;
  linkMap.classCount.textContent = `${classCount} CLASSMATES`;
  const { targets, scale, center } = mapLayout(items, linkMap.stage.clientWidth, linkMap.stage.clientHeight, linkMap.positions);
  linkMap.stage.style.setProperty('--map-scale', scale);
  const current = new Set(targets.keys());
  for (const [id, button] of linkMap.buttons) {
    if (current.has(id)) continue;
    button.remove();
    linkMap.buttons.delete(id);
    linkMap.positions.delete(id);
  }

  const entries = [{ person: selectedPerson(), kind: 'center', context: 'Open full record' }, ...items];
  const from = new Map();
  for (const entry of entries) {
    const { person, kind } = entry;
    let button = linkMap.buttons.get(person.id);
    if (!button) {
      button = mapNode(person);
      button.classList.add('map-node--entering');
      linkMap.buttons.set(person.id, button);
      linkMap.nodeLayer.append(button);
      requestAnimationFrame(() => button.classList.remove('map-node--entering'));
    }
    button.className = `map-node map-node--${kind}${button.classList.contains('map-node--entering') ? ' map-node--entering' : ''}`;
    button.id = kind === 'center' ? 'mapCenterButton' : '';
    button.setAttribute('aria-label', kind === 'center'
      ? `Open full record for ${person.name}`
      : kind === 'archive' ? `Select ${person.name}. ${entry.context}` : `Select ${person.name}, also in the Class of ${selectedPerson().classYear}`);
    button.querySelector('.map-node__caption small').textContent = kind === 'center' ? 'READ RECORD' : '';
    if (kind === 'center') button.querySelector('img').loading = 'eager';
    from.set(person.id, linkMap.positions.get(person.id) || center);
  }
  clearMapLabelOverlaps(targets, linkMap.buttons, linkMap.stage);

  const lines = new Map();
  linkMap.edges.replaceChildren();
  for (const item of items) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', `map-edge map-edge--${item.kind}`);
    linkMap.edges.append(line);
    lines.set(item.person.id, line);
  }
  const paint = (progress) => {
    const eased = 1 - (1 - progress) ** 3;
    for (const [id, target] of targets) {
      const origin = from.get(id);
      const point = { x: origin.x + (target.x - origin.x) * eased, y: origin.y + (target.y - origin.y) * eased };
      linkMap.positions.set(id, point);
      const button = linkMap.buttons.get(id);
      button.style.left = `${point.x}px`;
      button.style.top = `${point.y}px`;
    }
    const selected = linkMap.positions.get(state.selectedId);
    for (const [id, line] of lines) {
      const point = linkMap.positions.get(id);
      line.setAttribute('x1', selected.x);
      line.setAttribute('y1', selected.y);
      line.setAttribute('x2', point.x);
      line.setAttribute('y2', point.y);
    }
  };
  if (!animate || reducedMotion.matches || from.size === 0) {
    paint(1);
    return;
  }
  const started = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - started) / 720);
    paint(progress);
    if (progress < 1) linkMap.frame = requestAnimationFrame(tick);
    else linkMap.frame = 0;
  };
  paint(0);
  linkMap.frame = requestAnimationFrame(tick);
}

function renderLinks() {
  const view = element('section', 'link-map');
  view.setAttribute('aria-label', 'Portrait map of linked inductees');
  const header = element('header', 'link-map__header');
  const count = element('strong', '', 'LINKED LIVES');
  const legend = element('div', 'link-map__legend');
  const archive = element('span', 'link-map__legend-item link-map__legend-item--archive');
  const archiveCount = element('span');
  archive.append(archiveCount);
  const classYear = element('span', 'link-map__legend-item link-map__legend-item--class');
  const classCount = element('span');
  classYear.append(classCount);
  legend.append(archive, classYear);
  header.append(count, legend);
  const viewport = element('div', 'link-map__viewport');
  const stage = element('div', 'link-map__stage');
  const edges = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  edges.setAttribute('class', 'link-map__edges');
  edges.setAttribute('aria-hidden', 'true');
  const nodeLayer = element('div', 'link-map__nodes');
  stage.append(edges, nodeLayer);
  viewport.append(stage);
  view.append(header, viewport);
  fieldContent.append(view);
  linkMap = { root: view, viewport, stage, edges, nodeLayer, count, archiveCount, classCount, buttons: new Map(), positions: new Map(), frame: 0 };
  updateLinkMap(false);
  centerMapViewport();
}

function mediaKey(item) {
  return `${item.personId}-${item.index}`;
}

function filmDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'FILM';
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

function renderFilmProjection(item, person) {
  const projection = element('section', 'film-projection');
  projection.setAttribute('aria-label', `${person.name}, film ${item.index + 1}`);
  projection.dataset.panel = state.mediaPanel;
  const header = element('header', 'film-projection__header');
  const identity = element('div', 'film-projection__identity');
  identity.append(element('strong', '', person.name), element('span', '', `${person.classYear} / FILM ${item.index + 1} / ${filmDuration(item.durationSeconds)}`));
  const play = element('button', 'film-projection__play', 'PLAY');
  play.type = 'button';
  play.setAttribute('aria-label', 'Play film');
  const close = element('button', 'film-projection__close', 'CLOSE');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close film');
  close.addEventListener('click', () => {
    state.activeMedia = null;
    state.mediaPanel = 'video';
    renderField();
    document.getElementById(`film-${mediaKey(item)}`)?.querySelector('button')?.focus({ preventScroll: true });
  });
  header.append(identity, play, close);
  const tabs = element('div', 'film-projection__tabs');
  for (const [panel, label] of [['video', 'FILM'], ['transcript', 'TRANSCRIPT']]) {
    const button = element('button', '', label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(state.mediaPanel === panel));
    button.addEventListener('click', () => {
      state.mediaPanel = panel;
      projection.dataset.panel = panel;
      for (const tab of tabs.children) tab.setAttribute('aria-pressed', String(tab === button));
    });
    tabs.append(button);
  }
  const body = element('div', 'film-projection__body');
  const screen = element('div', 'film-projection__screen');
  const video = element('video');
  video.controls = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.poster = item.posterRuntimePath ? mediaUrl(item.posterRuntimePath) : portraitUrl(person);
  video.src = mediaUrl(item.runtimePath);
  video.setAttribute('aria-label', `Film ${item.index + 1} from ${person.name}'s archive`);
  play.addEventListener('click', () => { if (video.paused) video.play().catch(() => {}); else video.pause(); });
  video.addEventListener('play', () => { play.textContent = 'PAUSE'; play.setAttribute('aria-label', 'Pause film'); });
  video.addEventListener('pause', () => { play.textContent = 'PLAY'; play.setAttribute('aria-label', 'Play film'); });
  if (item.captionRuntimePath) {
    const track = element('track');
    track.kind = 'captions';
    track.src = mediaUrl(item.captionRuntimePath);
    track.srclang = 'en';
    track.label = 'English captions';
    track.default = true;
    video.append(track);
    video.addEventListener('loadedmetadata', () => { if (video.textTracks[0]) video.textTracks[0].mode = 'showing'; }, { once: true });
  }
  screen.append(video);
  const transcript = element('section', 'film-projection__transcript');
  transcript.setAttribute('aria-label', `Transcript for ${person.name}, film ${item.index + 1}`);
  const heading = element('div', 'film-projection__transcript-heading');
  heading.append(element('strong', '', 'CAPTIONS + TRANSCRIPT'), element('span', '', 'DRAFT / REVIEW PENDING'));
  const text = element('p', 'film-projection__transcript-body', item.transcriptRuntimePath ? 'LOADING TRANSCRIPT' : 'NO TRANSCRIPT FILE');
  text.tabIndex = 0;
  transcript.append(heading, text);
  body.append(screen, transcript);
  projection.append(header, tabs, body);
  if (item.transcriptRuntimePath) {
    const controller = new AbortController();
    transcriptRequest = controller;
    fetch(mediaUrl(item.transcriptRuntimePath), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Transcript request returned ${response.status}`);
        return response.text();
      })
      .then((content) => {
        if (!projection.isConnected) return;
        const draft = content.trim();
        text.textContent = draft.startsWith('Draft transcript generated from ')
          ? draft.split(/\r?\n\r?\n/).slice(1).join('\n\n').trim()
          : draft;
      })
      .catch(() => { if (projection.isConnected && !controller.signal.aborted) text.textContent = 'TRANSCRIPT UNAVAILABLE'; });
  }
  return projection;
}

function renderFilmEvent(item, person) {
  const event = element('article', 'film-event');
  event.id = `film-${mediaKey(item)}`;
  const open = state.activeMedia && mediaKey(state.activeMedia) === mediaKey(item);
  event.classList.toggle('is-open', Boolean(open));
  event.classList.toggle('is-selected', person.id === state.selectedId);
  const button = element('button', 'film-event__trigger');
  button.type = 'button';
  button.setAttribute('aria-expanded', String(Boolean(open)));
  button.setAttribute('aria-label', `${open ? 'Close' : 'Open'} film ${item.index + 1} for ${person.name}, ${filmDuration(item.durationSeconds)}`);
  const poster = element('span', 'film-event__poster');
  if (open) poster.append(element('span', 'film-event__showing', 'NOW SHOWING'));
  else {
    const image = element('img');
    image.src = item.posterRuntimePath ? mediaUrl(item.posterRuntimePath) : portraitUrl(person);
    image.alt = '';
    image.loading = 'lazy';
    image.draggable = false;
    poster.append(image, element('span', 'film-event__play', '▶'));
  }
  const copy = element('span', 'film-event__copy');
  copy.append(element('strong', '', person.name), element('small', '', `FILM ${item.index + 1} · ${filmDuration(item.durationSeconds)} · CC + TRANSCRIPT`));
  button.append(poster, copy);
  button.addEventListener('click', () => {
    if (open) {
      state.activeMedia = null;
      renderField();
      document.getElementById(event.id)?.querySelector('button')?.focus({ preventScroll: true });
    } else selectPerson(person.id, true, item);
  });
  event.append(button);
  return event;
}

function yearPosition(viewport, chapter) {
  return chapter.getBoundingClientRect().left - viewport.getBoundingClientRect().left + viewport.scrollLeft;
}

function renderYears() {
  const timeline = element('section', 'film-line');
  timeline.setAttribute('aria-label', 'Horizontal archive film timeline');
  timeline.classList.toggle('film-line--playing', Boolean(state.activeMedia));
  const heading = element('header', 'film-line__heading');
  const total = [...state.mediaById.values()].reduce((sum, videos) => sum + videos.length, 0);
  const headingTitle = element('strong', '', 'THE FILM LINE');
  const headingYear = element('span', 'film-line__current');
  const controls = element('div', 'film-line__controls');
  const previous = element('button', '', '←');
  const next = element('button', '', '→');
  previous.type = 'button';
  next.type = 'button';
  previous.setAttribute('aria-label', 'Previous year');
  next.setAttribute('aria-label', 'Next year');
  previous.title = 'Previous year';
  next.title = 'Next year';
  controls.append(previous, next);
  heading.append(headingTitle, headingYear, controls);
  timeline.append(heading);
  if (state.activeMedia) {
    const person = state.byId.get(state.activeMedia.personId);
    if (person) timeline.append(renderFilmProjection(state.activeMedia, person));
  }
  const viewport = element('div', 'film-line__viewport');
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', `Film timeline, ${state.years[0]} to ${state.years.at(-1)}; use left and right arrow keys to navigate`);
  const strip = element('div', 'film-line__strip');
  const chapters = new Map();
  const rail = element('nav', 'film-line__rail');
  rail.setAttribute('aria-label', 'Jump to year');
  const yearButtons = new Map();
  for (const year of state.years) {
    const people = state.people.filter((person) => person.classYear === year);
    const films = people.flatMap((person) => (state.mediaById.get(person.id) || []).map((item, index) => ({ ...item, personId: person.id, index, person })));
    const chapter = element('section', 'film-year');
    chapter.id = `film-year-${year}`;
    chapter.classList.toggle('film-year--empty', films.length === 0);
    chapter.classList.toggle('film-year--selected', selectedPerson()?.classYear === year);
    const yearHeading = element('header', 'film-year__heading');
    yearHeading.append(element('h2', '', String(year)), element('span', '', films.length ? `${films.length} ${films.length === 1 ? 'FILM' : 'FILMS'} / ${people.length} PEOPLE` : people.length ? `${people.length} PEOPLE / NO LOCAL FILMS` : 'NO CLASS RECORD'));
    chapter.append(yearHeading);
    const events = element('div', 'film-year__events');
    for (const { person, ...item } of films) events.append(renderFilmEvent(item, person));
    chapter.append(events);
    strip.append(chapter);
    chapters.set(year, chapter);
    const yearButton = element('button', 'film-line__year', String(year));
    yearButton.type = 'button';
    yearButton.setAttribute('aria-label', `Jump to ${year}, ${films.length} ${films.length === 1 ? 'film' : 'films'}`);
    yearButton.dataset.films = String(films.length);
    yearButton.addEventListener('click', () => {
      viewport.scrollTo({ left: yearPosition(viewport, chapter), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    });
    rail.append(yearButton);
    yearButtons.set(year, yearButton);
  }
  viewport.append(strip);
  timeline.append(viewport, rail);
  fieldContent.append(timeline);

  const markYear = (year) => {
    if (state.timelineYear === year && headingYear.textContent) return;
    state.timelineYear = year;
    headingYear.textContent = `${year} / ${state.years.at(-1)} · ${total} FILMS`;
    headingYear.dataset.year = String(year);
    previous.disabled = year === state.years[0];
    next.disabled = year === state.years.at(-1);
    for (const [entryYear, button] of yearButtons) {
      if (entryYear === year) button.setAttribute('aria-current', 'date');
      else button.removeAttribute('aria-current');
    }
    const activeButton = yearButtons.get(year);
    if (activeButton.offsetLeft < rail.scrollLeft) rail.scrollLeft = activeButton.offsetLeft;
    else if (activeButton.offsetLeft + activeButton.offsetWidth > rail.scrollLeft + rail.clientWidth) {
      rail.scrollLeft = activeButton.offsetLeft + activeButton.offsetWidth - rail.clientWidth;
    }
  };
  const currentYear = () => {
    const start = viewport.scrollLeft;
    const end = start + viewport.clientWidth;
    let current = state.years[0];
    let largestVisibleSpan = -1;
    for (const year of state.years) {
      const chapter = chapters.get(year);
      const visibleSpan = Math.max(0, Math.min(end, chapter.offsetLeft + chapter.offsetWidth) - Math.max(start, chapter.offsetLeft));
      if (visibleSpan > largestVisibleSpan) {
        largestVisibleSpan = visibleSpan;
        current = year;
      }
    }
    return current;
  };
  const jumpRelative = (step) => {
    const index = state.years.indexOf(currentYear());
    const year = state.years[Math.max(0, Math.min(state.years.length - 1, index + step))];
    viewport.scrollTo({ left: yearPosition(viewport, chapters.get(year)), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  };
  previous.addEventListener('click', () => jumpRelative(-1));
  next.addEventListener('click', () => jumpRelative(1));
  let scrollFrame = 0;
  viewport.addEventListener('scroll', () => {
    state.timelineScrollLeft = viewport.scrollLeft;
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; if (viewport.isConnected) markYear(currentYear()); });
  }, { passive: true });
  viewport.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    viewport.scrollLeft += event.deltaY;
    event.preventDefault();
  }, { passive: false });
  viewport.addEventListener('keydown', (event) => {
    if (event.target !== viewport) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      viewport.scrollBy({ left: viewport.clientWidth * (event.key === 'ArrowLeft' ? -0.7 : 0.7), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      event.preventDefault();
    } else if (event.key === 'Home' || event.key === 'End') {
      const year = event.key === 'Home' ? state.years[0] : state.years.at(-1);
      viewport.scrollTo({ left: yearPosition(viewport, chapters.get(year)), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      event.preventDefault();
    }
  });
  let drag = null;
  let dragged = false;
  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag = { x: event.clientX, left: viewport.scrollLeft };
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!drag) return;
    if (Math.abs(event.clientX - drag.x) > 6) dragged = true;
    if (dragged) viewport.scrollLeft = drag.left - (event.clientX - drag.x);
  });
  const endDrag = () => { drag = null; setTimeout(() => { dragged = false; }, 0); };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('click', (event) => { if (dragged) { event.preventDefault(); event.stopPropagation(); } }, true);

  const target = state.timelineTargetYear;
  state.timelineTargetYear = null;
  if (target && chapters.has(target)) viewport.scrollLeft = yearPosition(viewport, chapters.get(target));
  else if (state.timelineScrollLeft !== null) viewport.scrollLeft = state.timelineScrollLeft;
  else viewport.scrollLeft = yearPosition(viewport, chapters.get(state.years.find((year) => chapters.get(year).querySelector('.film-event'))));
  markYear(currentYear());
}

function renderField() {
  const person = selectedPerson();
  const reuseMap = Boolean(person && !state.recordOpen && state.view === 'links' && linkMap?.root.isConnected);
  if (!reuseMap) {
    const timelineViewport = fieldContent.querySelector('.film-line__viewport');
    if (timelineViewport) state.timelineScrollLeft = timelineViewport.scrollLeft;
    transcriptRequest?.abort();
    transcriptRequest = null;
    if (linkMap?.frame) cancelAnimationFrame(linkMap.frame);
    linkMap = null;
    fieldContent.querySelector('video')?.pause();
    fieldContent.replaceChildren();
    fieldContent.scrollTop = 0;
  }
  installation.dataset.view = state.view;
  installation.dataset.selection = person ? 'person' : 'none';
  installation.dataset.record = state.recordOpen ? 'open' : 'closed';
  installation.dataset.media = state.activeMedia ? 'open' : 'closed';
  const recordButton = document.getElementById('recordButton');
  recordButton.hidden = !person;
  recordButton.setAttribute('aria-pressed', String(state.recordOpen));
  if (person) recordButton.setAttribute('aria-label', `${state.recordOpen ? 'Close' : 'Open'} full record for ${person.name}`);
  const focusRecordButton = document.getElementById('focusRecordButton');
  focusRecordButton.hidden = !person || state.view !== 'years' || state.recordOpen;
  if (person) focusRecordButton.setAttribute('aria-label', `Open full record for ${person.name}`);
  document.getElementById('recordButtonLabel').textContent = state.recordOpen ? 'CLOSE RECORD' : 'READ RECORD';
  for (const button of document.querySelectorAll('.views button[data-view]')) {
    if (!state.recordOpen && button.dataset.view === state.view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  if (state.recordOpen) return renderRecord();
  if (state.view === 'people') renderPeople();
  else if (state.view === 'links') {
    if (!person) renderLinkIndex();
    else if (reuseMap) updateLinkMap();
    else renderLinks();
  }
  else renderYears();
}

document.querySelectorAll('.views button[data-view]').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});
document.getElementById('recordButton').addEventListener('click', () => setRecordOpen(!state.recordOpen));
document.getElementById('focusRecordButton').addEventListener('click', () => setRecordOpen(true));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.recordOpen) setRecordOpen(false);
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
  if (previous !== undefined) selectPerson(previous, false);
});
window.addEventListener('resize', () => {
  updateSummaryTabStop();
  if (linkMap) {
    updateLinkMap(false);
    centerMapViewport();
  }
});

async function initialize() {
  try {
    const [archiveResponse, mediaResponse] = await Promise.all([
      fetch(`${assetRoot}data/cihof-runtime-data.json`),
      fetch(`${assetRoot}data/media-manifest.json`),
    ]);
    if (!archiveResponse.ok || !mediaResponse.ok) throw new Error('Archive data unavailable');
    const [data, media] = await Promise.all([archiveResponse.json(), mediaResponse.json()]);
    state.people = data.inductees.filter((person) => person.primaryImageUrl).sort((a, b) => a.name.localeCompare(b.name));
    state.byId = new Map(state.people.map((person) => [person.id, person]));
    state.mediaById = new Map(Object.entries(media.assets).map(([id, asset]) => [id, asset.videos || []]));
    state.relationships = data.entityRelationships.relationships.filter((relationship) => relationship.sourceEntityId.startsWith('person:') && relationship.targetEntityId.startsWith('person:'));
    const classYears = state.people.map((person) => person.classYear).filter(Boolean);
    const firstYear = Math.min(...classYears);
    state.years = Array.from({ length: Math.max(...classYears) - firstYear + 1 }, (_, index) => firstYear + index);
    state.selectedId = '';
    renderFocus();
    renderField();
  } catch (error) {
    fieldContent.replaceChildren(element('p', 'load-message', 'ARCHIVE DATA UNAVAILABLE'));
    console.error(error);
  }
}

initialize();
