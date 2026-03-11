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

function applyTrueSolarTime(baseDate, longitude, timezone) {
  const standardMeridian = timezone * 15;
  const longitudeCorrection = 4 * (longitude - standardMeridian);
  const equationOfTime = equationOfTimeMinutes(baseDate);
  const totalOffset = longitudeCorrection + equationOfTime;
  const corrected = new Date(baseDate.getTime() + totalOffset * 60000);

  return {
    corrected,
    standardMeridian,
    longitudeCorrection,
    equationOfTime,
    totalOffset,
  };
}

function getTimeIndex(date) {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  if (totalMinutes < 60) return 0; // 早子时 00:00-00:59
  if (totalMinutes >= 23 * 60) return 12; // 晚子时 23:00-23:59
  return Math.floor((totalMinutes - 60) / 120) + 1;
}

function getTimeBranch(timeIndex) {
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子'];
  return branches[timeIndex] || '未知';
}

module.exports = {
  pad,
  formatDate,
  formatTime,
  equationOfTimeMinutes,
  applyTrueSolarTime,
  getTimeIndex,
  getTimeBranch,
};
