import assert from 'node:assert/strict';
import { test } from 'node:test';
import { continuationUrl, refusalMessage } from '../src/index.ts';

const site = 'https://clevelandinternationalhalloffame.com/cihof/';

test('a code points at the same person on the public site', () => {
  const result = continuationUrl(site, 'alex-machaskee-2010');
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.url, 'https://clevelandinternationalhalloffame.com/cihof/people/alex-machaskee-2010/');
});

test('a missing trailing slash does not eat the deployment sub-path', () => {
  const result = continuationUrl('https://clevelandinternationalhalloffame.com/cihof', 'alex-machaskee-2010');
  assert.equal(result.ok && result.url, 'https://clevelandinternationalhalloffame.com/cihof/people/alex-machaskee-2010/');
});

test('an address that only works on this machine produces no code', () => {
  for (const base of [
    'https://localhost:4330/cihof/',
    'https://127.0.0.1/cihof/',
    'https://192.168.1.14/cihof/',
    'https://10.0.0.5/cihof/',
    'https://exhibit.local/cihof/',
  ]) {
    const result = continuationUrl(base, 'alex-machaskee-2010');
    assert.equal(result.ok, false, `${base} must be refused`);
    assert.equal(result.ok === false && result.refusal, 'not-publicly-reachable');
  }
});

test('an unencrypted or unconfigured destination produces no code', () => {
  assert.equal(continuationUrl('http://clevelandinternationalhalloffame.com/', 'a').ok, false);
  assert.equal(continuationUrl('', 'a').ok, false);
  assert.equal(continuationUrl(null, 'a').ok, false);
  assert.equal(continuationUrl('not a url', 'a').ok, false);
});

test('a staff route is never given to a visitor', () => {
  for (const base of ['https://example.org/portal/', 'https://example.org/admin/', 'https://example.org/staff/review/']) {
    const result = continuationUrl(base, 'alex-machaskee-2010');
    assert.equal(result.ok, false, `${base} must be refused`);
    assert.equal(result.ok === false && result.refusal, 'staff-route');
  }
});

test('every refusal explains itself', () => {
  for (const refusal of ['no-base-configured', 'not-a-url', 'insecure-scheme', 'not-publicly-reachable', 'staff-route'] as const) {
    assert.ok(refusalMessage(refusal).length > 20, `${refusal} needs a usable message`);
  }
});

test('a person id is escaped rather than trusted into the path', () => {
  const result = continuationUrl(site, '../../admin');
  assert.equal(result.ok, true);
  assert.ok(result.ok);

  const path = new URL(result.url).pathname;
  // The id stays one encoded segment under people/: traversal cannot climb out
  // and reach a sibling route.
  assert.equal(path, '/cihof/people/..%2F..%2Fadmin/');
  assert.equal(path.includes('/../'), false, 'no traversal survives into the path');
  assert.ok(path.startsWith('/cihof/people/'), 'the destination stays under the people route');
});
