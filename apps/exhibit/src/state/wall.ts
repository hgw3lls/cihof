/**
 * The wall: every inductee's portrait on one field, arranged by the lens in
 * view. Each arrangement is a position for every face, so moving between them
 * moves the same faces rather than swapping one screen for another.
 *
 * Everything here is in design pixels on the 1920 × 1080 stage, and pure, so
 * the rules a visitor would notice (nobody cropped at the edge, the name plate
 * never off the field) can be tested without a browser.
 */
import type { RuntimePerson } from '../data/runtime.ts';
import { groupsBy, inductionClasses, type Group } from './selectors.ts';

/** The field the wall is drawn in on the display: below the header, above the chips and the bar. */
export const field = { left: 48, top: 96, height: 784, width: 1824, widthWithSheet: 1224, widthWithSearch: 1064 } as const;

/**
 * Where the field is on a stage of any shape, and how it gives way to a sheet
 * or to search. On a landscape stage the header, chips and bar keep the
 * display's sizes and the field takes the rest; a sheet or search comes in
 * from the right and narrows it. On an upright one (a phone) the header is
 * shorter, the bar two rows deep, a sheet rises from below and search drops
 * from above, and each shortens the field rather than narrowing it.
 */
export type FieldPlace = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
export type FieldGeometry = { readonly rest: FieldPlace; readonly sheet: FieldPlace; readonly search: FieldPlace; readonly sheetHeight: number; readonly searchHeight: number };

/** The phone's header, chip band and bar, in design pixels. */
export const phone = { masthead: 124, chips: 64, bar: 136, margin: 16 } as const;

export function fieldGeometry(stage: { kind: 'wall' | 'phone'; width: number; height: number }): FieldGeometry {
  const { width: W, height: H } = stage;
  if (stage.kind === 'phone') {
    const { masthead, chips, bar, margin } = phone;
    const left = margin;
    const width = W - 2 * margin;
    const sheetHeight = Math.round(H * 0.52);
    const searchHeight = Math.round(H * 0.5);
    return {
      rest: { left, top: masthead, width, height: H - masthead - chips - bar },
      sheet: { left, top: masthead, width, height: H - masthead - sheetHeight - 8 },
      search: { left, top: searchHeight + 8, width, height: H - searchHeight - 8 - chips - bar },
      sheetHeight, searchHeight,
    };
  }
  const extra = W - 1920;
  const height = H - 1080 + field.height;
  return {
    rest: { left: field.left, top: field.top, width: field.width + extra, height },
    sheet: { left: field.left, top: field.top, width: field.widthWithSheet + extra, height },
    search: { left: field.left, top: field.top, width: field.widthWithSearch + extra, height },
    sheetHeight: H - 232, searchHeight: H - 232,
  };
}

/** A field narrower than any the display uses: a phone's. Layouts drawn for the display's width rearrange for it. */
export const narrow = (width: number) => width < 1000;
/** The letter rail's width, with the gap left beside it. */
const railSpace = (width: number) => (narrow(width) ? 52 : 84);

export type Arrangement = 'name' | 'community' | 'contribution';

export type Slot = {
  readonly x: number;
  readonly y: number;
  /** Edge of the square, in design pixels. A tile's base size is 100. */
  readonly size: number;
  /** 0 in full, 0.25–0.5 quieter, 1 set back, 2 off the field. */
  readonly dim: number;
  readonly ring?: 'focus' | 'tie';
  /** Found by a search, and shown in colour. */
  readonly lit?: boolean;
  /** How this face is tied to the one at the centre, read out with its name. */
  readonly note?: string;
  /** Already large with its name beneath: chosen, it is framed and coloured, not enlarged. */
  readonly named?: boolean;
};

export type WallLabel = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly size: number;
  readonly text: string;
  /** A CSS colour, usually a token. */
  readonly color: string;
  readonly align?: 'left' | 'center';
  /** Wraps onto more lines, rather than being cut short. */
  readonly wrap?: boolean;
  readonly lineHeight?: number;
  readonly z?: number;
  /** Set on a patch of the ground, so it reads over lines and faces. */
  readonly chip?: boolean;
  readonly opacity?: number;
  /** At most this many lines, the last ending in an ellipsis. */
  readonly lines?: number;
};

export type WallLayout = {
  readonly slots: ReadonlyMap<string, Slot>;
  readonly labels: readonly WallLabel[];
  /** Reading order, which is also the order "Next story" walks. */
  readonly order: readonly string[];
  readonly title: string;
  readonly subtitle: string;
  readonly rail: boolean;
};

