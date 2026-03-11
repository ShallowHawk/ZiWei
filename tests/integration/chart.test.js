const test = require('node:test');
const assert = require('node:assert/strict');
const { buildChart } = require('../../src/core/chart');

test('build chart with district-level place', () => {
  const result = buildChart({
    date: '1990-05-15',
    time: '14:30',
    gender: 'male',
    place: '北京市东城区',
  });
  assert.equal(result.location.code, '110101');
  assert.equal(result.trueSolar.timeIndex, 7);
  assert.equal(result.palaces.length, 12);
  assert.ok(result.highlights.some((line) => line.includes('命宫')));
});

test('build chart with manual coordinates', () => {
  const result = buildChart({
    date: '1990-05-15',
    time: '14:30',
    gender: 'female',
    longitude: 121.4737,
    latitude: 31.2304,
    place: '上海',
  });
  assert.equal(result.location.source, 'manual');
  assert.ok(result.chart.lunarDate);
});
