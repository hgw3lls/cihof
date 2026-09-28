import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampPan, field, homeView, peopleLayout, railLetters, tileFrame, yearsLayout, zoomAbout, type Slot } from '../src/state/wall.ts';
import type { RuntimePerson } from '../src/data/runtime.ts';

const person = (id: string, sortName: string, classYear: number | null = 2010, communities: string[] = ['Serbian']): RuntimePerson => ({
  id, name: sortName, sortName, classYear, portrait: null, biography: '', biographyCurated: false,
  contributions: ['Press'], communities, countries: [], sourceUrl: null, presentedBy: null, films: [],
});

const everyone = Array.from({ length: 111 }, (_, index) => person(`p${index}`, `${String.fromCharCode(65 + (index % 23))}name ${index}`));

test('A to Z puts everyone on the field, in order, inside the rail', () => {
  const layout = peopleLayout(everyone, 'name', field.width, null);
  assert.equal(layout.slots.size, everyone.length);
  assert.equal(layout.rail, true);
  for (const slot of layout.slots.values()) {
    assert.ok(slot.x >= 0 && slot.y >= 0, 'nobody starts off the top or left');
    assert.ok(slot.x + slot.size <= field.width - 64, 'nobody is under the letter rail');
    assert.ok(slot.y + slot.size <= field.height, 'nobody is below the field');
  }
  const first = layout.order.map((id) => everyone.find((p) => p.id === id)!.sortName);
  assert.deepEqual(first, first.slice().sort((a, b) => a.localeCompare(b)));
});

test('a letter steps the others back without moving anyone', () => {
  const all = peopleLayout(everyone, 'name', field.width, null);
  const lettered = peopleLayout(everyone, 'name', field.width, 'B');
  for (const [id, slot] of lettered.slots) {
    assert.equal(slot.x, all.slots.get(id)!.x);
    const initial = everyone.find((p) => p.id === id)!.sortName[0];
    assert.equal(slot.dim, initial === 'B' ? 0 : 1);
  }
  assert.ok(railLetters(everyone).includes('B'));
});

test('grouped arrangements label every group and fit the field', () => {
  const mixed = everyone.map((p, index) => ({ ...p, communities: [`Community ${index % 9}`] }));
  const layout = peopleLayout(mixed, 'community', field.widthWithSheet, null);
  assert.equal(layout.labels.length, 9);
  assert.equal(layout.slots.size, mixed.length);
  for (const slot of layout.slots.values()) assert.ok(slot.y + slot.size <= field.height + 0.5);
});

const view = (zoom: number, x = 0, y = 0) => ({ zoom, pan: { x, y } });

test('a chosen face in the top or bottom row is never cropped, at any zoom or pan', () => {
  const top: Slot = { x: 400, y: 0, size: 60, dim: 0 };
  const bottom: Slot = { x: 400, y: field.height - 60, size: 60, dim: 0 };
  for (const v of [homeView, view(2, -300, -200), view(3, -1000, -1568)]) {
    for (const slot of [top, bottom]) {
      const frame = tileFrame({ slot, person: everyone[0]!, selected: true, held: false, pull: null, view: v, width: field.width });
      const screenTop = v.pan.y + frame.y * v.zoom;
      const screenBottom = v.pan.y + (frame.y + frame.scale * 100) * v.zoom;
      assert.ok(screenTop >= 6 - 1e-6, `top edge in view at zoom ${v.zoom}`);
      assert.ok(screenBottom <= field.height - 6 + 1e-6, `bottom edge in view at zoom ${v.zoom}`);
    }
  }
});

test('the name plate flips above near the bottom and to the right edge near the right', () => {
  const low: Slot = { x: 100, y: field.height - 60, size: 60, dim: 0 };
  const lowFrame = tileFrame({ slot: low, person: everyone[0]!, selected: true, held: false, pull: null, view: homeView, width: field.width });
  assert.equal(lowFrame.plateUp, true);
  assert.equal(lowFrame.plateRight, false);
  const right: Slot = { x: field.width - 120, y: 100, size: 60, dim: 0 };
  const rightFrame = tileFrame({ slot: right, person: everyone[0]!, selected: true, held: false, pull: null, view: homeView, width: field.width });
  assert.equal(rightFrame.plateUp, false);
  assert.equal(rightFrame.plateRight, true);
  assert.equal(rightFrame.plate, 'Aname 0 · 2010');
});

