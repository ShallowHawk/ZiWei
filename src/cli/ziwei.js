#!/usr/bin/env node
const { buildChart } = require('../core/chart');
const { buildTextReport } = require('../report/text');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function help() {
  console.log('用法：');
  console.log('  node src/cli/ziwei.js --date 1990-05-15 --time 14:30 --gender male --place 北京市东城区');
  console.log('  node src/cli/ziwei.js --date 1990-05-15 --time 14:30 --gender female --longitude 121.4737 --latitude 31.2304 --place 上海 --json');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.date || !args.time || !args.gender) {
    help();
    process.exit(args.help ? 0 : 1);
  }

  const result = buildChart(args);
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(buildTextReport(result));
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
