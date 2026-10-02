import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultLayers, diagramLayout, layerCounts, layerOfTie, placesLayout, spreadAt, tieWording, type LayerId } from '../src/state/connections.ts';
import { field, homeView } from '../src/state/wall.ts';

import { publishedBundle } from './bundle.ts';

const bundle = publishedBundle();
const on = new Set<LayerId>(defaultLayers);
const input = { people: bundle.people, relationships: bundle.relationships, contexts: bundle.contexts ?? [], candidates: [], places: bundle.places, on, width: field.width };

test('kinds of claim stay apart: a relationship, context, and a proposal each have their own layer and wording', () => {
  assert.equal(layerOfTie({ kind: 'inducted' }), 'inducted');
  assert.equal(layerOfTie({ kind: 'friend-of' }), 'personal');
  assert.equal(layerOfTie({ kind: 'collaborated-with' }), 'worked');
  assert.equal(layerOfTie({ kind: 'inducted', context: true }), 'together', 'context is never a relationship');
  assert.equal(layerOfTie({ kind: 'inducted', unreviewed: true }), 'proposed');
  assert.equal(tieWording({ label: 'fellow members of the 2017 class', context: true }), 'Appeared together · fellow members of the 2017 class');
  assert.equal(tieWording({ label: 'mentored', unreviewed: true }), 'Proposed · mentored');
});

test('the diagram puts the chosen person at the centre and their ties round them, worded outwards', () => {
  const layout = diagramLayout({ ...input, focusId: 'senator-george-voinovich-2010', placeId: null, view: homeView });
  const focus = layout.slots.get('senator-george-voinovich-2010')!;
  assert.equal(focus.ring, 'focus');
  assert.equal(focus.size, 184);
  assert.ok(Math.abs(focus.x + 92 - field.width / 2) < 1 && Math.abs(focus.y + 92 - field.height / 2) < 1, 'centred');
  const ties = [...layout.slots.values()].filter((slot) => slot.ring === 'tie');
  assert.ok(ties.length > 0);
  assert.ok(ties.every((slot) => slot.size === 104 && slot.note), 'each tie is a face with its wording');
  assert.equal(layout.title, 'Senator George Voinovich');
});

test('zoomed in, everybody outside the ring lines the edges of the view at a steady size', () => {
  const view = { zoom: 1.6, pan: { x: -300, y: -200 } };
  const layout = diagramLayout({ ...input, focusId: 'senator-george-voinovich-2010', placeId: null, view });
  const inView = (x: number, y: number) => x >= -view.pan.x / view.zoom - 1 && y >= -view.pan.y / view.zoom - 1
    && x <= (field.width - view.pan.x) / view.zoom + 1 && y <= (field.height - view.pan.y) / view.zoom + 1;
  const outer = [...layout.slots.values()].filter((slot) => !slot.ring && slot.dim > 0 && slot.dim < 2);
  assert.ok(outer.length > 10);
  for (const slot of outer) {
    assert.ok(Math.abs(slot.size * view.zoom - 44) < 0.01, 'a steady 44px on the screen');
    assert.ok(inView(slot.x, slot.y) && inView(slot.x + slot.size, slot.y + slot.size), 'on screen');
  }
  const kept = diagramLayout({ ...input, focusId: 'senator-george-voinovich-2010', placeId: null, view, keepClear: { top: 64, right: 84 } });
  for (const slot of [...kept.slots.values()].filter((each) => !each.ring && each.dim > 0 && each.dim < 2)) {
    assert.ok(view.pan.y + slot.y * view.zoom >= 64 - 1, 'clear of the trail');
    assert.ok(view.pan.x + (slot.x + slot.size) * view.zoom <= field.width - 84 + 1, 'clear of the zoom buttons');
  }
});

test('a place at the centre rings the people a curator tied to it, and nobody else', () => {
  const place = bundle.places.find((each) => each.personIds.length > 3)!;
  const layout = diagramLayout({ ...input, focusId: null, placeId: place.id, view: homeView });
  assert.equal(layout.markers[0]?.focus, true);
  assert.equal(layout.title, place.name);
  const shown = [...layout.slots.entries()].filter(([, slot]) => slot.dim < 2).map(([id]) => id).sort();
  assert.deepEqual(shown, [...place.personIds].sort());
});