export function peopleLayout(
  people: readonly RuntimePerson[],
  arrangement: Arrangement,
  width: number,
  letter: string | null,
  /** People a search found: in colour, and everyone else stepped back. */
  lit: ReadonlySet<string> | null = null,
  /** False while the search panel stands where the rail would. */
  rail = true,
  height: number = field.height,
): WallLayout {
  const layout = arrangement === 'name' ? byName(people, width, letter, rail, height) : grouped(people, arrangement, width, height);
  if (!lit) return layout;
  const slots = new Map<string, Slot>();
  for (const [id, slot] of layout.slots) slots.set(id, lit.has(id) ? { ...slot, lit: true } : { ...slot, dim: Math.max(slot.dim, 1) });
  return { ...layout, slots };
}

function grouped(people: readonly RuntimePerson[], arrangement: 'community' | 'contribution', width: number, height: number): WallLayout {
  const groups = groupsBy(people, arrangement === 'community' ? 'communities' : 'contributions');
  const slots = new Map<string, Slot>();
  const labels: WallLabel[] = [];
  placeBlocks(pack(groups, width, height, 104, narrow(width) ? 20 : 34), height, slots, labels, 'var(--muted)');
  return {
    slots,
    labels,
    order: groups.flatMap((group) => group.people.map((person) => person.id)),
    title: arrangement === 'community' ? 'Everyone, by community' : 'Everyone, by what they are honored for',
    subtitle: `${groups.length} ${arrangement === 'community' ? 'communities' : 'kinds of contribution'} · a person is shown under their first`,
    rail: false,
  };
}

/** Everyone in one block, A to Z, as large as the field allows. */
function byName(people: readonly RuntimePerson[], width: number, letter: string | null, rail: boolean, height: number): WallLayout {
  const sorted = alphabetical(people);
  const W = width - (rail ? railSpace(width) : 0);
  const H = height;
  let best = { cols: 10, rows: 1, cell: 0 };
  for (let cols = narrow(width) ? 4 : 10; cols <= 22; cols += 1) {
    const rows = Math.ceil(sorted.length / cols);
    const cell = Math.min(W / cols, H / rows);
    if (cell > best.cell) best = { cols, rows, cell };
  }
  const gap = Math.round(best.cell * 0.06);
  const cell = Math.floor(best.cell - gap);
  const blockW = best.cols * (cell + gap) - gap;
  const blockH = best.rows * (cell + gap) - gap;
  const ox = (W - blockW) / 2;
  const oy = (H - blockH) / 2;
  const slots = new Map<string, Slot>();
  sorted.forEach((person, index) => {
    const c = index % best.cols;
    const r = Math.floor(index / best.cols);
    slots.set(person.id, {
      x: ox + c * (cell + gap),
      y: oy + r * (cell + gap),
      size: cell,
      dim: letter && initial(person) !== letter ? 1 : 0,
    });
  });
  return {
    slots,
    labels: [],
    order: sorted.map((person) => person.id),
    title: 'Everyone, A to Z',
    subtitle: `${people.length} inductees · touch a face, or hold one`,
    rail,
  };
}

/** Where the class's faces begin: the year stands large to their left. */
export const yearsGutter = 680;
/** On a phone, where they begin below the year. */
export const yearsHead = 150;

/**
 * Years: one induction class at a time, its faces large beside the year, and
 * every other face gathered below the field, ready to rise when its class is
 * touched. The class shown is the chosen person's, or the one asked for, or
 * the newest. People with no recorded year are not placed in a guessed class;
 * the subtitle says how many there are.
 */
