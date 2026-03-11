---
name: ziwei-doushu
description: 基于 iztro 的紫微斗数排盘与解读 skill，支持真太阳时换算、区县级出生地解析、地址歧义提示、结构化 JSON 输出与文本报告。适用于用户要求按出生年月日时、性别、出生地生成紫微斗数命盘，或提到紫微斗数、排盘、真太阳时、命盘、十二宫、四化、出生地、区县地址、命理报告时。
---

# ziwei-doushu

先做稳定排盘，再做文案解读。

## 工作流

1. 收集输入：公历日期、时间、性别、出生地。
2. 对中国大陆/港澳台地点，优先收集到区县级；若只有模糊地名，先让脚本尝试解析。
3. 运行脚本获得真太阳时、时辰索引、命盘核心字段、十二宫摘要。
4. 若用户要长报告，再把 JSON 输出与本 skill 的理论参考交给上层模型扩写。

## 调用方式

```bash
node skills/ziwei-doushu/scripts/ziwei.js --date 1990-05-15 --time 14:30 --gender male --place 北京市东城区
```

若地点存在歧义，脚本会直接报错并给候选；补全到区县后重试。

若只有经纬度：

```bash
node skills/ziwei-doushu/scripts/ziwei.js --date 1990-05-15 --time 14:30 --gender male --longitude 116.4074 --latitude 39.9042 --place 北京
```

若要结构化结果供上层模型继续处理：

```bash
node skills/ziwei-doushu/scripts/ziwei.js --date 1990-05-15 --time 14:30 --gender male --place 杭州市余杭区 --json
```

## 资源说明

- 理论速查：`references/ziwei-knowledge.md`
- 地理最小数据集：`../../data/geo/cn-district-min.json`
- 入口脚本：`scripts/ziwei.js`

## 注意事项

- 真太阳时已同时纳入经度修正与时间方程。
- 子时要区分早子时 `timeIndex=0` 与晚子时 `timeIndex=12`，不要自行简化为一个索引。
- 当前地理数据为“全国可运行最小版”，覆盖 34 个省级行政区的代表性区县，并附加部分高频城区；需要更精细覆盖时，按相同字段结构继续扩充数据集。
- 不要重写 iztro 的安星逻辑；工程侧重点应放在输入清洗、时间修正、地理解析、结构化输出和测试。
