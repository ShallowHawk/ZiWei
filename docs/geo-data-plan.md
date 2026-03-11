# 全国区县级离线行政区划 / 经纬度数据方案

## 1. 当前结论

围绕紫微斗数排盘的**出生地解析 + 真太阳时经度修正**，当前仓库已经形成一套可落地的离线方案：

1. **主源**：阿里云 DataV `areas_v3` GeoJSON（`adcode + center`）
2. **补丁源**：`data/geo/cn-district-min.json` 里的人工样例 / 高频兜底
3. **产物**：
   - `data/geo/cn-district-full.json`
   - `data/geo/cn-district-full.meta.json`
4. **构建方式**：`node scripts/build-cn-admin-db.js`
5. **运行时策略**：`src/geo/resolver.js` 优先读 full，再并入 min 做兜底

这套方案已经足以支撑：
- 区县级出生地标准化
- 真太阳时经度修正
- 常见歧义地点提示
- 离线运行，不依赖实时公网查询

---

## 2. 当前数据质量结论（2026-03-11 第三轮）

最新构建结果：

- `schemaVersion`: **2**
- `districtRecords`: **2875**
- `provincesCovered`: **34 / 34**
- `fallbackCityAsDistrict`: **34**
- `patchRecordsMerged`: **1**

相较前一版：
- 记录数由 **1159 → 2875**
- 覆盖省级由 **16 → 34**
- 从“大面积 403/498 导致半残缺”提升为“全国基本可用 + 特殊城市降级兜底 + 台湾仍待补强”

### 2.1 已覆盖情况

当前 full 库已覆盖：
- 31 个省级行政区主体
- 香港、澳门
- 台湾省（目前仅靠补丁样例兜底，不是完整子级）
- 东莞、中山、嘉峪关、兵团师市等无区县子级返回的城市级兜底点

### 2.2 仍存在的结构性缺口

主要缺口集中在两类：

1. **公开源返回 403/404 的特殊地级/县级单位**
   - 如：济源、仙桃、潜江、天门、神农架
   - 东莞、中山
   - 海南省直辖县级单位
   - 新疆兵团师市
   - 嘉峪关

2. **台湾省子级不完整**
   - 阿里云 DataV 对 `710000_full.json` 当前不可用
   - 现仅通过 `cn-district-min.json` 保留极少量人工补丁样例

### 2.3 对业务的实际影响

对紫微斗数排盘来说，当前缺口的业务影响是**可控的**：

- 对大多数大陆区县出生地：已可直接解析
- 对特殊直管市 / 兵团城市：可退化到“城市即解析点”
- 对台湾：仅少量样例可用，若用户输入更多台湾区县，仍需要继续补齐

换言之：
- **大陆主流程已基本可用**
- **特殊地区可兜底但精细度有限**
- **台湾仍是明确待补项**

---

## 3. 当前构建脚本能力

脚本：`scripts/build-cn-admin-db.js`

### 3.1 已实现能力

当前脚本已支持：

- 递归抓取省 / 市 / 区县层级
- 自动识别直辖市、港澳等“省级即区级”结构
- 对无下级但有中心点的城市，降级写入 `city-as-district`
- 合并 `cn-district-min.json` 里的人工补丁
- 生成 `cn-district-full.meta.json`
- 使用**本地磁盘缓存**降低重复抓取风控
- 在网络失败时优先回退旧缓存，增强可重复构建性

### 3.2 关键环境变量

```bash
GEO_CONCURRENCY=4
GEO_RETRY=4
GEO_REQUEST_DELAY_MS=120
```

### 3.3 运行方式

```bash
node scripts/build-cn-admin-db.js
```

如需更保守：

```bash
GEO_CONCURRENCY=1 GEO_REQUEST_DELAY_MS=300 node scripts/build-cn-admin-db.js
```

---

## 4. 数据结构说明

