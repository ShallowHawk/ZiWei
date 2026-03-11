const fs = require('fs');
const path = require('path');

const fullDatasetPath = path.join(__dirname, '../../data/geo/cn-district-full.json');
const minDatasetPath = path.join(__dirname, '../../data/geo/cn-district-min.json');
const fullDataset = fs.existsSync(fullDatasetPath)
  ? JSON.parse(fs.readFileSync(fullDatasetPath, 'utf8'))
  : [];
const minDataset = JSON.parse(fs.readFileSync(minDatasetPath, 'utf8'));
const dataset = Array.from(new Map([...fullDataset, ...minDataset].map((item) => [item.code, item])).values());

function normalizePlace(input) {
  return String(input || '')
    .trim()
    .replace(/[省市区县自治区特别行政区盟旗镇乡街道县]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function buildNames(item) {
  return [
    item.province,
    item.city,
    item.district,
    `${item.province}${item.city}${item.district}`,
    `${item.city}${item.district}`,
    ...(item.aliases || []),
  ].filter(Boolean);
}

function scoreCandidate(query, item) {
  const normalizedQuery = normalizePlace(query);
  const names = buildNames(item);
  let best = 0;
  for (const name of names) {
    const normalizedName = normalizePlace(name);
    if (normalizedName === normalizedQuery) best = Math.max(best, 100);
    else if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) best = Math.max(best, 80);
    else if (normalizedName.startsWith(normalizedQuery) || normalizedQuery.startsWith(normalizedName)) best = Math.max(best, 70);
  }
  return best;
}

function searchPlace(query) {
  const results = dataset
    .map((item) => ({ item, score: scoreCandidate(query, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code));
  return results;
}

function formatFullName(item) {
  return item.province === item.city
    ? `${item.province}${item.district}`
    : `${item.province}${item.city}${item.district}`;
}

function resolveLocation(input) {
  const place = input.place || '';
  const longitude = input.longitude !== undefined ? Number(input.longitude) : undefined;
  const latitude = input.latitude !== undefined ? Number(input.latitude) : undefined;

  if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
    return {
      matched: true,
      ambiguous: false,
      place: place || '自定义坐标',
      longitude,
      latitude,
      source: 'manual',
      candidates: [],
    };
  }

  if (!place) {
    throw new Error('请提供 --place 或直接提供 --longitude 和 --latitude。');
  }

  const results = searchPlace(place);
  if (results.length === 0) {
    throw new Error(`未找到地点：${place}。请补充到区/县级，例如“杭州市余杭区”，或直接提供经纬度。`);
  }

  const top = results[0];
  const sameTop = results.filter((entry) => entry.score === top.score);
  if (sameTop.length > 1) {
    const exactMatches = sameTop.filter(({ item }) => buildNames(item).some((name) => normalizePlace(name) === normalizePlace(place)));
    if (exactMatches.length !== 1) {
      const candidates = sameTop.slice(0, 5).map(({ item }) => formatFullName(item));
      throw new Error(`地点存在歧义：${place}。候选：${candidates.join(' / ')}。请补充省市区县信息。`);
    }
  }

  const match = top.item;
  return {
    matched: true,
    ambiguous: false,
    place: formatFullName(match),
    province: match.province,
    city: match.city,
    district: match.district,
    code: match.code,
    longitude: match.longitude,
    latitude: match.latitude,
    source: 'dataset',
    candidates: results.slice(0, 5).map(({ item, score }) => ({
      fullName: formatFullName(item),
      code: item.code,
      score,
    })),
  };
}

module.exports = {
  dataset,
  normalizePlace,
  searchPlace,
  resolveLocation,
};
