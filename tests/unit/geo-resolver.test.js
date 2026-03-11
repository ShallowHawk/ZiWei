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

test('raise not-found error with guidance for unknown places', () => {
  assert.throws(
    () => resolveLocation({ place: '火星基地' }),
    /未找到地点：火星基地。请补充到区\/县级，例如“杭州市余杭区”，或直接提供经纬度。/
  );
});

test('prefer manual coordinates over dataset lookup', () => {
  const result = resolveLocation({
    place: '火星基地',
    longitude: 120.123,
    latitude: 30.456,
  });
  assert.equal(result.source, 'manual');
  assert.equal(result.place, '火星基地');
  assert.equal(result.longitude, 120.123);
  assert.equal(result.latitude, 30.456);
});