export function yearsLayout(people: readonly RuntimePerson[], width: number, year: number | null, selectedId: string | null, height: number = field.height): WallLayout & { year: number | null } {
  const classes = inductionClasses(people);
  const chosen = selectedId ? people.find((person) => person.id === selectedId) : undefined;
  const shown = classes.find((entry) => entry.year === chosen?.classYear) ?? classes.find((entry) => entry.year === year) ?? classes[0];
  const slots = new Map<string, Slot>();
  const labels: WallLabel[] = [];
  const H = height;
  if (shown) {
    // On a phone the year stands above its class rather than beside it.
    const upright = narrow(width);
    const left = upright ? 0 : yearsGutter;
    const top = upright ? yearsHead : 24;
    const W = width - left;
    const n = shown.people.length;
    const name = upright ? 18 : 22;
    const colGap = upright ? 14 : 24;
    const rowGap = upright ? 52 : 64;
    let best = { cols: 2, cell: 0 };
    for (let cols = 2; cols <= 8; cols += 1) {
      const rows = Math.ceil(n / cols);
      const cell = Math.min((W - (cols - 1) * colGap) / cols, (H - top - (rows - 1) * (rowGap - 44) - rows * 44) / rows);
      if (cell > best.cell) best = { cols, cell };
    }
    const cell = Math.floor(Math.min(best.cell, 280));
    shown.people.forEach((person, index) => {
      const x = left + (index % best.cols) * (cell + colGap);
      const y = top + Math.floor(index / best.cols) * (cell + rowGap);
      slots.set(person.id, { x, y, size: cell, dim: 0, named: true });
      labels.push({ x, y: y + cell + 8, w: cell, size: name, text: person.name, color: 'var(--ink)', wrap: true, lineHeight: 1.05, lines: 2 });
    });
  }
  // The other classes wait below the field, each under its own year in the strip.
  const stripW = width / Math.max(1, classes.length);
  classes.forEach((entry, index) => {
    if (entry === shown) return;
    for (const person of entry.people) slots.set(person.id, { x: index * stripW + stripW / 2 - 4, y: H + 40, size: 8, dim: 2 });
  });
  for (const person of people) if (!slots.has(person.id)) slots.set(person.id, { x: 0, y: H + 40, size: 8, dim: 2 });
  const undated = people.filter((person) => person.classYear === null).length;
  return {
    slots, labels, rail: false, year: shown?.year ?? null,
    order: shown ? shown.people.map((person) => person.id) : [],
    title: 'Years',
    subtitle: `${classes.length} ${classes.length === 1 ? 'class' : 'classes'} · touch a year below${undated ? ` · ${undated} with no recorded year` : ''}`,
  };
}

/**
 * A tour: its people in the middle of the wall, large and in the tour's
 * order, under its name; everybody else framed small down both sides, so the
 * wall is still the whole hall.
 */
export function tourLayout(people: readonly RuntimePerson[], personIds: readonly string[], label: string, width: number, height: number = field.height): WallLayout {
  const byId = new Map(people.map((person) => [person.id, person]));
  const on = new Set(personIds);
  const touring = personIds.map((id) => byId.get(id)).filter((person): person is RuntimePerson => person !== undefined);
  const others = alphabetical(people).filter((person) => !on.has(person.id));
  const slots = new Map<string, Slot>();
  const H = height;

  if (narrow(width)) return uprightTour(touring, others, label, width, height);

  // The frame: four columns, two at each side, as many rows as it takes.
  let frameW = 0;
  if (others.length > 0) {
    const rows = Math.ceil(others.length / 4);
    const cell = Math.min(54, Math.floor(H / rows) - 4);
    others.forEach((person, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = col < 2 ? col * (cell + 4) : width - (2 * cell + 4) + (col - 2) * (cell + 4);
      slots.set(person.id, { x, y: row * (cell + 4), size: cell, dim: 1 });
    });
    frameW = cell * 2 + 4;
  }

  const innerW = width - 2 * (frameW + 48);
  const inner = new Map<string, Slot>();
  const innerLabels: WallLabel[] = [];
  const packed = pack([{ label, people: touring }], innerW, H - 40, 150);
  placeBlocks(packed, H - 40, inner, innerLabels, 'var(--ink)');
  const blockW = packed.blocks[0]?.w ?? innerW;
  const ox = frameW + 48 + (innerW - blockW) / 2;
  for (const [id, slot] of inner) slots.set(id, { ...slot, x: slot.x + ox, y: slot.y + 20 });
  return {
    slots,
    labels: innerLabels.map((each) => ({ ...each, x: each.x + ox, y: each.y + 20, size: 34 })),
    order: touring.map((person) => person.id),
    title: label,
    subtitle: '',
    rail: false,
  };
}

/** A tour on a phone: its people above, large; everybody else small along the foot. */
function uprightTour(touring: readonly RuntimePerson[], others: readonly RuntimePerson[], label: string, width: number, height: number): WallLayout {
  const slots = new Map<string, Slot>();
  const small = 26;
  const perRow = Math.max(1, Math.floor((width + 4) / (small + 4)));
  const rows = Math.ceil(others.length / perRow);
  const frameTop = height - rows * (small + 4) + 4;
  others.forEach((person, index) => {
    slots.set(person.id, { x: (index % perRow) * (small + 4), y: frameTop + Math.floor(index / perRow) * (small + 4), size: small, dim: 1 });
  });
  const inner = new Map<string, Slot>();
  const innerLabels: WallLabel[] = [];
  const innerH = (others.length ? frameTop - 24 : height) - 12;
  const packed = pack([{ label, people: touring }], width, innerH, 150, 20);
  placeBlocks(packed, innerH, inner, innerLabels, 'var(--ink)');
  const blockW = packed.blocks[0]?.w ?? width;
  const ox = (width - blockW) / 2;
  for (const [id, slot] of inner) slots.set(id, { ...slot, x: slot.x + ox, y: slot.y + 12 });
  return {
    slots,
    labels: innerLabels.map((each) => ({ ...each, x: each.x + ox, y: each.y + 12, size: 26, w: Math.min(each.w, width - ox) })),
    order: touring.map((person) => person.id),
    title: label,
    subtitle: '',
    rail: false,
  };
}

