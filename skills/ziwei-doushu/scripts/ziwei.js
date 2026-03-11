#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { astro } = require('iztro');

const cities = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'cities.json'), 'utf8')
);

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

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

function equationOfTimeMinutes(date) {
  const n = dayOfYear(date);
  const b = ((2 * Math.PI) / 364) * (n - 81);
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

function resolveLocation(args) {
  const place = args.place || '';
  const longitude = args.longitude ? Number(args.longitude) : undefined;
  const latitude = args.latitude ? Number(args.latitude) : undefined;

  if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
    return { place: place || '自定义坐标', longitude, latitude, source: 'manual' };
  }

  if (place && cities[place]) {
    return { place, ...cities[place], source: 'builtin' };
  }

  if (Number.isFinite(longitude)) {
    return { place: place || '仅提供经度', longitude, latitude: latitude ?? null, source: 'partial' };
  }

  throw new Error('请提供 --place（且城市需在内置表中）或直接提供 --longitude 和 --latitude。');
}

function parseBirthDateTime(dateText, timeText) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText || '')) {
    throw new Error('日期格式需为 YYYY-MM-DD');
  }
  if (!/^\d{2}:\d{2}$/.test(timeText || '')) {
    throw new Error('时间格式需为 HH:mm');
  }
  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);
  return { year, month, day, hour, minute };
}

function getTimeIndex(date) {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  if (totalMinutes >= 23 * 60 || totalMinutes < 60) return 0; // 子
  return Math.floor((totalMinutes - 60) / 120) + 1;
}

function getTimeBranch(timeIndex) {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  return branches[timeIndex] || '未知';
}

function applyTrueSolarTime(baseDate, longitude, timezone) {
  const localStandardMeridian = timezone * 15;
  const longitudeCorrection = 4 * (longitude - localStandardMeridian);
  const eot = equationOfTimeMinutes(baseDate);
  const totalOffset = longitudeCorrection + eot;
  const corrected = new Date(baseDate.getTime() + totalOffset * 60000);

  return {
    corrected,
    equationOfTime: eot,
    longitudeCorrection,
    totalOffset,
    standardMeridian: localStandardMeridian,
  };
}

function normalizeGender(input) {
  if (!input) throw new Error('请提供 --gender male 或 --gender female');
  const value = String(input).toLowerCase();
  if (['male', 'm', '男'].includes(value)) return 'male';
  if (['female', 'f', '女'].includes(value)) return 'female';
  throw new Error('性别仅支持 male / female');
}

function summarizePalace(palace) {
  const majors = palace.majorStars.map((s) => `${s.name}${s.brightness ? `(${s.brightness})` : ''}${s.mutagen ? `[${s.mutagen}]` : ''}`);
  const minors = palace.minorStars.map((s) => s.name);
  return {
    name: palace.name,
    branch: palace.earthlyBranch,
    heavenlyStem: palace.heavenlyStem,
    isBodyPalace: palace.isBodyPalace,
    majorStars: majors,
    minorStars: minors,
    adjectiveStars: palace.adjectiveStars.map((s) => s.name),
    decadalRange: palace.decadal?.range || null,
  };
}

function getPalace(chart, name) {
  return chart.palaces.find((p) => p.name === name);
}

function palaceOneLine(palace) {
  const branch = palace.earthlyBranch || palace.branch || '';
  const rawMajors = palace.majorStars || [];
  const rawMinors = palace.minorStars || [];
  const majors = rawMajors
    .map((s) => (typeof s === 'string' ? s : `${s.name}${s.brightness ? `(${s.brightness})` : ''}`))
    .join('、') || '无主星';
  const minors = rawMinors
    .map((s) => (typeof s === 'string' ? s : s.name))
    .filter(Boolean)
    .join('、');
  return `${palace.name}（${palace.heavenlyStem}${branch}）：${majors}${minors ? `；辅星/杂曜：${minors}` : ''}`;
}

