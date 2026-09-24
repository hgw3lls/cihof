import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAdminShortcut, isAllowedNavigation, isBlockedKey } from '../src/policy.mjs';

/**
 * What the exhibit window lets through. A visitor with a keyboard, or a
 * touchscreen that sends browser keys, must not be able to leave the exhibit,
 * reload it, open developer tools or zoom it.
 */

const key = (key, mods = {}) => ({ type: 'keyDown', key, ...mods });

test('browser shortcuts are blocked', () => {
  const blocked = [
    key('F5'), key('F12'), key('F11'), key('BrowserBack'), key('ContextMenu'),
    key('r', { control: true }), key('R', { control: true, shift: true }),
    key('i', { control: true, shift: true }), key('j', { control: true, shift: true }),
    key('u', { control: true }), key('p', { control: true }), key('s', { control: true }),
    key('n', { control: true }), key('w', { control: true }), key('f', { control: true }),
    key('+', { control: true }), key('-', { control: true }), key('0', { control: true }),
    key('r', { meta: true }), key('ArrowLeft', { alt: true }), key('ArrowRight', { alt: true }),
  ];
  for (const input of blocked) assert.equal(isBlockedKey(input, { debug: false }), true, JSON.stringify(input));
});

test('typing, arrows and the exhibit\'s own keys still work', () => {
  for (const input of [key('a'), key('Enter'), key('Escape'), key('Tab'), key('ArrowLeft'), key(' '), key('Backspace')]) {
    assert.equal(isBlockedKey(input, { debug: false }), false, JSON.stringify(input));
  }
});

test('with developer tools switched on, nothing is blocked', () => {
  assert.equal(isBlockedKey(key('F12'), { debug: true }), false);
  assert.equal(isBlockedKey(key('r', { control: true }), { debug: true }), false);
});

test('the admin shortcut is Ctrl+Shift+A, and is never itself blocked', () => {
  assert.equal(isAdminShortcut(key('A', { control: true, shift: true })), true);
  assert.equal(isAdminShortcut(key('a', { meta: true, shift: true })), true);
  assert.equal(isAdminShortcut(key('a', { control: true })), false);
  assert.equal(isAdminShortcut({ ...key('a', { control: true, shift: true }), type: 'keyUp' }), false);
  assert.equal(isBlockedKey(key('A', { control: true, shift: true }), { debug: false }), false);
});

test('only the exhibit itself can be navigated to', () => {
  const origin = 'http://127.0.0.1:8080';
  assert.equal(isAllowedNavigation('http://127.0.0.1:8080/?recovery=1', origin), true);
  assert.equal(isAllowedNavigation('https://clevelandinternationalhalloffame.com/', origin), false);
  assert.equal(isAllowedNavigation('http://127.0.0.1:9000/', origin), false);
  assert.equal(isAllowedNavigation('file:///C:/Windows/', origin), false);
  assert.equal(isAllowedNavigation('javascript:alert(1)', origin), false);
  assert.equal(isAllowedNavigation('not a url', origin), false);
});
