# 全国区县级离线行政区划 / 经纬度数据方案

## 1. 结论先行

若目标是给紫微斗数排盘做**离线出生地解析 + 真太阳时经度修正**，最实用的免费方案是：

1. **行政区划主键与层级**：以 **国家统计局 / 民政部口径的区划代码** 为准。
2. **经纬度主数据**：以 **阿里云 DataV `areas_v3` GeoJSON 的 `adcode + center`** 为可执行主源。
3. **本地存储**：仓库内先落 **JSON**（简单、零依赖、易被 Skill 直接读取），后续可再派生 **SQLite**。
4. **更新机制**：按“**年度正式更新 + 人工补丁**”维护，不建议每次运行都在线请求。

这套方案适合当前仓库：
- 需要的是**区县级名称 → 经纬度**，不是高精导航。
- 真太阳时计算只需要一个相对可信的出生地经度中心点。
- OpenClaw Skill 更适合读取本地静态文件，而非依赖在线 API。

---

## 2. 可行免费来源对比

### 2.1 阿里云 DataV 行政区划 GeoJSON（当前已接入）

主地址：`https://geo.datav.aliyun.com/areas_v3/bound/`

示例：
- 全国省级：`100000_full.json`
- 浙江省：`330000_full.json`
- 杭州市：`330100_full.json`
- 余杭区：`330110.json`

**优点**
- 免费可访问。
- 自带 `adcode / name / level / parent / center / centroid`。
- `city_full` 可直接拿到下级区县列表。
- 对“出生地字符串解析 → 经度修正”足够实用。
- 可直接离线缓存到仓库。

**缺点**
- 不是官方权威发布渠道。
- 个别地区层级不完整，尤其：
  - 台湾省子级不完整
  - 部分省直辖县级单位 / 兵团师市 / 单列市会出现 `404` 或无下级
- 高频抓取可能触发 `403`，因此必须**离线构建 + 缓存**。

**适合作为什么**
- 当前项目的**经纬度与层级可执行数据源**。

---

### 2.2 国家统计局区划代码（推荐作“官方代码校验源”）

常见数据形态：年度统计用区划代码表。

**优点**
- 区划代码口径权威。
- 适合做 `province_code / city_code / district_code` 的主键标准化。

**缺点**
- 通常不直接附带经纬度。
- 发布形式不如 JSON 友好，抓取清洗成本更高。

**适合作为什么**
- 作为**代码基准源**，用于校验 adcode 和年度变更。

---

### 2.3 民政部行政区划调整公告

**优点**
- 能追踪撤县设区、区划调整、更名等正式变更。

**缺点**
- 偏公告流，不是结构化数据库。
- 不直接提供完整区县级坐标。

**适合作为什么**
- 作为**更新审计来源**，辅助人工修订别名和变更记录。

---

### 2.4 GitHub 开源行政区划库（如 modood 等）

**优点**
- 社区维护，便于快速下载和对照。
- 常含省市区三级 JSON、代码、名称。

**缺点**
- 数据质量依赖维护者。
- 坐标字段通常不齐，不能单独承担真太阳时经度修正。

**适合作为什么**
- **兜底校验源 / 备用层级源**，不建议单独作为唯一生产源。

---

## 3. 本仓库建议的数据架构

### 3.1 最小生产形态

当前建议保留两层：

1. `data/geo/cn-district-min.json`
   - 手工维护的高频出生地最小集
   - 用于测试、演示、关键地区兜底

2. `data/geo/cn-district-full.json`
   - 通过脚本批量生成的全量/准全量离线库
   - 供解析器优先使用

3. `data/geo/cn-district-full.meta.json`
   - 构建时间、来源、记录数、缺失项
   - 便于审计和后续补齐

当前解析器 `src/geo/resolver.js` 已改为：
- 优先读 `cn-district-full.json`
- 自动并入 `cn-district-min.json` 作为兜底

---

### 3.2 推荐记录结构

```json
{
  "code": "330110",
  "province": "浙江省",
  "provinceCode": "330000",
  "city": "杭州市",
  "cityCode": "330100",
  "district": "余杭区",
  "districtCode": "330110",
  "level": "district",
  "place": "浙江省杭州市余杭区",
  "aliases": ["余杭区", "杭州市余杭区", "浙江省余杭区"],
  "longitude": 119.978959,
  "latitude": 30.27365,
  "source": "aliyun-areas-v3"
}
```

### 3.3 字段说明

- `code`：本条记录主键，默认使用区县级 adcode
- `province/city/district`：人类可读名称
- `provinceCode/cityCode/districtCode`：便于层级联查
- `level`：通常为 `district`；少量无下级地区可临时标成 `city-as-district`
- `place`：标准全名
- `aliases`：简称、含省市全称的冗余别名，用于容错匹配
- `longitude/latitude`：出生地中心点坐标，用于真太阳时修正与展示
- `source`：来源标记，方便后续混合数据源

---

## 4. 已落地的可执行脚本

脚本：`scripts/build-cn-admin-db.js`

用途：
- 从阿里云 DataV 递归抓取省 / 市 / 区县层级
- 生成仓库本地离线 JSON
- 输出构建元数据与缺失清单

运行方法：

```bash
node scripts/build-cn-admin-db.js
```

若公开源限流，可降低并发：

```bash
GEO_CONCURRENCY=4 node scripts/build-cn-admin-db.js
```

### 当前构建策略