function buildTextReport(result) {
  const lines = [];
  lines.push('═══ 紫微斗数排盘结果（iztro）═══');
  lines.push('');
  lines.push('【输入信息】');
  lines.push(`出生地：${result.location.place}`);
  lines.push(`经纬度：${result.location.longitude}, ${result.location.latitude ?? '未提供'}`);
  lines.push(`标准时间：${result.input.date} ${result.input.time}`);
  lines.push(`性别：${result.input.gender === 'male' ? '男' : '女'}`);
  lines.push('');
  lines.push('【真太阳时修正】');
  lines.push(`时区中央经线：${result.trueSolar.standardMeridian}°`);
  lines.push(`经度修正：${result.trueSolar.longitudeCorrection.toFixed(2)} 分钟`);
  lines.push(`时间方程：${result.trueSolar.equationOfTime.toFixed(2)} 分钟`);
  lines.push(`总修正：${result.trueSolar.totalOffset.toFixed(2)} 分钟`);
  lines.push(`真太阳时：${result.trueSolar.date} ${result.trueSolar.time}`);
  lines.push(`真太阳时辰：${result.trueSolar.branch}时（timeIndex=${result.trueSolar.timeIndex}）`);
  lines.push('');
  lines.push('【命盘核心】');
  lines.push(`阳历：${result.chart.solarDate}`);
  lines.push(`农历：${result.chart.lunarDate}`);
  lines.push(`干支：${result.chart.chineseDate}`);
  lines.push(`生肖：${result.chart.zodiac}`);
  lines.push(`星座：${result.chart.sign}`);
  lines.push(`命宫：${result.chart.soul}`);
  lines.push(`身宫：${result.chart.body}`);
  lines.push(`五行局：${result.chart.fiveElementsClass}`);
  lines.push('');
  lines.push('【十二宫简表】');
  result.palaces.forEach((p) => lines.push(palaceOneLine(p)));
  lines.push('');
  lines.push('【重点宫位摘要】');
  result.highlights.forEach((item) => lines.push(`- ${item}`));
  lines.push('');
  lines.push('【后续解读建议】');
  lines.push('- 先用命宫 + 财帛 + 官禄 + 迁移看三方四正。');
  lines.push('- 再结合四化、夫妻宫、福德宫扩写人生结构。');
  lines.push('- 若要做完整报告，可将本结果作为结构化盘面输入给上层提示词。');
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.date || !args.time || !args.gender) {
    console.log('用法：');
    console.log('  node skills/ziwei-doushu/scripts/ziwei.js --date 1990-05-15 --time 14:30 --gender male --place 北京');
    console.log('  node skills/ziwei-doushu/scripts/ziwei.js --date 1990-05-15 --time 14:30 --gender female --longitude 121.4737 --latitude 31.2304 --place 上海 --json');
    process.exit(args.help ? 0 : 1);
  }

  const location = resolveLocation(args);
  const gender = normalizeGender(args.gender);
  const timezone = args.timezone ? Number(args.timezone) : 8;
  const birth = parseBirthDateTime(args.date, args.time);
  const baseDate = new Date(birth.year, birth.month - 1, birth.day, birth.hour, birth.minute, 0, 0);
  const trueSolar = applyTrueSolarTime(baseDate, location.longitude, timezone);
  const timeIndex = getTimeIndex(trueSolar.corrected);
  const chart = astro.bySolar(formatDate(trueSolar.corrected), timeIndex, gender);

  const palaces = chart.palaces.map(summarizePalace);
  const highlights = ['命宫', '财帛', '官禄', '夫妻', '迁移', '福德']
    .map((name) => getPalace(chart, name))
    .filter(Boolean)
    .map((palace) => palaceOneLine(palace));

  const result = {
    input: {
      date: args.date,
      time: args.time,
      gender,
      timezone,
    },
    location,
    trueSolar: {
      date: formatDate(trueSolar.corrected),
      time: formatTime(trueSolar.corrected),
      branch: getTimeBranch(timeIndex),
      timeIndex,
      standardMeridian: trueSolar.standardMeridian,
      longitudeCorrection: Number(trueSolar.longitudeCorrection.toFixed(2)),
      equationOfTime: Number(trueSolar.equationOfTime.toFixed(2)),
      totalOffset: Number(trueSolar.totalOffset.toFixed(2)),
    },
    chart: {
      solarDate: chart.solarDate,
      lunarDate: chart.lunarDate,
      chineseDate: chart.chineseDate,
      zodiac: chart.zodiac,
      sign: chart.sign,
      soul: chart.soul,
      body: chart.body,
      fiveElementsClass: chart.fiveElementsClass,
      gender: chart.gender,
    },
    palaces,
    highlights,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(buildTextReport({ ...result, rawChart: chart }));
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
