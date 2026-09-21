import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';
import { publishPortraits } from '../src/build/assets.ts';

test('publishing portraits does not delete anything else in the target', () => {
  const target = mkdtempSync(join(tmpdir(), 'cihof-assets-'));
  mkdirSync(join(target, 'data'), { recursive: true });
  writeFileSync(join(target, 'data', 'exhibit.json'), '{"kept":true}');

  const result = publishPortraits(buildPeople(), target);

  assert.equal(existsSync(join(target, 'data', 'exhibit.json')), true,
    'a sibling published into the same directory must survive');
  assert.equal(readFileSync(join(target, 'data', 'exhibit.json'), 'utf8'), '{"kept":true}');
  assert.equal(result.copied, 111);
  assert.equal(existsSync(join(target, 'media', 'images', 'alex-machaskee-2010', 'primary.png')), true);
});
