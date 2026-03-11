#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://geo.datav.aliyun.com/areas_v3/bound';
const OUT_DIR = path.join(__dirname, '../data/geo');
const OUT_JSON = path.join(OUT_DIR, 'cn-district-full.json');
const OUT_META = path.join(OUT_DIR, 'cn-district-full.meta.json');
const CONCURRENCY = Number(process.env.GEO_CONCURRENCY || 12);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, retry = 2) {
  let lastError;
  for (let i = 0; i <= retry; i += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': 'ZiWei-GeoBuilder/0.1',
          accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      if (i < retry) await sleep(500 * (i + 1));
    }
  }
  throw lastError;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      results[current] = await mapper(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function isNumericAdcode(value) {
  return /^\d+$/.test(String(value || ''));
}

function normalizeFeature(feature) {
  const p = feature?.properties || {};
  if (!isNumericAdcode(p.adcode) || !p.name) return null;
  return {
    code: String(p.adcode),
    name: p.name,
    level: p.level,
    parentCode: p.parent?.adcode ? String(p.parent.adcode) : null,
    center: Array.isArray(p.center) ? p.center : Array.isArray(p.centroid) ? p.centroid : null,
    childrenNum: Number(p.childrenNum || 0),
  };
}

function buildAliases(record) {
  const names = new Set([record.district]);
  if (record.province === record.city) {
    names.add(`${record.province}${record.district}`);
  } else {
    names.add(`${record.city}${record.district}`);
    names.add(`${record.province}${record.district}`);
    names.add(`${record.province}${record.city}${record.district}`);
  }
  return [...names].filter(Boolean).filter((name) => name !== record.place);
}

function toDistrictRecord({ province, city, district }) {
  const [longitude, latitude] = district.center || [];
  return {
    code: district.code,
    province: province.name,
    provinceCode: province.code,
    city: city.name,
    cityCode: city.code,
    district: district.name,
    districtCode: district.code,
    level: district.level,
    place: province.name === city.name ? `${province.name}${district.name}` : `${province.name}${city.name}${district.name}`,
    aliases: [],
    longitude: Number(longitude),
    latitude: Number(latitude),
    source: 'aliyun-areas-v3',
  };
}

async function loadChildren(code) {
  return fetchJson(`${BASE_URL}/${code}_full.json`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const country = await loadChildren('100000');
  const provinceFeatures = (country.features || [])
    .map(normalizeFeature)
    .filter(Boolean)
    .filter((item) => item.level === 'province');

  const stats = { provinces: provinceFeatures.length, citiesFetched: 0, districtRecords: 0, skipped: [] };
  const provinceResults = await mapLimit(provinceFeatures, CONCURRENCY, async (province) => {
    try {
      const provinceData = await loadChildren(province.code);
      const children = (provinceData.features || []).map(normalizeFeature).filter(Boolean);
      if (children.length === 0) {
        stats.skipped.push({ code: province.code, name: province.name, reason: 'no-children' });
        return [];
      }

      const childLevels = new Set(children.map((item) => item.level));
      if (childLevels.has('district') && !childLevels.has('city')) {
        return children.map((district) => toDistrictRecord({ province, city: { code: province.code, name: province.name }, district }));
      }

      const cityFeatures = children.filter((item) => item.level === 'city');
      stats.citiesFetched += cityFeatures.length;
      const cityResults = await mapLimit(cityFeatures, CONCURRENCY, async (city) => {
        try {
          const cityData = await loadChildren(city.code);
          const districts = (cityData.features || [])
            .map(normalizeFeature)
            .filter(Boolean)
            .filter((item) => item.level === 'district');
          return districts.map((district) => toDistrictRecord({ province, city, district }));
        } catch (error) {
          stats.skipped.push({ code: city.code, name: `${province.name}${city.name}`, reason: String(error.message || error) });
          if (Number.isFinite(city.center?.[0]) && Number.isFinite(city.center?.[1])) {
            return [toDistrictRecord({ province, city, district: { ...city, level: 'city-as-district' } })];
          }
          return [];
        }
      });
      return cityResults.flat();
    } catch (error) {
      stats.skipped.push({ code: province.code, name: province.name, reason: String(error.message || error) });
      return [];
    }
  });

  const deduped = Array.from(new Map(provinceResults.flat().map((item) => [item.code, item])).values())
    .map((item) => ({ ...item, aliases: buildAliases(item) }))
    .sort((a, b) => a.code.localeCompare(b.code));

  stats.districtRecords = deduped.length;

  const meta = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      primary: 'https://geo.datav.aliyun.com/areas_v3/bound',
      note: '公开 GeoJSON 行政区划 adcode + center 点；适合离线行政区划检索和真太阳时经度修正。台湾省子级数据在该源中不完整。',
    },
    stats,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(deduped, null, 2));
  fs.writeFileSync(OUT_META, JSON.stringify(meta, null, 2));

  console.log(`写入 ${path.relative(process.cwd(), OUT_JSON)}`);
  console.log(`记录数: ${deduped.length}`);
  console.log(`跳过项: ${stats.skipped.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