/** The letters the rail offers: only those somebody's name starts with. */
export function railLetters(people: readonly RuntimePerson[]): string[] {
  return [...new Set(people.map(initial))].sort();
}

function initial(person: RuntimePerson): string {
  return (person.sortName[0] ?? '').toUpperCase();
}

function alphabetical(people: readonly RuntimePerson[]): RuntimePerson[] {
  return people.slice().sort((a, b) => a.sortName.localeCompare(b.sortName));
}

type Block = { group: Group; x: number; y: number; w: number; h: number; cols: number; cell: number; gap: number; labelH: number; fontSize: number };
type Packed = { blocks: Block[]; total: number };

/**
 * Groups as labelled blocks on shelves, left to right, the largest face size
 * at which they all fit the height. A group's columns follow its size, so a
 * large group reads as a block and a pair as a pair.
 */
export function pack(groups: readonly Group[], W: number, H: number, maxCell: number, minCell = 34): Packed {
  let attempt: Packed = { blocks: [], total: 0 };
  for (let cell = maxCell; cell >= minCell; cell -= 2) {
    const gap = Math.max(3, Math.round(cell * 0.07));
    const blockGap = Math.round(cell * 0.6);
    const labelH = Math.max(minCell < 34 ? 26 : 30, Math.round(cell * 0.4));
    const fontSize = Math.max(minCell < 34 ? 15 : 17, Math.round(labelH * 0.62));
    let x = 0;
    let y = 0;
    let shelfH = 0;
    const blocks: Block[] = [];
    for (const group of groups) {
      const n = group.people.length;
      // On a phone a large group takes as many columns as fit, rather than shrinking every face to keep twelve.
      const most = narrow(W) ? Math.max(1, Math.floor((W + gap) / (cell + gap))) : Infinity;
      const cols = Math.min(most, n >= 30 ? 12 : n >= 16 ? 8 : n >= 9 ? 6 : n >= 5 ? 4 : n >= 3 ? 3 : n);
      const rows = Math.ceil(n / cols);
      const facesW = cols * (cell + gap) - gap;
      const labelW = Math.min(group.label.length * fontSize * 0.54 + 4, Math.max(facesW, 260));
      const w = Math.max(facesW, labelW);
      const h = labelH + rows * (cell + gap) - gap;
      if (x > 0 && x + w > W) { x = 0; y += shelfH + blockGap; shelfH = 0; }
      blocks.push({ group, x, y, w, h, cols, cell, gap, labelH, fontSize });
      x += w + blockGap;
      shelfH = Math.max(shelfH, h);
    }
    attempt = { blocks, total: y + shelfH };
    // It fits when it is short enough and no single group is wider than the field.
    if (attempt.total <= H && blocks.every((block) => block.w <= W)) break;
  }
  return attempt;
}

export function placeBlocks(packed: Packed, H: number, slots: Map<string, Slot>, labels: WallLabel[], labelColor: string) {
  const offsetY = Math.max(0, (H - packed.total) / 2);
  for (const block of packed.blocks) {
    labels.push({ x: block.x, y: block.y + offsetY, w: Math.max(block.w, 60), size: block.fontSize, text: block.group.label, color: labelColor });
    block.group.people.forEach((person, index) => {
      const c = index % block.cols;
      const r = Math.floor(index / block.cols);
      slots.set(person.id, {
        x: block.x + c * (block.cell + block.gap),
        y: block.y + offsetY + block.labelH + r * (block.cell + block.gap),
        size: block.cell,
        dim: 0,
      });
    });
  }
}

export type View = { readonly zoom: number; readonly pan: { readonly x: number; readonly y: number } };
export const homeView: View = { zoom: 1, pan: { x: 0, y: 0 } };

/**
 * Pan kept so the wall never leaves a gap at its edge. A map (`loose`) may be
 * pushed a good way past its edges and zoomed out to half, since what is
 * worth reaching can sit on its rim.
 */
