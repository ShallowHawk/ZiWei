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

function normalizeTargetDate(input) {
  if (input === undefined || input === null || input === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input))) {
    throw new Error('目标日期格式需为 YYYY-MM-DD');
  }
  const date = new Date(`${input}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('目标日期格式需为 YYYY-MM-DD');
  }
  return date;
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

function summarizeMutagenStars(chart) {
  return chart.palaces.flatMap((palace) =>
    (palace.majorStars || [])
      .filter((star) => star.mutagen)
      .map((star) => ({
        palace: palace.name,
        star: star.name,
        mutagen: star.mutagen,
      }))
      .concat(
        (palace.minorStars || [])
          .filter((star) => star.mutagen)
          .map((star) => ({
            palace: palace.name,
            star: star.name,
            mutagen: star.mutagen,
          })),
      ),
  );
}

function summarizeDecadalPalaces(chart) {
  return chart.palaces.map((palace) => ({
    palace: palace.name,
    heavenlyStem: palace.decadal?.heavenlyStem || null,
    earthlyBranch: palace.decadal?.earthlyBranch || null,
    range: palace.decadal?.range || null,
    ages: palace.ages || [],
  }));
}

function summarizeHoroscopeItem(item) {
  return {
    name: item.name,
    index: item.index,
    heavenlyStem: item.heavenlyStem,
    earthlyBranch: item.earthlyBranch,
    mutagen: item.mutagen || [],
    palaceFlows: (item.palaceNames || []).map((palaceName, index) => ({
      palace: palaceName,
      stars: (item.stars?.[index] || []).map((star) => star.name),
    })),
  };
}

function buildExtensions(chart, targetDate) {
  const yearlyStem = chart.rawDates?.chineseDate?.yearly?.[0] || null;
  const extensions = {
    mutagen: {
      sourceStem: yearlyStem,
      byStar: summarizeMutagenStars(chart),
    },
    decadal: {
      byPalace: summarizeDecadalPalaces(chart),
    },
  };

  if (!targetDate) return extensions;

  const horoscope = chart.horoscope(targetDate);
  extensions.horoscope = {
    targetDate: formatDate(targetDate),
    lunarDate: horoscope.lunarDate,
    solarDate: horoscope.solarDate,
    nominalAge: horoscope.age.nominalAge,
    decadal: summarizeHoroscopeItem(horoscope.decadal),
    yearly: summarizeHoroscopeItem(horoscope.yearly),
  };

  return extensions;
}

function buildChart(input) {
  const gender = normalizeGender(input.gender);
  const timezone = normalizeTimezone(input.timezone);
  const birth = parseBirthDateTime(input.date, input.time);
  const location = resolveLocation(input);
  const targetDate = normalizeTargetDate(input.targetDate || input.fortuneDate || input.analysisDate);
  const baseDate = new Date(birth.year, birth.month - 1, birth.day, birth.hour, birth.minute, 0, 0);
  const trueSolar = applyTrueSolarTime(baseDate, location.longitude, timezone);
  const timeIndex = getTimeIndex(trueSolar.corrected);
  const chart = astro.bySolar(formatDate(trueSolar.corrected), timeIndex, gender === 'male' ? '男' : '女', true, 'zh-CN');

  const palaces = chart.palaces.map(summarizePalace);
  const highlights = ['命宫', '财帛', '官禄', '夫妻', '迁移', '福德']
    .map((name) => getPalace(chart, name))
    .filter(Boolean)
    .map((palace) => palaceOneLine(palace));
  const boundaryMinutes = trueSolar.corrected.getHours() * 60 + trueSolar.corrected.getMinutes();
  const isNearTimeBoundary = boundaryMinutes < 65 || boundaryMinutes >= 22 * 60 + 55 || Math.abs((boundaryMinutes - 60) % 120) <= 5;
  const limitations = [
    '仅供传统命理研究、原型验证与娱乐体验参考，不构成对现实结果的事实认定。',
    '不应用于替代医疗、法律、投资、婚育等重大决策建议。',
    'highlights 与文本摘要属于结构化盘面素材，不应直接视为最终结论。',
    '不同命理流派对同一盘面可能存在解释差异，当前仓库不提供统一权威口径。',
    location.source === 'dataset'
      ? '地点解析依赖内置地理数据；历史地名、海外地点或未收录区县可能无法稳定命中。'
      : '当前使用的是手动经纬度；若坐标或时区有误，盘面结果也会随之偏移。',
  ];
  if (isNearTimeBoundary) {
    limitations.push('当前真太阳时接近时辰边界，几分钟误差就可能导致 timeIndex 与盘面变化，请谨慎解读。');
  }

  return {
    input: {
      date: input.date,
      time: input.time,
      gender,
      timezone,
      targetDate: targetDate ? formatDate(targetDate) : null,
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
    usageNotice: '本结果仅供传统命理研究、原型验证与娱乐体验参考；涉及健康、法律、投资、婚育等重大事项，请咨询相应专业人士。',
    limitations,
    extensions: buildExtensions(chart, targetDate),
  };
}

module.exports = {
  buildChart,
  parseBirthDateTime,
  normalizeGender,
  normalizeTimezone,
  summarizePalace,
  palaceOneLine,
  normalizeTargetDate,
};
