#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = 'https://geo.datav.aliyun.com/areas_v3/bound';
const OUT_DIR = path.join(__dirname, '../data/geo');
const OUT_JSON = path.join(OUT_DIR, 'cn-district-full.json');
const OUT_META = path.join(OUT_DIR, 'cn-district-full.meta.json');
const MIN_JSON = path.join(OUT_DIR, 'cn-district-min.json');
const CACHE_DIR = path.join(OUT_DIR, '.cache', 'aliyun-areas-v3');
const CONCURRENCY = Number(process.env.GEO_CONCURRENCY || 4);
const RETRY = Number(process.env.GEO_RETRY || 4);
const REQUEST_DELAY_MS = Number(process.env.GEO_REQUEST_DELAY_MS || 120);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableStatus(status) {
  return [403, 408, 429, 498, 500, 502, 503, 504].includes(Number(status));
}

function safeReadJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function getCachePath(url) {
  const file = crypto.createHash('sha1').update(url).digest('hex');
  return path.join(CACHE_DIR, `${file}.json`);
}

async function fetchJson(url, retry = RETRY) {
  const cachePath = getCachePath(url);
  let lastError;

  for (let i = 0; i <= retry; i += 1) {
    if (i > 0) {
      await sleep((600 * i) + Math.floor(Math.random() * 300));
    }

    try {
      if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
      const res = await fetch(url, {
        headers: {
          'user-agent': 'ZiWei-GeoBuilder/0.2',
          accept: 'application/json',
        },
      });
      if (!res.ok) {
        const error = new Error(`HTTP ${res.status}`);
        error.status = res.status;
        throw error;
      }
      const json = await res.json();
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(json));
      return { json, cache: 'miss' };
    } catch (error) {
      lastError = error;
      const cached = safeReadJson(cachePath);
      if (cached) return { json: cached, cache: 'stale', staleReason: String(error.message || error) };
      if (!isRetriableStatus(error.status) && i >= retry) break;
      if (!isRetriableStatus(error.status) && error.status !== undefined) break;
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

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function composePlace(province, city, district) {
  if (province === city || city === district) return `${province}${district}`;
  return `${province}${city}${district}`;
}

function buildAliases(record) {
  const names = [
    record.district,
    record.city === record.district ? null : `${record.city}${record.district}`,
    `${record.province}${record.district}`,
    record.city === record.district ? null : `${record.province}${record.city}${record.district}`,
  ];
  return unique(names.filter((name) => name && name !== record.place));
}

function normalizeRecord(record, overrides = {}) {
  const province = overrides.province || record.province;
  const city = overrides.city || record.city || province;
  const district = overrides.district || record.district;
  const provinceCode = String(overrides.provinceCode || record.provinceCode || record.code || '').slice(0, 2).padEnd(6, '0');
  const cityCode = String(overrides.cityCode || record.cityCode || provinceCode);
  const districtCode = String(overrides.districtCode || record.districtCode || record.code);
  const longitude = Number(overrides.longitude ?? record.longitude);
  const latitude = Number(overrides.latitude ?? record.latitude);
  const level = overrides.level || record.level || 'district';
  const place = overrides.place || composePlace(province, city, district);
  const aliases = unique([...(record.aliases || []), ...buildAliases({ province, city, district, place })]);

  return {
    code: String(overrides.code || record.code || districtCode),
    province,
    provinceCode,
    city,
    cityCode,
    district,
    districtCode,
    level,
    place,
    aliases,
    longitude,
    latitude,
    source: overrides.source || record.source || 'aliyun-areas-v3',
  };
}

function toDistrictRecord({ province, city, district, source = 'aliyun-areas-v3' }) {
  const [longitude, latitude] = district.center || [];
  return normalizeRecord({
    code: district.code,
    province: province.name,
    provinceCode: province.code,
    city: city.name,
    cityCode: city.code,
    district: district.name,
    districtCode: district.code,
    level: district.level,
    place: composePlace(province.name, city.name, district.name),
    aliases: [],
    longitude,
    latitude,
    source,
  });
}

async function loadChildren(code) {
  return fetchJson(`${BASE_URL}/${code}_full.json`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const minDataset = safeReadJson(MIN_JSON) || [];
  const country = await loadChildren('100000');
  const provinceFeatures = (country.json.features || [])
    .map(normalizeFeature)
    .filter(Boolean)
    .filter((item) => item.level === 'province');

  const stats = {
    provinces: provinceFeatures.length,
    provincesCovered: 0,
    citiesFetched: 0,
    districtRecords: 0,
    fallbackCityAsDistrict: 0,
    patchRecordsMerged: 0,
    cacheHits: 0,
    cacheWrites: 0,
    skipped: [],
  };

  if (country.cache === 'stale') stats.cacheHits += 1;
  else stats.cacheWrites += 1;

  const provinceResults = await mapLimit(provinceFeatures, CONCURRENCY, async (province) => {
    try {
      const provinceData = await loadChildren(province.code);
      if (provinceData.cache === 'stale') stats.cacheHits += 1;
      else stats.cacheWrites += 1;

      const children = (provinceData.json.features || []).map(normalizeFeature).filter(Boolean);
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
          if (cityData.cache === 'stale') stats.cacheHits += 1;
          else stats.cacheWrites += 1;
          const districts = (cityData.json.features || [])
            .map(normalizeFeature)
            .filter(Boolean)
            .filter((item) => item.level === 'district');
          if (districts.length > 0) {
            return districts.map((district) => toDistrictRecord({ province, city, district }));
          }
          if (Number.isFinite(city.center?.[0]) && Number.isFinite(city.center?.[1])) {
            stats.skipped.push({ code: city.code, name: `${province.name}${city.name}`, reason: 'no-district-children-fallback-city-as-district' });
            stats.fallbackCityAsDistrict += 1;
            return [toDistrictRecord({ province, city, district: { ...city, level: 'city-as-district' }, source: 'aliyun-areas-v3:fallback-city-as-district' })];
          }
          stats.skipped.push({ code: city.code, name: `${province.name}${city.name}`, reason: 'no-district-children' });
          return [];
        } catch (error) {
          stats.skipped.push({ code: city.code, name: `${province.name}${city.name}`, reason: String(error.message || error) });
          if (Number.isFinite(city.center?.[0]) && Number.isFinite(city.center?.[1])) {
            stats.fallbackCityAsDistrict += 1;
            return [toDistrictRecord({ province, city, district: { ...city, level: 'city-as-district' }, source: 'aliyun-areas-v3:fallback-city-as-district' })];
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

  const baseRecords = provinceResults.flat().filter((item) => Number.isFinite(item.longitude) && Number.isFinite(item.latitude));
  const merged = new Map(baseRecords.map((item) => [item.code, item]));

  for (const patch of minDataset) {
    const normalizedPatch = normalizeRecord({ ...patch, source: patch.source || 'manual-min-patch' });
    const existing = merged.get(normalizedPatch.code);
    if (!existing) {
      merged.set(normalizedPatch.code, normalizedPatch);
      stats.patchRecordsMerged += 1;
      continue;
    }
    const aliases = unique([...(existing.aliases || []), ...(normalizedPatch.aliases || [])]);
    merged.set(normalizedPatch.code, {
      ...existing,
      aliases,
      source: existing.source === normalizedPatch.source ? existing.source : `${existing.source}+patch`,
    });
  }

  const deduped = Array.from(merged.values())
    .map((item) => normalizeRecord(item))
    .sort((a, b) => a.code.localeCompare(b.code));

  const provinceCoverage = new Set(deduped.map((item) => item.province));
  stats.provincesCovered = provinceCoverage.size;
  stats.districtRecords = deduped.length;

  const meta = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    build: {
      concurrency: CONCURRENCY,
      retry: RETRY,
      requestDelayMs: REQUEST_DELAY_MS,
      cacheDir: path.relative(path.join(__dirname, '..'), CACHE_DIR),
    },
    source: {
      primary: 'https://geo.datav.aliyun.com/areas_v3/bound',
      patch: path.relative(path.join(__dirname, '..'), MIN_JSON),
      note: '主数据来自阿里云 DataV areas_v3；构建时启用磁盘缓存，并合并最小补丁集补足台湾/港澳/高频样例。公开源对台湾省子级覆盖仍不完整。',
    },
    stats,
    coverage: {
      provinceNames: [...provinceCoverage].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      missingProvinceNames: provinceFeatures.map((item) => item.name).filter((name) => !provinceCoverage.has(name)),
    },
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(deduped, null, 2));
  fs.writeFileSync(OUT_META, JSON.stringify(meta, null, 2));

  console.log(`写入 ${path.relative(process.cwd(), OUT_JSON)}`);
  console.log(`记录数: ${deduped.length}`);
  console.log(`覆盖省级: ${stats.provincesCovered}/${stats.provinces}`);
  console.log(`城市降级兜底: ${stats.fallbackCityAsDistrict}`);
  console.log(`补丁并入: ${stats.patchRecordsMerged}`);
  console.log(`跳过项: ${stats.skipped.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