- `100000_full.json` 获取省级列表
- 对每个省抓取 `${province}_full.json`
- 若子级已是 `district`，直接落库（北京/上海/重庆/港澳等）
- 若子级是 `city`，继续抓取 `${city}_full.json` 获取区县
- 对无下级但有中心点的特殊地级单位，允许降级为 `city-as-district`
- 对明确缺失项写入 `cn-district-full.meta.json`

---

## 5. 当前验证结果与现实问题

### 5.1 已验证可用

已确认阿里云源至少能稳定返回：
- `100000_full.json`（全国省级）
- `330100_full.json`（城市下辖区县）
- `110000_full.json`（直辖市区级）
- `810000_full.json` / `820000_full.json`（港澳）

说明它适合作为**离线构建源**。

### 5.2 已知问题

1. **重复抓取会遇到 `403` 风控**
   - 因此不要在线上实时解析时依赖这个源
   - 正确做法是：构建一次，持久化到仓库

2. **部分地区 `404` / 无下级**
   - 常见于：省直辖县级单位、兵团城市、嘉峪关、东莞、中山等
   - 这些地区要允许“城市即解析点”的降级策略

3. **台湾省子级缺失**
   - 如要补齐，需接入第二来源做人工合并

---

## 6. 本地数据库方案

### 6.1 为什么当前先用 JSON

对本项目来说，JSON 有明显优势：

- Node 原生可读，无额外依赖
- Skill / CLI 启动简单
- 适合 Git 版本管理
- 记录量几千条级别，内存读取完全足够

当前这类查询属于：
- 单条出生地模糊解析
- 候选提示
- 少量别名检索

不需要上来就引入重数据库。

---

### 6.2 何时升级 SQLite

若后续要做这些能力，再升级 SQLite 更合适：

- 数十万条别名索引
- 拼音 / 简拼 / 历史地名倒排
- 多来源合并与版本对比
- 区划变更历史追踪
- API 服务化部署

推荐表结构：

```sql
CREATE TABLE admin_division (
  code TEXT PRIMARY KEY,
  province_code TEXT,
  city_code TEXT,
  district_code TEXT,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  level TEXT NOT NULL,
  place TEXT NOT NULL,
  longitude REAL NOT NULL,
  latitude REAL NOT NULL,
  source TEXT NOT NULL,
  version TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE admin_alias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  UNIQUE(code, alias)
);

CREATE INDEX idx_admin_alias_norm ON admin_alias(normalized_alias);
CREATE INDEX idx_admin_place ON admin_division(province, city, district);
```

---

## 7. 更新机制建议

### 7.1 更新节奏

建议采用：

- **年度正式更新**：按统计局年度区划代码校对一次
- **事件驱动补丁**：民政部公告出现重大区划调整时，增量修订
- **业务补丁**：用户频繁输入但匹配差的地名，补 alias

### 7.2 更新流程

1. 拉取阿里云 GeoJSON 构建离线库
2. 对照国家统计局年度代码表检查增删改
3. 生成 `meta.json` 差异清单
4. 人工确认特殊地区（兵团、直辖县级单位、台湾）
5. 更新 `min.json` 高频兜底样本
6. 跑 CLI / resolver 回归测试

### 7.3 版本管理建议

给数据增加版本号，例如：
- `2026.03-datav-v1`
- `2026-annual-nbs-check`

并写入 `meta.json`：

```json
{
  "version": "2026.03-datav-v1",
  "generatedAt": "2026-03-11T11:44:13Z",
  "source": "aliyun-areas-v3",
  "notes": ["台湾省子级待二次补齐"]
}
```

---

## 8. 对紫微斗数业务的直接意义

对本项目，地理库的价值主要有三层：

1. **区县级出生地标准化**
   - 把“余杭”“杭州市余杭区”“浙江杭州余杭”归一到同一条记录

2. **真太阳时修正**
   - 使用 `longitude` 与时区中央经线差值做分钟级修正

3. **歧义处理**
   - 比如“和平区”可提示天津 / 沈阳两个候选，而不是瞎猜

换句话说，本地库不需要做到测绘级精度；它只要做到：
- 行政区划稳定
- 经度可用
- 别名容错合理
- 缺失项可追踪

就已经足够支撑排盘业务。

---

## 9. 下一步建议

### 优先级 P1
- 保留当前脚本，继续把 `cn-district-full.json` 作为主数据方向
- 对 `meta.json` 里的缺失项建立人工补丁表
- 给 resolver 增加更多 alias 规则（简称 / 旧称 / 自治州简称）

### 优先级 P2
- 增加 `scripts/export-cn-admin-sqlite.js`
- 生成 SQLite 版离线库，支持更复杂检索

### 优先级 P3
- 引入国家统计局年度代码表做校验
- 加入历史区划映射（出生年代较早用户会碰到旧地名）

---

## 10. 仓库内相关文件

- 构建脚本：`scripts/build-cn-admin-db.js`
- 当前主数据：`data/geo/cn-district-full.json`
- 构建元数据：`data/geo/cn-district-full.meta.json`
- 高频兜底数据：`data/geo/cn-district-min.json`
- 解析器：`src/geo/resolver.js`

---

## 11. 一句话建议

**用“官方代码口径 + 阿里云 GeoJSON 经纬度 + 本地 JSON/后续 SQLite”的混合方案最稳。**

它免费、可离线、足够支撑区县级出生地解析与真太阳时修正，而且已经能在本仓库里直接落地运行。