test('by place: every place with people has its box, no two overlap, and the rest wait along the bottom', () => {
  for (const [width, zoom] of [[field.width, 1], [field.widthWithSheet, 1], [field.width, 1.7], [field.width, 3]] as const) {
    const layout = placesLayout({ ...input, width, selectedId: null, view: { zoom, pan: { x: 0, y: 0 } } });
    const boxes = layout.arcs.filter((arc) => arc.d.includes(' h')).map((arc) => {
      const [, x, y, w, h] = /M([\d.-]+) ([\d.-]+) h([\d.-]+) v([\d.-]+)/.exec(arc.d)!.map(Number);
      return { x: x!, y: y!, w: w!, h: h! };
    });
    assert.equal(boxes.length, bundle.places.filter((each) => each.personIds.length > 0).length);
    for (let a = 0; a < boxes.length; a += 1) {
      for (let b = a + 1; b < boxes.length; b += 1) {
        const A = boxes[a]!;
        const B = boxes[b]!;
        assert.ok(!(A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h), `places ${a} and ${b} overlap at ${width}, ${zoom}×`);
      }
    }
    for (const box of boxes) assert.ok(box.x >= 0 && box.x + box.w <= width && box.y >= 0, 'inside the field');
    assert.ok(layout.labels.some((label) => /people not yet tied to a reviewed place$/.test(label.text)));
  }
});

test('by place, choosing somebody lights their ties and their places', () => {
  const layout = placesLayout({ ...input, selectedId: 'wael-khoury-2017' });
  assert.equal(layout.slots.get('wael-khoury-2017')?.ring, 'focus');
  assert.ok([...layout.slots.values()].some((slot) => slot.ring === 'tie'));
  assert.ok(layout.arcs.some((arc) => arc.width === 4), 'their ties are drawn heavy');
});

test('the layer chips count what each layer holds', () => {
  const counts = layerCounts({ relationships: bundle.relationships, contexts: bundle.contexts, candidates: [], places: bundle.places });
  assert.equal(counts.inducted + counts.worked + counts.personal, bundle.relationships.length);
  assert.equal(counts.together, bundle.contexts.length);
});

test('somebody chosen stays at the centre when every layer holding their ties is off', () => {
  const none = new Set<LayerId>();
  const alone = diagramLayout({ ...input, on: none, focusId: 'wael-khoury-2017', placeId: null, view: homeView });
  assert.equal(alone.slots.get('wael-khoury-2017')?.ring, 'focus');
  assert.equal(alone.title, 'Wael Khoury');
  assert.equal(alone.subtitle, 'no tie in these layers');
  const nobody = diagramLayout({ ...input, on: none, focusId: null, placeId: null, view: homeView });
  assert.equal(nobody.subtitle, 'every layer is off · turn one on below');
});

test('zoomed in, a map spreads out: words and faces grow on the screen more slowly than the zoom, so they separate', () => {
  assert.equal(spreadAt(0.5), 1);
  assert.equal(spreadAt(1), 1);
  assert.ok(spreadAt(2) > 1 && spreadAt(2) < 2);
  const zoom = 2;
  const view = { zoom, pan: { x: 0, y: 0 } };
  const near = placesLayout({ ...input, selectedId: null, view });
  const far = placesLayout({ ...input, selectedId: null });
  const title = (layout: typeof far) => layout.labels.find((label) => label.chip)!;
  assert.ok(title(near).size < title(far).size, 'smaller on the field');
  assert.ok(title(near).size * zoom > title(far).size, 'larger on the screen');

  const focusId = 'senator-george-voinovich-2010';
  const close = diagramLayout({ ...input, focusId, placeId: null, view });
  const whole = diagramLayout({ ...input, focusId, placeId: null, view: homeView });
  const centreOf = (layout: typeof whole) => { const slot = layout.slots.get(focusId)!; return { x: slot.x + slot.size / 2, y: slot.y + slot.size / 2, size: slot.size }; };
  assert.ok(Math.abs(centreOf(close).x - centreOf(whole).x) < 0.5 && Math.abs(centreOf(close).y - centreOf(whole).y) < 0.5, 'the centre stays where it was');
  assert.ok(centreOf(close).size < centreOf(whole).size && centreOf(close).size * zoom > centreOf(whole).size);
});
