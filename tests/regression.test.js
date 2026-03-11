const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildChart } = require('../src/core/chart');

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/sample-cases.json'), 'utf8'));

for (const item of cases) {
  test(`sample regression: ${item.name}`, () => {
    const result = buildChart(item.input);
    assert.equal(result.location.code, item.expect.locationCode);
    assert.equal(result.trueSolar.timeIndex, item.expect.timeIndex);
    if (item.expect.solarDate) {
      assert.equal(result.chart.solarDate, item.expect.solarDate);
    }
  });
}