单条记录当前形态：

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
  "longitude": 120.29986,
  "latitude": 30.419891,
  "source": "aliyun-areas-v3"
}
```

特殊降级记录示例：

```json
{
  "code": "441900",
  "province": "广东省",
  "city": "东莞市",
  "district": "东莞市",
  "level": "city-as-district",
  "place": "广东省东莞市",
  "source": "aliyun-areas-v3:fallback-city-as-district"
}
```

---

## 5. 当前元数据含义

`data/geo/cn-district-full.meta.json` 目前包含：

- `schemaVersion`
- `generatedAt`
- `build.concurrency / retry / requestDelayMs / cacheDir`
- `source.primary / patch / note`
- `stats`
  - `provinces`
  - `provincesCovered`
  - `citiesFetched`
  - `districtRecords`
  - `fallbackCityAsDistrict`
  - `patchRecordsMerged`
  - `cacheHits`
  - `cacheWrites`
  - `skipped`
- `coverage.provinceNames`
- `coverage.missingProvinceNames`

这使得后续可以更方便地回答：
- 本次构建到底覆盖了多少省
- 有多少条是降级兜底
- 有多少条来自人工补丁
- 哪些地区仍需人工介入
- 构建过程中缓存是否生效

---

## 6. 公开源现实问题与应对

### 6.1 现实问题

阿里云公开源并不是“稳定官方 API”，因此会遇到：

- 403 / 498 风控
- 某些地区长期 404
- 台湾子级结构不完整
- 相同脚本多次高并发运行后成功率下降

### 6.2 当前应对策略

已采用以下做法：

1. **降低默认并发**（从 12 降为 4）
2. **增加重试 + 退避**
3. **增加请求间隔**
4. **启用本地缓存**
5. **失败时回退 stale cache**
6. **对特殊城市做 city-as-district 降级**
7. **把 min 数据作为人工补丁源并入 full**

这让 full 数据的可重复构建性明显提升。

---

## 7. 对 resolver 的意义

当前 `src/geo/resolver.js` 的收益：

- full 数据变完整后，绝大多数查询不再依赖 min 样例
- `和平区` 这类歧义地名仍可正确抛出候选提示
- `吴江`、`余杭` 等高频简称仍能通过 alias 命中
- 特殊城市可至少定位到城市中心点

因此，当前地理层已经从“演示级”接近“可生产使用的离线底座”。

---

## 8. 下一步建议

### P1：继续补齐缺口

优先补：
- 台湾省各市区县
- 海南省直辖县级单位
- 新疆兵团师市
- 济源 / 仙桃 / 潜江 / 天门 / 神农架
- 东莞 / 中山 / 嘉峪关 等特殊城市的更细粒度别名

建议做法：
- 新增一个显式的人工补丁文件，例如 `data/geo/cn-district-patch.json`
- 与 `min.json` 分工：
  - `min.json` 负责高频样例
  - `patch.json` 负责结构性补洞

### P2：引入官方代码校验

可接入国家统计局年度区划代码表，用于：
- 检查 adcode 是否存在变化
- 审计撤县设区 / 更名 / 升格
- 识别公开源是否存在漏项

### P3：增加专项质量检查脚本

建议后续增加：

```bash
node scripts/check-cn-admin-quality.js
```

输出例如：
- 省覆盖率
- 每省记录数
- fallback 记录清单
- patch 记录清单
- 可疑重复项 / 坐标缺失项

### P4：后续导出 SQLite

若后续要做：
- 拼音搜索
- 历史地名映射
- 复杂别名倒排
- API 服务化

再增加 SQLite 派生产物会更合适。

---

## 9. 仓库相关文件

- 构建脚本：`scripts/build-cn-admin-db.js`
- 主数据：`data/geo/cn-district-full.json`
- 构建元数据：`data/geo/cn-district-full.meta.json`
- 高频/补丁兜底：`data/geo/cn-district-min.json`
- 解析器：`src/geo/resolver.js`
- 测试：`tests/unit/geo-resolver.test.js`

---

## 10. 一句话结论

**当前全国区县地理库已从“半残缺试验版”提升到“大陆基本可用、特殊地区可降级、台湾待继续补强”的离线可用版本；构建脚本也已具备缓存、重试、兜底与元数据审计能力。**
