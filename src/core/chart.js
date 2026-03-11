const { astro } = require('iztro');
const { resolveLocation } = require('../geo/resolver');
const {
  applyTrueSolarTime,
  formatDate,
  formatTime,
  getTimeBranch,
  getTimeIndex,
} = require('./true-solar-time');

function parseBirthDateTime(dateText, timeText) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText || '')) {
    throw new Error('日期格式需为 YYYY-MM-DD');
  }
  if (!/^\d{2}:\d{2}$/.test(timeText || '')) {
    throw new Error('时间格式需为 HH:mm');
  }
  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);
  if (hour > 23 || minute > 59) throw new Error('时间格式需为 HH:mm');
  return { year, month, day, hour, minute };
}

function normalizeGender(input) {
  if (!input) throw new Error('请提供 --gender male 或 --gender female');
  const value = String(input).toLowerCase();
  if (['male', 'm', '男'].includes(value)) return 'male';
  if (['female', 'f', '女'].includes(value)) return 'female';
  throw new Error('性别仅支持 male / female');
}

function normalizeTimezone(input) {
  if (input === undefined || input === null || input === '') return 8;
  const value = Number(input);
  if (!Number.isFinite(value)) throw new Error('时区需为有效数字，例如 8 或 9');
  return value;
}

function summarizePalace(palace) {
  return {
    name: palace.name,
    branch: palace.earthlyBranch,
    heavenlyStem: palace.heavenlyStem,
    isBodyPalace: palace.isBodyPalace,
    majorStars: palace.majorStars.map((s) => ({
      name: s.name,
      brightness: s.brightness || null,
      mutagen: s.mutagen || null,
    })),
    minorStars: palace.minorStars.map((s) => s.name),
    adjectiveStars: palace.adjectiveStars.map((s) => s.name),
    decadalRange: palace.decadal?.range || null,
  };
}

function palaceOneLine(palace) {
  const branch = palace.earthlyBranch || palace.branch || '';
  const rawMajors = palace.majorStars || [];
  const rawMinors = palace.minorStars || [];
  const majors = rawMajors
    .map((s) => (typeof s === 'string' ? s : `${s.name}${s.brightness ? `(${s.brightness})` : ''}${s.mutagen ? `[${s.mutagen}]` : ''}`))
    .join('、') || '无主星';
  const minors = rawMinors
    .map((s) => (typeof s === 'string' ? s : s.name))
    .filter(Boolean)
    .join('、');
  return `${palace.name}（${palace.heavenlyStem}${branch}）：${majors}${minors ? `；辅星/杂曜：${minors}` : ''}`;
}

function getPalace(chart, name) {
  return chart.palaces.find((p) => p.name === name);
}

function buildChart(input) {
  const gender = normalizeGender(input.gender);
  const timezone = normalizeTimezone(input.timezone);
  const birth = parseBirthDateTime(input.date, input.time);
  const location = resolveLocation(input);
  const baseDate = new Date(birth.year, birth.month - 1, birth.day, birth.hour, birth.minute, 0, 0);
  const trueSolar = applyTrueSolarTime(baseDate, location.longitude, timezone);
  const timeIndex = getTimeIndex(trueSolar.corrected);
  const chart = astro.bySolar(formatDate(trueSolar.corrected), timeIndex, gender === 'male' ? '男' : '女', true, 'zh-CN');

  const palaces = chart.palaces.map(summarizePalace);
  const highlights = ['命宫', '财帛', '官禄', '夫妻', '迁移', '福德']
    .map((name) => getPalace(chart, name))
    .filter(Boolean)
    .map((palace) => palaceOneLine(palace));

  return {
    input: {
      date: input.date,
      time: input.time,
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
}

module.exports = {
  buildChart,
  parseBirthDateTime,
  normalizeGender,
  normalizeTimezone,
  summarizePalace,
  palaceOneLine,
};
