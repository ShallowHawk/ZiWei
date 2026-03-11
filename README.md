# ZiWei

一个可本地运行的紫微斗数排盘原型，面向 OpenClaw skill 集成场景。

它基于 `iztro` 提供排盘能力，补上了更适合 Agent 工作流的工程层能力：

- 按中国区县级出生地解析经纬度
- 处理地名歧义，不默默猜测
- 按真太阳时修正出生时间
- 明确区分早子时 / 晚子时
- 输出可读文本或结构化 JSON
- 提供可重复执行的自动化测试

> 当前定位：**可测试的产品原型 / skill 基座**。
> 它适合做排盘、结构化结果输出和上层解读串联；暂不宣称覆盖全国全量区县数据，也不承诺替代专业命理咨询。
> 更完整的风险边界与限制项见：[`docs/limitations.md`](docs/limitations.md)

---

## 1. 适合用来做什么

这个仓库适合以下场景：

1. 作为命理类 Agent 的后端排盘工具
2. 在对话中收集出生信息后生成标准化命盘 JSON
3. 先稳定排盘，再把结果交给上层模型生成自然语言解读
4. 在本地验证真太阳时、地理解析和 CLI 行为是否可回归

如果你要的是：

- 一个可嵌入 OpenClaw 的 skill 入口
- 一个可脚本化调用的 CLI
- 一个能被测试覆盖的最小工程实现

那这个仓库就是为这件事准备的。

---

## 2. 当前能力边界

已经实现：

- `YYYY-MM-DD + HH:mm + 性别 + 出生地` 的排盘输入流程
- 中国大陆常见区县级地点解析
- 经纬度直传模式
- 地址歧义报错与候选提示
- 真太阳时修正（经度修正 + 时间方程）
- 子时边界修复：
  - `00:00-00:59` → `timeIndex=0`
  - `23:00-23:59` → `timeIndex=12`
- 文本输出与 JSON 输出
- 单元 / 集成 / 回归 / CLI 验收测试

尚未承诺：

- 全国全量区县库覆盖
- 海外任意地点的稳定解析
- 自动生成“完整命理咨询级”长报告
- 多流派可切换的完整理论解释引擎
- Web 服务、鉴权、持久化等产品化后端能力

---

## 3. 仓库结构

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

## 4. 安装

```bash
npm install
```

Node 环境安装完成后即可直接运行 CLI 和测试。

---

## 5. 快速开始

### 5.1 按区县级地点排盘

```bash
npm run chart -- --date 1990-05-15 --time 14:30 --gender male --place 北京市东城区
```

### 5.2 使用经纬度直传

```bash
npm run chart -- --date 1990-05-15 --time 14:30 --gender female --longitude 121.4737 --latitude 31.2304 --place 上海
```

### 5.3 输出 JSON 供上层模型继续处理

```bash
npm run chart -- --date 1988-02-09 --time 23:40 --gender female --place 杭州市余杭区 --json
```

### 5.4 获取大限 / 流年最小结构

```bash
npm run chart -- --date 1990-05-15 --time 14:30 --gender male --place 北京市东城区 --targetDate 2026-03-11 --json
```

这会在 JSON 中额外返回：

- `extensions.mutagen`
- `extensions.decadal`
- `extensions.horoscope.decadal`
- `extensions.horoscope.yearly`

适合把“本命盘 + 大限 + 流年”的最小结构继续交给上层模型扩写。

### 5.5 演示歧义处理

```bash
npm run chart -- --date 1990-05-15 --time 14:30 --gender male --place 和平区
```

当地点无法唯一确定时，脚本会明确报错并给出候选项，方便上层 Agent 继续追问用户，而不是擅自选择一个地点。

---

## 6. 输出内容说明

默认输出为文本报告，包含：

> 注意：文本中的“重点宫位摘要”和“后续解读建议”应视为**供上层继续分析的素材**，不是对婚姻、健康、财富、寿命等事项的确定性结论。

- 输入信息
- 出生地与经纬度
- 真太阳时修正结果
- 命盘核心字段
- 十二宫简表
- 重点宫位摘要
- 后续解读建议

加上 `--json` 后，会输出更适合程序消费的结构化结果，包含：

- `input`
- `location`
- `trueSolar`
- `chart`
- `palaces`
- `highlights`
- `extensions`

其中 `extensions` 用于承接较容易继续演进的增强字段，目前包含：

- `mutagen.byStar`：本命四化的最小结构（星曜、四化、所在宫位）
- `decadal.byPalace`：各宫位对应的大限信息（范围、天干地支、年龄序列）
- `horoscope`：仅当传入 `--targetDate YYYY-MM-DD` 时返回的大限/流年最小结构

这使它比较适合接到 Agent、工作流引擎或上层大模型提示链中。

同时，JSON 中会附带 `usageNotice` 与 `limitations` 字段，用于提醒调用方避免把盘面摘要直接包装成重大事项结论。

---

## 7. 真太阳时与子时边界

当前实现采用：

```text
真太阳时偏移（分钟） = 时间方程 + 4 × (出生地经度 - 时区中央经线)
```

并显式处理子时边界：

- `00:00-00:59` 视为早子时，`timeIndex=0`
- `23:00-23:59` 视为晚子时，`timeIndex=12`

这部分已经纳入自动化测试，避免后续改动把早/晚子时重新合并。

---

## 8. 地理数据策略

当前仓库同时保留两层数据：

- `data/geo/cn-district-min.json`：高频出生地最小兜底集
- `data/geo/cn-district-full.json`：通过脚本批量构建的全量/准全量离线库

可直接执行：

```bash
npm run geo:build
```

构建说明与来源调研见：`docs/geo-data-plan.md`

从可维护性与运行成本角度的评估见：`docs/maintenance-cost.md`

解析器会优先使用 `cn-district-full.json`，并自动合并 `cn-district-min.json` 作为兜底。

每条记录包含：

- `code`
- `province`
- `provinceCode`
- `city`
- `cityCode`
- `district`
- `districtCode`
- `level`
- `place`
- `aliases`
- `longitude`
- `latitude`
- `source`

这套结构既能满足区县级出生地解析，也方便未来升级为 SQLite 或加入别名/历史区划索引。

---

## 9. OpenClaw 集成方式

skill 入口位于：

```text
skills/ziwei-doushu/scripts/ziwei.js
```

推荐接入流程：

1. 收集生日、时间、性别、出生地
2. 出生地尽量追问到区县级；若用户只给了模糊地名，先让脚本尝试解析
3. 调用脚本得到命盘 JSON 或文本结果
4. 若用户需要更长的自然语言报告，再交由上层模型结合提示词扩写

换句话说：

- **本仓库负责稳定排盘和结构化输出**
- **上层模型负责更长篇幅的叙述性解读**

---

## 10. 测试

```bash
npm test
npm run test:cli
```

测试说明与验收口径见：`docs/testing.md`

---

## 11. 免责声明

本项目用于传统命理研究、产品原型验证与娱乐体验。

它不应替代医疗、法律、投资、婚育或其他重大人生决策建议。

若上层 Agent 需要继续扩写解读，请同时遵守 [`docs/limitations.md`](docs/limitations.md) 中的风险约束，避免输出宿命化、恐吓式或确定性判断。