test('a pulled face says when letting go will open it', () => {
  const slot: Slot = { x: 100, y: 100, size: 60, dim: 0 };
  const pulling = tileFrame({ slot, person: everyone[0]!, selected: false, held: false, pull: { dx: 0, dy: 50, ready: false }, view: homeView, width: field.width });
  assert.equal(pulling.plate, 'Pull down to open');
  assert.equal(pulling.colour, true);
  const ready = tileFrame({ slot, person: everyone[0]!, selected: false, held: false, pull: { dx: 0, dy: 160, ready: true }, view: homeView, width: field.width });
  assert.equal(ready.plate, 'Release to open');
});

test('faces stepped back are quieter, and faces off the field are gone', () => {
  const frame = (dim: number, selected = false) => tileFrame({ slot: { x: 0, y: 0, size: 60, dim }, person: everyone[0]!, selected, held: false, pull: null, view: homeView, width: field.width });
  assert.equal(frame(0).opacity, 1);
  assert.equal(frame(0.5).opacity, 0.55);
  assert.equal(frame(1).opacity, 0.28);
  assert.equal(frame(2).opacity, 0);
  assert.equal(frame(1, true).opacity, 1, 'a chosen face is always in full');
  assert.equal(frame(0).colour, false, 'faces are grey until chosen');
});

test('zoom stays between the whole wall and three times, and never leaves a gap', () => {
  let v = zoomAbout(homeView, 0.5, { x: 900, y: 400 }, field.width);
  assert.deepEqual(v, homeView, 'the whole wall is as far out as it goes');
  for (let step = 0; step < 20; step += 1) v = zoomAbout(v, 1.3, { x: 1800, y: 780 }, field.width);
  assert.equal(v.zoom, 3);
  assert.deepEqual(clampPan(v.pan, v.zoom, field.width), v.pan);
  assert.ok(v.pan.x <= 0 && v.pan.x >= field.width - field.width * 3);
});

test('a long name on a raised face keeps its plate on the field', () => {
  const long = { ...everyone[0]!, name: 'Jeanette Grasselli Brown' };
  const slot: Slot = { x: 880, y: 100, size: 80, dim: 0 };
  const frame = tileFrame({ slot, person: long, selected: true, held: false, pull: null, view: homeView, width: field.widthWithSheet });
  assert.equal(frame.plateRight, true);
});

test('Years shows one class beside its year, the chosen person’s, and the rest wait below', () => {
  const classes = [person('a', 'Ann', 2010), person('b', 'Bea', 2010), person('c', 'Cy', 2012)];
  const newest = yearsLayout(classes, field.width, null, null);
  assert.equal(newest.year, 2012, 'the newest class first');
  assert.equal(newest.slots.get('a')!.dim, 2, 'another class waits off the field');
  const theirs = yearsLayout(classes, field.width, 2012, 'a');
  assert.equal(theirs.year, 2010, 'somebody chosen brings their own class');
  for (const id of ['a', 'b']) {
    const slot = theirs.slots.get(id)!;
    assert.ok(slot.x >= 680 && slot.x + slot.size <= field.width && slot.y + slot.size <= field.height);
    assert.equal(slot.named, true);
  }
  assert.deepEqual(theirs.labels.map((label) => label.text), ['Ann', 'Bea']);
  const frame = tileFrame({ slot: theirs.slots.get('a')!, person: classes[0]!, selected: true, held: false, pull: null, view: homeView, width: field.width });
  assert.equal(frame.scale * 100, theirs.slots.get('a')!.size, 'a face already named is not enlarged when chosen');
  assert.equal(frame.plate, '');
});