export function clampPan(pan: { x: number; y: number }, zoom: number, width: number, loose = false, height: number = field.height): { x: number; y: number } {
  const H = height;
  if (loose) {
    const mx = width * 0.6;
    const my = H * 0.6;
    return {
      x: Math.min(mx, Math.max(width - width * zoom - mx, pan.x)),
      y: Math.min(my, Math.max(H - H * zoom - my, pan.y)),
    };
  }
  return {
    x: Math.min(0, Math.max(width - width * zoom, pan.x)),
    y: Math.min(0, Math.max(H - H * zoom, pan.y)),
  };
}

export const maxZoom = 3;

/** Zoom by a factor about a point on the field, as a pinch or the wheel does. */
export function zoomAbout(view: View, factor: number, at: { x: number; y: number }, width: number, loose = false, height: number = field.height): View {
  const zoom = Math.min(maxZoom, Math.max(loose ? 0.5 : 1, view.zoom * factor));
  const k = zoom / view.zoom;
  const pan = { x: at.x - (at.x - view.pan.x) * k, y: at.y - (at.y - view.pan.y) * k };
  return { zoom, pan: clampPan(pan, zoom, width, loose, height) };
}

export type Pull = { readonly dx: number; readonly dy: number; readonly ready: boolean };

/** How far down a face has to be pulled before letting go opens it. */
export const pullToOpen = 140;

export type TileFrame = {
  readonly x: number;
  readonly y: number;
  /** Of the 100px base tile. */
  readonly scale: number;
  readonly z: number;
  /** In colour, rather than grey. */
  readonly colour: boolean;
  readonly opacity: number;
  readonly plate: string;
  /** The plate above the tile rather than below it. */
  readonly plateUp: boolean;
  /** The plate aligned to the tile's right edge rather than its left. */
  readonly plateRight: boolean;
};

/**
 * Where a face stands, and how it looks, given what the visitor is doing to it.
 *
 * A chosen or held face grows to about 200px. It is kept inside the visible
 * field at any zoom or pan, so a face in the top or bottom row is never
 * cropped; its name plate sits below it, and flips above when it would fall
 * off the bottom, and to its right edge near the field's right.
 */
export function tileFrame(input: {
  slot: Slot;
  person: RuntimePerson;
  selected: boolean;
  held: boolean;
  pull: Pull | null;
  view: View;
  width: number;
  height?: number;
}): TileFrame {
  const { slot, person, selected, held, pull, view, width, height = field.height } = input;
  const raised = selected || held;
  let scale = slot.size / 100;
  let x = slot.x;
  let y = slot.y;
  let z = slot.ring === 'focus' ? 8 : slot.ring === 'tie' ? 7 : 1;
  if (raised) {
    // On a phone's small faces, a chosen one grows to about 150 rather than 200.
    const target = narrow(width) ? 150 : 200;
    const grow = slot.ring || slot.named ? 1 : slot.size >= 150 ? 1.1 : Math.max(2.1, target / Math.max(slot.size, 1));
    const big = slot.size * grow;
    x = slot.x - (big - slot.size) / 2;
    y = slot.y - (big - slot.size) / 2;
    scale = big / 100;
    z = held ? 9 : 8;
  }
  if (pull) {
    x += pull.dx;
    y += pull.dy;
    scale = Math.max(scale, 1.3);
    z = 10;
  }
  const edge = scale * 100;
  x = Math.max(-slot.size * 0.2, Math.min(width - edge + slot.size * 0.2, x));
  if (raised || pull) {
    const top = (-view.pan.y + 6) / view.zoom;
    const bottom = (height - view.pan.y - 6) / view.zoom - edge;
    y = Math.max(top, Math.min(bottom, y));
  }
  const dimmed = slot.dim > 0 && !raised;
  const opacity = slot.dim >= 2 && !selected ? 0 : dimmed ? (slot.dim >= 1 ? 0.28 : 0.55) : 1;
  const plate = pull
    ? (pull.ready ? 'Release to open' : 'Pull down to open')
    : raised && slot.ring !== 'focus' && !slot.named
      ? `${person.name}${person.classYear ? ` · ${person.classYear}` : ''}`
      : '';
  const screenBottom = view.pan.y + (y + edge) * view.zoom;
  const screenLeft = view.pan.x + x * view.zoom;
  // The plate is drawn inside the tile, so it grows with it: a long name on a
  // raised face runs well past 260px, and is measured roughly by its letters.
  const plateWidth = Math.max(260, (plate.length * 13 * 0.56 + 16) * scale * view.zoom);
  return {
    x, y, scale, z,
    colour: raised || Boolean(pull) || Boolean(slot.ring) || Boolean(slot.lit),
    opacity,
    plate,
    plateUp: screenBottom > height - 120,
    plateRight: screenLeft + plateWidth > width,
  };
}
