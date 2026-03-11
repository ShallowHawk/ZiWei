function palaceOneLine(palace) {
  const majors = (palace.majorStars || [])
    .map((s) => (typeof s === 'string' ? s : `${s.name}${s.brightness ? `(${s.brightness})` : ''}${s.mutagen ? `[${s.mutagen}]` : ''}`))
    .join('、') || '无主星';
  const minors = (palace.minorStars || [])
    .map((s) => (typeof s === 'string' ? s : s.name))
    .filter(Boolean)
    .join('、');
  return `${palace.name}（${palace.heavenlyStem}${palace.branch || palace.earthlyBranch || ''}）：${majors}${minors ? `；辅星/杂曜：${minors}` : ''}`;
}

function buildTextReport(result) {
  const lines = [];
  lines.push('═══ 紫微斗数排盘结果（iztro）═══');
  lines.push('');
  lines.push('【输入信息】');
  lines.push(`出生地：${result.location.place}`);
  lines.push(`行政区划：${[result.location.province, result.location.city, result.location.district].filter(Boolean).join(' / ') || '自定义坐标'}`);
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
  lines.push('【地址解析】');
  lines.push(`定位来源：${result.location.source}`);
  if (result.location.candidates?.length) {
    lines.push(`候选匹配：${result.location.candidates.map((item) => `${item.fullName}(${item.score})`).join(' / ')}`);
  }
  lines.push('');
  lines.push('【后续解读建议】');
  lines.push('- 先用命宫 + 财帛 + 官禄 + 迁移看三方四正。');
  lines.push('- 再结合四化、夫妻宫、福德宫扩写人生结构。');
  lines.push('- 若要做完整报告，可将本结果作为结构化盘面输入给上层提示词。');
  return lines.join('\n');
}

module.exports = {
  buildTextReport,
};
