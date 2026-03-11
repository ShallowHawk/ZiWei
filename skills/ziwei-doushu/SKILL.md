---
name: ziwei-doushu
description: 基于 iztro 的紫微斗数排盘与解读 skill。适用于用户要求按出生年月日时、性别、出生地生成紫微斗数命盘、做真太阳时换算、输出十二宫盘面摘要、并将结构化结果交给大模型扩写报告的场景。用户提到紫微斗数、排盘、真太阳时、命盘、十二宫、四化、出生地、命理报告时使用。
---

# ziwei-doushu

使用此 skill 时，优先把**排盘**和**文案解读**分成两步：

1. 先运行 `scripts/ziwei.js` 得到稳定的盘面和结构化结果
2. 再把盘面结果交给模型写成长报告

## 工作流程

### 1. 收集输入

至少收集：

- 公历日期：`YYYY-MM-DD`
- 时间：`HH:mm`
- 性别：`male` / `female`
- 出生地：优先城市名；没有就经纬度

### 2. 调用脚本

```bash
node skills/ziwei-doushu/scripts/ziwei.js --date 1990-05-15 --time 14:30 --gender male --place 北京
```

如果地名不在内置城市表中，改用：

```bash
node skills/ziwei-doushu/scripts/ziwei.js --date 1990-05-15 --time 14:30 --gender male --longitude 116.4074 --latitude 39.9042 --place 北京
```

若需要结构化结果供后续模型继续处理：

```bash
node skills/ziwei-doushu/scripts/ziwei.js --date 1990-05-15 --time 14:30 --gender male --place 北京 --json
```

## 输出使用建议

脚本输出后：

- 先确认真太阳时修正后的日期、时间、时辰
- 再读取十二宫与重点宫位摘要
- 若用户要完整长报告，再结合用户给定提示词继续生成

## 资源说明

- 门派理论速查：`references/ziwei-knowledge.md`
- 常见城市经纬度：`scripts/cities.json`

## 注意事项

- `iztro` 负责底层排盘，不要自行重写安星逻辑
- 真太阳时修正已包含经度修正和时间方程近似修正
- 当前脚本偏向稳定原型，适合先完成产品 MVP
- 若涉及更细的四化飞星、大限、流年，请在现有结构化输出上继续扩展，而不是把所有逻辑塞进提示词
