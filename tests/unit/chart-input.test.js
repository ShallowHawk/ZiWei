const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTimezone } = require('../../src/core/chart');

test('normalize timezone defaults to UTC+8', () => {
  assert.equal(normalizeTimezone(undefined), 8);
  assert.equal(normalizeTimezone(''), 8);
});

test('normalize timezone accepts numeric input', () => {
  assert.equal(normalizeTimezone('9'), 9);
  assert.equal(normalizeTimezone(5.5), 5.5);
});

test('normalize timezone rejects invalid input', () => {
  assert.throws(() => normalizeTimezone('abc'), /时区需为有效数字/);
});
