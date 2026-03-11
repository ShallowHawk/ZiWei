const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveLocation } = require('../../src/geo/resolver');

test('resolve district-level place from dataset', () => {
  const result = resolveLocation({ place: '杭州市余杭区' });
  assert.equal(result.code, '330110');
  assert.equal(result.city, '杭州市');
});

test('resolve alias place from dataset', () => {
  const result = resolveLocation({ place: '吴江' });
  assert.equal(result.code, '320509');
});

test('raise ambiguity on short place names', () => {
  assert.throws(() => resolveLocation({ place: '和平区' }), /地点存在歧义/);
});
