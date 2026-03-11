# ZiWei

基于 `iztro` 的紫微斗数 OpenClaw Skill 与可测试排盘工具链。

本次实做重点已经落地：

- 仓库结构重构为 `src/ + data/ + tests/ + docs/ + skills/`
- 修复真太阳时入盘中的**早/晚子时索引问题**
- 落地区县级地理数据最小可运行方案
- 增加地址解析与歧义处理流程
- 保持 OpenClaw skill 入口可直接调用
- 补齐单元 / 集成 / 回归 / CLI 验收测试

---

## 1. 仓库结构

```text
ZiWei/
├── README.md
├── package.json
├── data/
│   └── geo/
│       └── cn-district-min.json
├── docs/
│   └── testing.md
├── src/
│   ├── cli/
│   │   └── ziwei.js
│   ├── core/
│   │   ├── chart.js
│   │   └── true-solar-time.js
│   ├── geo/
│   │   └── resolver.js
│   └── report/
│       └── text.js
├── skills/
│   └── ziwei-doushu/
│       ├── SKILL.md
│       ├── references/
│       │   └── ziwei-knowledge.md
│       └── scripts/
│           └── ziwei.js
└── tests/
    ├── fixtures/
    ├── integration/
    ├── unit/
    └── regression.test.js
```

---

## 2. 安装

```bash
npm install
```

---

## 3. 使用方法

### 3.1 按区县级地点排盘

```bash
npm run chart -- --date 1990-05-15 --time 14:30 --gender male --place 北京市东城区
```

### 3.2 用经纬度直传排盘

```bash
npm run chart -- --date 1990-05-15 --time 14:30 --gender female --longitude 121.4737 --latitude 31.2304 --place 上海
```

### 3.3 输出 JSON

```bash
npm run chart -- --date 1988-02-09 --time 23:40 --gender female --place 杭州市余杭区 --json
```

### 3.4 演示地址歧义处理

```bash
npm run chart -- --date 1990-05-15 --time 14:30 --gender male --place 和平区
```

脚本不会盲猜，而是提示候选行政区，让上层 Agent 继续追问用户补充信息。

---

## 4. 真太阳时修复说明

当前脚本使用：

```text
真太阳时偏移（分钟） = 时间方程 + 4 × (出生地经度 - 时区中央经线)
```

并且已修复子时边界：

- `00:00-00:59` → `timeIndex=0`（早子时）
- `23:00-23:59` → `timeIndex=12`（晚子时）

这比旧实现把全部子时混成一个索引更符合 `iztro` 的入参要求。

---

## 5. 区县级地理数据方案

### 5.1 当前已落地的最小可运行版

文件：`data/geo/cn-district-min.json`

特点：

- 覆盖全国 34 个省级行政区的代表性区县
- 附加部分高频出生地：东城、黄浦、渝中、吴江、余杭、宝安等
- 每条数据包含：`code / province / city / district / aliases / longitude / latitude`
- 支持别名匹配、模糊匹配、歧义报错

### 5.2 扩展方案

后续可用同字段结构追加完整区县数据：

1. 引入国家统计局或民政部标准区划码
2. 生成全量 JSON/SQLite 数据源
3. 增加拼音、旧称、简称别名索引
4. 接入地理编码 API 做在线补齐与缓存
5. 将歧义处理升级为“候选 + 置信度 + 上层追问模板”

---

## 6. OpenClaw skill 工作流

skill 入口保持在：

```text
skills/ziwei-doushu/scripts/ziwei.js
```

推荐上层工作流：

1. 收集生日、时间、性别、出生地
2. 若出生地不够精确，要求补充到区县级
3. 调用脚本得到结构化命盘
4. 若用户需要详细报告，再将 JSON 结果交给大模型扩写

---

## 7. 测试

```bash
npm test
npm run test:cli
```

测试详情见：`docs/testing.md`

---

## 8. 免责声明

本项目用于传统命理研究、产品原型和娱乐体验，不应替代医疗、法律、投资或人生重大决策建议。
