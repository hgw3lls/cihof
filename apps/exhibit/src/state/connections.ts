/**
 * Connections, drawn on the wall: the same faces, arranged by who a source
 * says they touched.
 *
 * Two views. The diagram puts one person (or one place) at the centre, the
 * people their ties reach on a ring round them, the rest of their group
 * beyond, and every other group out on the rim; zoomed in, those others step
 * aside to the edges of the view. By place sets each reviewed place roughly
 * where it sits in the city, its people inside it, and draws everyone's ties
 * across the city.
 *
 * Kinds of claim stay apart on screen as they do in the data. A documented
 * relationship is a solid line in its layer's colour; two people who only
 * appear together in a source are a dotted, muted line, worded as that; a
 * shared place is dashed; a tie nobody has reviewed (an editor's preview
 * only) is amber and says so.
 */
import type { PublishedRelationship, SharedContext } from '@cihof/content';
import type { PreviewTie } from '@cihof/pipeline';
import type { RuntimePerson, RuntimePlace } from '../data/runtime.ts';
import { connectionMap, connectionNodes, type ConnectionNode, type Tie } from './selectors.ts';
import { field, type Slot, type View, type WallLabel, type WallLayout } from './wall.ts';

export type LayerId = 'inducted' | 'worked' | 'personal' | 'places' | 'together' | 'proposed';

export type Layer = {
  readonly id: LayerId;
  readonly label: string;
  readonly kinds: readonly string[];
  readonly stroke: string;
  /** SVG dash pattern, or 'none' for solid. */
  readonly dash: string;
};

export const layers: readonly Layer[] = [
  { id: 'inducted', label: 'Welcomed in', kinds: ['inducted'], stroke: 'var(--years-ink)', dash: 'none' },
  { id: 'worked', label: 'Worked together', kinds: ['collaborated-with', 'founded-with', 'succeeded'], stroke: 'var(--links-ink)', dash: 'none' },
  { id: 'personal', label: 'Family, friends', kinds: ['family-of', 'friend-of'], stroke: 'var(--people-ink)', dash: 'none' },
  { id: 'places', label: 'Same place', kinds: [], stroke: 'var(--places-ink)', dash: '6 5' },
  { id: 'together', label: 'Together', kinds: [], stroke: 'var(--muted)', dash: '1 6' },
  { id: 'proposed', label: 'Proposed, unreviewed', kinds: [], stroke: 'var(--unreviewed-ink)', dash: '4 4' },
];

export const defaultLayers: readonly LayerId[] = ['inducted', 'worked', 'personal', 'places', 'together', 'proposed'];

export function layer(id: LayerId): Layer {
  return layers.find((each) => each.id === id) ?? layers[1]!;
}

/** Which layer a tie belongs to. Context and proposals are never a relationship's layer. */
export function layerOfTie(tie: Pick<Tie, 'context' | 'unreviewed'> & { kind?: string }): LayerId {
  if (tie.unreviewed) return 'proposed';
  if (tie.context) return 'together';
  return layers.find((each) => each.kinds.includes(tie.kind ?? ''))?.id ?? 'worked';
}

/** How a tie is worded beside a face: the reviewed words, and what kind of claim they are when that is not a relationship. */
export function tieWording(tie: Pick<Tie, 'label' | 'context' | 'unreviewed'>): string {
  if (tie.unreviewed) return `Proposed · ${tie.label}`;
  if (tie.context) return `Appeared together · ${tie.label}`;
  return tie.label;
}

export type Arc = {
  readonly d: string;
  readonly stroke: string;
  readonly width: number;
  readonly dash: string;
  readonly opacity: number;
};

export type Marker = {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly count: number;
  /** The place at the centre, drawn larger with a ring. */
  readonly focus: boolean;
};

export type ConnectionsLayout = WallLayout & {
  readonly arcs: readonly Arc[];
  readonly markers: readonly Marker[];
};

type Input = {
  people: readonly RuntimePerson[];
  relationships: readonly PublishedRelationship[];
  contexts: readonly SharedContext[];
  candidates: readonly PreviewTie[];
  places: readonly RuntimePlace[];
  on: ReadonlySet<LayerId>;
  width: number;
};

