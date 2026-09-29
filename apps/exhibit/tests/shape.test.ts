import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFit, stageShape } from '../src/app/shape.ts';
import { fieldGeometry, field, peopleLayout, tileFrame, homeView, yearsLayout, tourLayout, yearsHead } from '../src/state/wall.ts';
import type { RuntimePerson } from '../src/data/runtime.ts';

const person = (id: string, sortName: string, classYear: number | null = 2010): RuntimePerson => ({
  id, name: sortName, sortName, classYear, portrait: null, biography: '', biographyCurated: false,
  contributions: ['Press'], communities: ['Serbian'], countries: [], sourceUrl: null, presentedBy: null, films: [],
});
const everyone = Array.from({ length: 111 }, (_, index) => person(`p${index}`, `${String.fromCharCode(65 + (index % 23))}name ${index}`, 2000 + (index % 16)));

test('the display is always drawn at 1920 × 1080', () => {
  for (const [w, h] of [[1920, 1080], [1280, 900], [390, 844]] as const) {
    const shape = stageShape(w, h, 'fixed');
    assert.deepEqual([shape.kind, shape.width, shape.height], ['wall', 1920, 1080]);
  }
});

test('the public site fills a screen of any shape, with no ground showing', () => {
  for (const [w, h] of [[1920, 1080], [1440, 900], [844, 390], [2560, 1080], [390, 844], [820, 1180], [320, 568]] as const) {
    const shape = stageShape(w, h, 'fill');
    assert.ok(Math.abs(shape.width * shape.scale - w) < 1, `${w}×${h} fills the width`);
    assert.ok(Math.abs(shape.height * shape.scale - h) < 1, `${w}×${h} fills the height`);
  }
  assert.deepEqual(stageShape(1920, 1080, 'fill'), { kind: 'wall', width: 1920, height: 1080, scale: 1 });
});

test('a screen held upright gets the phone arrangement, near a screen pixel per design pixel', () => {
  const phone = stageShape(390, 844, 'fill');
  assert.equal(phone.kind, 'phone');
  assert.ok(phone.width >= 560 && phone.scale >= 0.6 && phone.scale <= 1);
  assert.equal(stageShape(844, 390, 'fill').kind, 'wall');
});

test('the fit follows the target, unless the address asks', () => {
  assert.equal(readFit('', 'public'), 'fill');
  assert.equal(readFit('', 'kiosk'), 'fixed');
  assert.equal(readFit('?fit=fill', 'kiosk'), 'fill');
  assert.equal(readFit('?fit=nonsense', 'kiosk'), 'fixed');
});

test('on the display the field is where it always was', () => {
  const geometry = fieldGeometry(stageShape(1920, 1080, 'fixed'));
  assert.deepEqual(geometry.rest, { left: field.left, top: field.top, width: field.width, height: field.height });
  assert.equal(geometry.sheet.width, field.widthWithSheet);
  assert.equal(geometry.search.width, field.widthWithSearch);
});

test('on a phone a sheet or search shortens the field, and it never runs under the bar', () => {
  const shape = stageShape(390, 844, 'fill');
  const geometry = fieldGeometry(shape);
  for (const place of [geometry.rest, geometry.sheet, geometry.search]) {
    assert.equal(place.width, shape.width - 32);
    assert.ok(place.top + place.height <= shape.height - 200 + 1);
  }
  assert.ok(geometry.sheet.top + geometry.sheet.height <= shape.height - geometry.sheetHeight);
  assert.ok(geometry.search.top >= geometry.searchHeight);
});

test('on a phone every layout keeps everybody inside the field', () => {
  const { rest } = fieldGeometry(stageShape(390, 844, 'fill'));
  const inside = (slots: Iterable<{ x: number; y: number; size: number; dim: number }>, W: number, H: number) => {
    for (const slot of slots) {
      if (slot.dim >= 2) continue;
      assert.ok(slot.x >= -0.5 && slot.x + slot.size <= W + 0.5, `x ${slot.x}`);
      assert.ok(slot.y >= -0.5 && slot.y + slot.size <= H + 0.5, `y ${slot.y}`);
    }
  };
  inside(peopleLayout(everyone, 'name', rest.width, null, null, true, rest.height).slots.values(), rest.width - 40, rest.height);
  inside(peopleLayout(everyone, 'community', rest.width, null, null, true, rest.height).slots.values(), rest.width, rest.height);
  const years = yearsLayout(everyone, rest.width, null, null, rest.height);
  inside(years.slots.values(), rest.width, rest.height);
  for (const slot of years.slots.values()) if (slot.dim < 2) assert.ok(slot.y >= yearsHead, 'below the year');
  inside(tourLayout(everyone, everyone.slice(0, 9).map((each) => each.id), 'A tour', rest.width, rest.height).slots.values(), rest.width, rest.height);
});

test('a chosen face on a phone grows, and stays inside the shorter field', () => {
  const { sheet } = fieldGeometry(stageShape(390, 844, 'fill'));
  const frame = tileFrame({ slot: { x: 10, y: sheet.height - 40, size: 40, dim: 0 }, person: everyone[0]!, selected: true, held: false, pull: null, view: homeView, width: sheet.width, height: sheet.height });
  assert.ok(frame.scale * 100 >= 140 && frame.scale * 100 <= 160);
  assert.ok(frame.y + frame.scale * 100 <= sheet.height);
});
