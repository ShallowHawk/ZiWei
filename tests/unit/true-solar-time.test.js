const test = require('node:test');
const assert = require('node:assert/strict');
const { applyTrueSolarTime, getTimeIndex } = require('../../src/core/true-solar-time');

test('late zi hour maps to timeIndex 12', () => {
  const date = new Date(2026, 2, 11, 23, 30, 0, 0);
  assert.equal(getTimeIndex(date), 12);
});

test('early zi hour maps to timeIndex 0', () => {
  const date = new Date(2026, 2, 11, 0, 30, 0, 0);
  assert.equal(getTimeIndex(date), 0);
});

test('true solar time applies longitude and equation of time', () => {
  const date = new Date(1990, 4, 15, 14, 30, 0, 0);
  const result = applyTrueSolarTime(date, 116.4074, 8);
  assert.ok(result.totalOffset < 0);
  assert.equal(Math.round(result.longitudeCorrection), -14);
});