/** The ties the layers switched on allow, gathered per person, with each tie's kind. */
export function nodesFor(input: Pick<Input, 'people' | 'relationships' | 'contexts' | 'candidates' | 'on'>): (ConnectionNode & { ties: readonly (Tie & { kind?: string })[] })[] {
  const { people, relationships, contexts, candidates, on } = input;
  const kindOf = new Map(relationships.map((each) => [each.id as string, each.kind as string]));
  const shown = relationships.filter((each) => on.has(layerOfTie({ kind: each.kind })));
  const nodes = connectionNodes(people, shown, on.has('proposed') ? candidates : [], on.has('together') ? contexts : []);
  return nodes.map((node) => ({
    ...node,
    ties: node.ties.map((tie) => {
      const kind = kindOf.get(tie.connectionId);
      return kind === undefined ? tie : { ...tie, kind };
    }),
  }));
}

const chip = true;
const H = field.height;
/** A tie's caption, measured roughly, so a label above a face clears it. */
const captionHeight = (text: string, width: number, size: number) => Math.ceil((text.length * size * 0.52) / width) * Math.round(size * 1.18);
const round = (value: number) => value.toFixed(1);

/**
 * The diagram. `focusId` is a person or null (the best-connected person);
 * `placeId` puts a place at the centre instead. `view` is the visitor's zoom
 * and pan: from 1.05 to 1.5 the people outside the focus's own ring glide to
 * the edges of the view and keep a constant on-screen size, in the order they
 * sit round the centre.
 */
