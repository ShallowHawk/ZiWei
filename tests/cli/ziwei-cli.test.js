const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const cliPath = path.join(__dirname, '../../src/cli/ziwei.js');

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
  });
}

test('CLI --json returns structured chart fields', () => {
  const result = runCli([
    '--date', '1988-02-09',
    '--time', '23:40',
    '--gender', 'female',
    '--place', '杭州市余杭区',
    '--json',
  ]);

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.input.gender, 'female');
  assert.equal(payload.input.timezone, 8);
  assert.equal(payload.location.code, '330110');
  assert.equal(payload.location.source, 'dataset');
  assert.equal(payload.trueSolar.branch, '子');
  assert.equal(typeof payload.trueSolar.totalOffset, 'number');
  assert.equal(payload.chart.gender, '女');
  assert.equal(payload.palaces.length, 12);
  assert.ok(payload.highlights.some((line) => line.includes('命宫')));
  assert.match(payload.usageNotice, /仅供传统命理研究/);
  assert.ok(Array.isArray(payload.limitations));
});

test('CLI reports ambiguous place errors on stderr', () => {
  const result = runCli([
    '--date', '1990-05-15',
    '--time', '14:30',
    '--gender', 'male',
    '--place', '和平区',
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /地点存在歧义：和平区/);
  assert.equal(result.stdout, '');
});

test('CLI reports place-not-found errors on stderr', () => {
  const result = runCli([
    '--date', '1990-05-15',
    '--time', '14:30',
    '--gender', 'male',
    '--place', '火星基地',
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /未找到地点：火星基地/);
  assert.match(result.stderr, /请补充到区\/县级/);
});