export function diagramLayout(input: Input & {
  focusId: string | null;
  placeId: string | null;
  view: View;
  /** Screen space the edges keep clear: the trail along the top, the zoom buttons down the right. */
  keepClear?: { top: number; right: number };
}): ConnectionsLayout {
  const { people, places, on, width: W, focusId, placeId, view, keepClear = { top: 0, right: 0 } } = input;
  const byId = new Map(people.map((person) => [person.id, person]));
  const slots = new Map<string, Slot>();
  const labels: WallLabel[] = [];
  const arcs: Arc[] = [];
  const markers: Marker[] = [];
  const centre = new Map<string, { x: number; y: number; r: number }>();
  const X = (v: number) => W / 2 + (v / 2.4) * W;
  const Y = (v: number) => H / 2 + (v / 2.4) * H;
  const size = { focus: 184, tie: 104, cluster: 54, elsewhere: 46 } as const;

  const caption = (person: RuntimePerson, above: boolean, cx: number, cy: number, sz: number, colour: string, wording: string) => {
    const w = 250;
    const nameH = 28;
    const labH = wording ? captionHeight(wording, w, 16) : 0;
    const top = above ? cy - sz / 2 - 8 - nameH - labH : cy + sz / 2 + 8;
    labels.push({ x: cx - w / 2, y: top, w, size: 21, text: person.name, color: 'var(--ink)', align: 'center', lineHeight: 1.2, z: 6, chip });
    if (wording) labels.push({ x: cx - w / 2, y: top + nameH, w, size: 16, text: wording, color: colour, align: 'center', wrap: true, lineHeight: 1.25, z: 6, chip });
  };

  // The rim, faint, so the diagram reads as a whole.
  arcs.push({
    d: `M ${W * 0.06} ${H / 2} a ${W * 0.44} ${H * 0.44} 0 1 0 ${W * 0.88} 0 a ${W * 0.44} ${H * 0.44} 0 1 0 ${-W * 0.88} 0`,
    stroke: 'var(--ink)', width: 2, dash: '2 10', opacity: 0.14,
  });

  const place = placeId && on.has('places') ? places.find((each) => each.id === placeId) : undefined;
  if (place) {
    const ids = (place.personIds ?? []).filter((id) => byId.has(id));
    const C = { x: X(0), y: Y(0) };
    const markerSize = 184;
    markers.push({ id: place.id, name: place.name, x: C.x - markerSize / 2, y: C.y - markerSize / 2, size: markerSize, count: ids.length, focus: true });
    ids.forEach((id, index) => {
      const angle = -Math.PI / 2 + (index / ids.length) * Math.PI * 2;
      const ex = Math.cos(angle) * 0.62;
      const ey = Math.sin(angle) * 0.66;
      const sz = ids.length > 8 ? 92 : 104;
      const cx = X(ex);
      const cy = Y(ey);
      slots.set(id, { x: cx - sz / 2, y: cy - sz / 2, size: sz, dim: 0, ring: 'tie' });
      caption(byId.get(id)!, ey < -0.04, cx, cy, sz, layer('places').stroke, '');
      const dx = cx - C.x;
      const dy = cy - C.y;
      const len = Math.hypot(dx, dy) || 1;
      arcs.push({
        d: `M${round(C.x + (dx / len) * (markerSize / 2 + 6))} ${round(C.y + (dy / len) * (markerSize / 2 + 6))} L${round(cx - (dx / len) * (sz / 2 + 6))} ${round(cy - (dy / len) * (sz / 2 + 6))}`,
        stroke: layer('places').stroke, width: 3, dash: layer('places').dash, opacity: 1,
      });
    });
    for (const person of people) if (!slots.has(person.id)) slots.set(person.id, { x: C.x - 4, y: C.y - 4, size: 8, dim: 2 });
    return {
      slots, labels, arcs, markers, order: ids, rail: false,
      title: place.name,
      subtitle: `${ids.length} ${ids.length === 1 ? 'person' : 'people'} tied to this place`,
    };
  }

  const nodes = nodesFor(input);
  const focus = focusId && nodes.some((node) => node.person.id === focusId) ? focusId : null;
  const map = connectionMap(nodes, focus);
  const tieOf = new Map<string, Tie & { kind?: string }>();
  const focusNode = map.focus ? nodes.find((node) => node.person.id === map.focus!.id) : undefined;
  for (const tie of focusNode?.ties ?? []) {
    const held = tieOf.get(tie.other.id);
    // The strongest claim is the one worded, as the ring itself chooses.
    const strength = (each: Tie) => (each.unreviewed ? 0 : each.context ? 1 : 2);
    if (!held || strength(tie) > strength(held)) tieOf.set(tie.other.id, tie);
  }
  const layerBetween = new Map<string, LayerId>();
  for (const node of nodes) for (const tie of node.ties) layerBetween.set(tie.connectionId, layerOfTie(tie));

  const tieAngles: number[] = [];
  const zoom = view.zoom || 1;
  const edge = Math.max(0, Math.min(1, (zoom - 1.05) / 0.45));
  const aside: typeof map.placed[number][] = [];
  for (const entry of map.placed) {
    if (edge > 0 && (entry.ring === 'cluster' || entry.ring === 'elsewhere')) { aside.push(entry); continue; }
    const sz = size[entry.ring];
    const cx = X(entry.x);
    const cy = Y(entry.y);
    centre.set(entry.person.id, { x: cx, y: cy, r: sz / 2 });
    const tie = tieOf.get(entry.person.id);
    slots.set(entry.person.id, {
      x: cx - sz / 2, y: cy - sz / 2, size: sz,
      dim: entry.ring === 'cluster' ? 0.25 : entry.ring === 'elsewhere' ? 0.5 : 0,
      ...(entry.ring === 'focus' ? { ring: 'focus' as const } : entry.ring === 'tie' ? { ring: 'tie' as const, ...(tie ? { note: tieWording(tie) } : {}) } : {}),
    });
    if (entry.ring === 'tie') {
      tieAngles.push(Math.atan2(entry.y, entry.x));
      caption(entry.person, entry.y < -0.04, cx, cy, sz, tie ? layer(layerOfTie(tie)).stroke : 'var(--ink)', tie ? tieWording(tie) : '');
    }
  }

  if (aside.length > 0) {
    // Zoomed in: the rest step aside to the edges of the view, a constant
    // 44px on the screen, in the order they sit around the centre.
    const vx0 = -view.pan.x / zoom;
    const vy0 = -view.pan.y / zoom + keepClear.top / zoom;
    const vw = (W - keepClear.right) / zoom;
    const vh = (H - keepClear.top) / zoom;
    const sz = 44 / zoom;
    const m = sz / 2 + 10 / zoom;
    const w = vw - 2 * m;
    const h = vh - 2 * m;
    const P = 2 * (w + h);
    const rcx = vx0 + vw / 2;
    const rcy = vy0 + vh / 2;
    const fx = X(0);
    const fy = Y(0);
    const toP = (x: number, y: number) => {
      const lx = x - (vx0 + m);
      const ly = y - (vy0 + m);
      if (ly <= 0.5) return lx;
      if (lx >= w - 0.5) return w + ly;
      if (ly >= h - 0.5) return w + h + (w - lx);
      return 2 * w + h + (h - ly);
    };
    const fromP = (p: number): [number, number] => {
      const q = ((p % P) + P) % P;
      if (q < w) return [vx0 + m + q, vy0 + m];
      if (q < w + h) return [vx0 + m + w, vy0 + m + q - w];
      if (q < 2 * w + h) return [vx0 + m + w - (q - w - h), vy0 + m + h];
      return [vx0 + m, vy0 + m + h - (q - 2 * w - h)];
    };
    const items = aside.map((entry) => {
      const ox = X(entry.x);
      const oy = Y(entry.y);
      const L = Math.hypot(ox - fx, oy - fy) || 1;
      const dx = (ox - fx) / L;
      const dy = (oy - fy) / L;
      const tx = dx ? (dx > 0 ? w / 2 : -w / 2) / dx : Infinity;
      const ty = dy ? (dy > 0 ? h / 2 : -h / 2) / dy : Infinity;
      const t = Math.min(Math.abs(tx), Math.abs(ty));
      return { entry, ox, oy, p: toP(rcx + dx * t, rcy + dy * t) };
    }).sort((a, b) => a.p - b.p);
    const step = Math.min(sz + 8 / zoom, P / items.length);
    for (let pass = 0; pass < 3; pass += 1) {
      for (let index = 1; index < items.length; index += 1) {
        if (items[index]!.p - items[index - 1]!.p < step) items[index]!.p = items[index - 1]!.p + step;
      }
    }
    const over = items.length ? items[items.length - 1]!.p - (items[0]!.p + P) + step : 0;
    if (over > 0) items.forEach((item, index) => { item.p -= over * (index / items.length); });
    for (const item of items) {
      const [ex, ey] = fromP(item.p);
      const from = size[item.entry.ring];
      const cx = item.ox + (ex - item.ox) * edge;
      const cy = item.oy + (ey - item.oy) * edge;
      const sized = from + (sz - from) * edge;
      centre.set(item.entry.person.id, { x: cx, y: cy, r: sized / 2 });
      slots.set(item.entry.person.id, { x: cx - sized / 2, y: cy - sized / 2, size: sized, dim: item.entry.ring === 'cluster' ? 0.25 : 0.5 });
    }
  }

  for (const tie of map.ties) {
    const a = centre.get(tie.from);
    const b = centre.get(tie.to);
    if (!a || !b) continue;
    const kind = layer(layerBetween.get(tie.connectionId) ?? 'worked');
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    arcs.push({
      d: `M${round(a.x + ux * a.r)} ${round(a.y + uy * a.r)} L${round(b.x - ux * b.r)} ${round(b.y - uy * b.r)}`,
      stroke: tie.touchesFocus ? kind.stroke : 'var(--ink)',
      width: tie.touchesFocus ? 4 : 1,
      dash: kind.dash,
      opacity: tie.touchesFocus ? 1 : 0.18 * (1 - edge * 0.7),
    });
  }

  // The places of the person at the centre, in the widest gaps between their ties.
  if (map.focus && on.has('places')) {
    const theirs = places.filter((each) => (each.personIds ?? []).includes(map.focus!.id)).slice(0, 3);
    const sorted = tieAngles.slice().sort((a, b) => a - b);
    const gaps = sorted.length
      ? sorted.map((a, index) => {
        const b = index === sorted.length - 1 ? sorted[0]! + Math.PI * 2 : sorted[index + 1]!;
        return { mid: (a + b) / 2, span: b - a };
      }).sort((a, b) => b.span - a.span)
      : [{ mid: Math.PI / 2, span: 0 }, { mid: -Math.PI / 2, span: 0 }, { mid: 0, span: 0 }];
    const C = centre.get(map.focus.id)!;
    theirs.forEach((each, index) => {
      const gap = gaps[index % gaps.length]!;
      const angle = gap.mid + (index >= gaps.length ? 0.35 : 0);
      const markerSize = 64;
      const cx = X(Math.cos(angle) * 0.37);
      const cy = Y(Math.sin(angle) * 0.4);
      markers.push({ id: each.id, name: each.name, x: cx - markerSize / 2, y: cy - markerSize / 2, size: markerSize, count: (each.personIds ?? []).length, focus: false });
      const w = 170;
      const lh = captionHeight(each.name, w, 15);
      const below = Math.sin(angle) >= -0.2;
      labels.push({ x: cx - w / 2, y: below ? cy + markerSize / 2 + 6 : cy - markerSize / 2 - 6 - lh, w, size: 15, text: each.name, color: 'var(--places-ink)', align: 'center', wrap: true, lineHeight: 1.25, z: 6, chip });
      const len = Math.hypot(cx - C.x, cy - C.y) || 1;
      const ux = (cx - C.x) / len;
      const uy = (cy - C.y) / len;
      arcs.push({
        d: `M${round(C.x + ux * C.r)} ${round(C.y + uy * C.r)} L${round(cx - ux * (markerSize / 2 + 4))} ${round(cy - uy * (markerSize / 2 + 4))}`,
        stroke: layer('places').stroke, width: 3, dash: layer('places').dash, opacity: 1,
      });
    });
  }

  for (const person of people) if (!slots.has(person.id)) slots.set(person.id, { x: W / 2 - 4, y: H / 2 - 4, size: 8, dim: 2 });
  const chosen = Boolean(focus);
  return {
    slots, labels, arcs, markers, rail: false,
    order: map.placed.map((entry) => entry.person.id),
    title: map.focus ? (chosen ? map.focus.name : `At the centre: ${map.focus.name}`) : 'Connections',
    subtitle: map.focus
      ? `${map.clusterSize > 1 ? `${map.clusterSize - 1} connected` : 'no tie in these layers'}${map.islands > 0 ? ` · ${map.islands} other groups` : ''}`
      : 'touch anyone to bring them to the centre',
  };
}

/**
 * By place: each reviewed place set where its marker sits on the city map,
 * its people inside it, boxes nudged apart so none overlaps. A person is shown
 * at their first place. People with no reviewed place wait in a strip along
 * the bottom. Choosing somebody draws their ties across the city.
 */
export function placesLayout(input: Input & { selectedId: string | null }): ConnectionsLayout {
  const { people, places, width: W, selectedId } = input;
  const byId = new Map(people.map((person) => [person.id, person]));
  const slots = new Map<string, Slot>();
  const labels: WallLabel[] = [];
  const arcs: Arc[] = [];
  const centre = new Map<string, { x: number; y: number }>();
  const sorted = people.slice().sort((a, b) => a.sortName.localeCompare(b.sortName));

  const ranked = places
    .map((place) => ({ place, ids: (place.personIds ?? []).filter((id) => byId.has(id)) }))
    .sort((a, b) => b.ids.length - a.ids.length);
  const home = new Map<string, string>();
  for (const { place, ids } of ranked) for (const id of ids) if (!home.has(id)) home.set(id, place.id);
  const loose = sorted.filter((person) => !home.has(person.id));

  const small = 26;
  const perRow = Math.floor(W / (small + 4));
  const looseTop = H - Math.ceil(loose.length / perRow) * (small + 4);
  const mapH = looseTop - 40;
  const marked = ranked.filter(({ place }) => place.marker);
  const xs = marked.map(({ place }) => place.marker!.x);
  const ys = marked.map(({ place }) => place.marker!.y);
  const X0 = xs.length ? Math.min(...xs) : 0;
  const X1 = xs.length ? Math.max(...xs) : 100;
  const Y0 = ys.length ? Math.min(...ys) : 0;
  const Y1 = ys.length ? Math.max(...ys) : 100;
  const k = Math.min((W - 200) / Math.max(1, X1 - X0), (mapH - 100) / Math.max(1, Y1 - Y0));
  const offX = (W - (X1 - X0) * k) / 2;
  const offY = (mapH - (Y1 - Y0) * k) / 2;
  const gap = 6;
  const head = 32;

  // The largest faces at which every place fits without overlapping another.
  const arrange = (cell: number, tightness = 1) => {
    // Every place with anybody tied to it has its box. A place whose people
    // are all shown at another place first keeps a small box that says so,
    // rather than vanishing from the city.
    const boxes = ranked.filter(({ ids }) => ids.length > 0).map(({ place, ids }) => {
      const members = [...home.entries()].filter(([, at]) => at === place.id).map(([id]) => id);
      const n = Math.max(1, members.length);
      const cols = Math.ceil(Math.sqrt(n * 1.3));
      const rows = Math.ceil(n / cols);
      const w = Math.max(members.length ? cols * (cell + gap) - gap : 0, place.name.length * 9 + 50, members.length ? 0 : 230);
      const h = members.length ? rows * (cell + gap) - gap + head : head + 22;
      const mx = place.marker?.x ?? (X0 + X1) / 2;
      const my = place.marker?.y ?? (Y0 + Y1) / 2;
      return { place, members, tied: ids.length, cols, w, h, cx: offX + (mx - X0) * k, cy: offY + (my - Y0) * k };
    });

    // Largest place first, each at its spot on the map or, if that is taken,
    // the nearest clear spot spiralling out from it. Boxes cannot overlap, and
    // a place stays as near to where it is as the others allow.
    // The gap kept round each box; tightened only when the city will not fit
    // otherwise, and never past the box's own drawn edge.
    const clearance = { x: Math.max(16, 26 * tightness), top: Math.max(14, 24 * tightness), bottom: Math.max(14, 26 * tightness) };
    const fits = (box: (typeof boxes)[number], cx: number, cy: number, placed: readonly (typeof boxes)[number][]) => placed.every((other) =>
      Math.abs(cx - other.cx) >= (box.w + other.w) / 2 + clearance.x * 2
      || Math.abs(cy - other.cy) >= (box.h + other.h) / 2 + clearance.top + clearance.bottom);
    const within = (box: (typeof boxes)[number], cx: number, cy: number) => ({
      cx: Math.max(box.w / 2 + 16, Math.min(W - box.w / 2 - 16, cx)),
      cy: Math.max(box.h / 2 + clearance.top, Math.min(mapH - box.h / 2, cy)),
    });
    const placed: (typeof boxes)[number][] = [];
    let fitted = true;
    for (const box of boxes.slice().sort((a, b) => b.members.length - a.members.length)) {
      let spot = within(box, box.cx, box.cy);
      let found = false;
      search: for (let radius = 0; radius <= Math.max(W, mapH); radius += 12) {
        const turns = radius === 0 ? 1 : Math.max(8, Math.round(radius / 10));
        for (let turn = 0; turn < turns; turn += 1) {
          const angle = (turn / turns) * Math.PI * 2;
          const at = within(box, box.cx + Math.cos(angle) * radius, box.cy + Math.sin(angle) * radius);
          if (fits(box, at.cx, at.cy, placed)) { spot = at; found = true; break search; }
        }
      }
      fitted &&= found;
      box.cx = spot.cx;
      box.cy = spot.cy;
      placed.push(box);
    }

    return { boxes, fitted };
  };
  let cell = 58;
  let arranged = arrange(cell);
  for (const [smaller, tightness] of [[52, 1], [46, 1], [40, 0.8], [40, 0.6]] as const) {
    if (arranged.fitted) break;
    cell = smaller;
    arranged = arrange(cell, tightness);
  }
  const boxes = arranged.boxes;

  const nodes = nodesFor(input);
  const chosen = selectedId && byId.has(selectedId) ? selectedId : null;
  const tied = new Set(chosen ? nodes.find((node) => node.person.id === chosen)?.ties.map((tie) => tie.other.id) ?? [] : []);
  const theirPlaces = new Set(chosen ? places.filter((place) => (place.personIds ?? []).includes(chosen)).map((place) => place.id) : []);

  for (const box of boxes) {
    const lit = theirPlaces.has(box.place.id);
    const x0 = box.cx - box.w / 2;
    const y0 = box.cy - box.h / 2;
    arcs.push({
      d: `M${x0 - 14} ${y0 - 10} h${box.w + 28} v${box.h + 22} h${-(box.w + 28)} z`,
      stroke: 'var(--places-ink)', width: lit ? 3 : 1.5, dash: lit ? 'none' : '2 7', opacity: chosen && !lit ? 0.35 : 0.8,
    });
    labels.push({ x: x0 - 4, y: y0 - 2, w: box.w + 20, size: 17, text: `${box.place.name}  ${box.tied}`, color: 'var(--places-ink)', opacity: chosen && !lit ? 0.5 : 1, lineHeight: 1.2, z: 6, chip });
    if (box.members.length === 0) {
      labels.push({ x: x0 - 4, y: y0 + head - 4, w: box.w + 20, size: 15, text: box.tied === 1 ? 'shown at another place' : 'shown at their other places', color: 'var(--muted)', opacity: chosen && !lit ? 0.5 : 1, lineHeight: 1.2, z: 6 });
    }
    box.members.forEach((id, index) => {
      const x = x0 + (index % box.cols) * (cell + gap);
      const y = y0 + head + Math.floor(index / box.cols) * (cell + gap);
      slots.set(id, {
        x, y, size: cell,
        dim: chosen && id !== chosen && !tied.has(id) && !lit ? 0.5 : 0,
        ...(id === chosen ? { ring: 'focus' as const } : tied.has(id) ? { ring: 'tie' as const } : {}),
      });
      centre.set(id, { x: x + cell / 2, y: y + cell / 2 });
    });
  }

  // Somebody with no reviewed place, once chosen, is lifted into a clear space above the strip.
  if (chosen && !home.has(chosen)) {
    const fs = 110;
    const clear = (x: number, y: number) => boxes.every((box) => {
      const bx0 = box.cx - box.w / 2 - 22;
      const bx1 = box.cx + box.w / 2 + 22;
      const by0 = box.cy - box.h / 2 - 18;
      const by1 = box.cy + box.h / 2 + 20;
      return x + fs < bx0 || x > bx1 || y + fs + 30 < by0 || y > by1;
    });
    let lifted: { x: number; y: number } | null = null;
    outer: for (let y = looseTop - 60 - fs; y >= 10; y -= 20) {
      for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8, 0.08, 0.92]) {
        const x = W * fx - fs / 2;
        if (clear(x, y)) { lifted = { x, y }; break outer; }
      }
    }
    lifted ??= { x: W / 2 - fs / 2, y: looseTop - 60 - fs };
    slots.set(chosen, { x: lifted.x, y: lifted.y, size: fs, dim: 0, ring: 'focus' });
    centre.set(chosen, { x: lifted.x + fs / 2, y: lifted.y + fs / 2 });
    labels.push({ x: lifted.x + fs / 2 - 140, y: lifted.y + fs + 8, w: 280, size: 20, text: byId.get(chosen)!.name, color: 'var(--ink)', align: 'center', lineHeight: 1.2, z: 6, chip });
  }

  loose.forEach((person, index) => {
    if (person.id === chosen && slots.has(person.id)) return;
    const x = (index % perRow) * (small + 4);
    const y = looseTop + Math.floor(index / perRow) * (small + 4);
    const lit = Boolean(chosen && tied.has(person.id));
    slots.set(person.id, { x, y, size: lit ? small + 10 : small, dim: lit ? 0 : 1, ...(lit ? { ring: 'tie' as const } : {}) });
    centre.set(person.id, { x: x + small / 2, y: y + small / 2 });
  });
  labels.push({ x: 0, y: looseTop - 28, w: W, size: 17, text: `${loose.length} people not yet tied to a reviewed place`, color: 'var(--muted)' });

  const drawn = new Set<string>();
  for (const node of nodes) {
    for (const tie of node.ties) {
      if (drawn.has(tie.connectionId)) continue;
      drawn.add(tie.connectionId);
      const a = centre.get(node.person.id);
      const b = centre.get(tie.other.id);
      if (!a || !b) continue;
      const hot = Boolean(chosen && (node.person.id === chosen || tie.other.id === chosen));
      const kind = layer(layerOfTie(tie));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 - Math.min(120, Math.hypot(b.x - a.x, b.y - a.y) * 0.25);
      arcs.push({
        d: `M${round(a.x)} ${round(a.y)} Q${round(mx)} ${round(my)} ${round(b.x)} ${round(b.y)}`,
        stroke: kind.stroke, width: hot ? 4 : 1.5, dash: kind.dash, opacity: hot ? 1 : chosen ? 0.08 : 0.45,
      });
    }
  }

  for (const person of people) if (!slots.has(person.id)) slots.set(person.id, { x: W / 2 - 4, y: H + 40, size: 8, dim: 2 });
  const person = chosen ? byId.get(chosen) ?? null : null;
  return {
    slots, labels, arcs, markers: [], rail: false,
    order: boxes.flatMap((box) => box.members).concat(loose.map((each) => each.id)),
    title: person ? person.name : 'By place',
    subtitle: person
      ? (tied.size ? `${tied.size} ties reach across the city` : 'no documented tie in these layers')
      : `${boxes.length} places, set where they sit on the map`,
  };
}

/** How many of each layer there are, for the chips. */
export function layerCounts(input: Pick<Input, 'relationships' | 'contexts' | 'candidates' | 'places'>): Record<LayerId, number> {
  const counts: Record<LayerId, number> = { inducted: 0, worked: 0, personal: 0, places: 0, together: input.contexts.length, proposed: input.candidates.length };
  for (const each of input.relationships) counts[layerOfTie({ kind: each.kind })] += 1;
  counts.places = input.places.reduce((sum, place) => sum + (place.personIds?.length ?? 0), 0);
  return counts;
}
