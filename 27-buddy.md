# 27 - buddy 模块源码分析

> 路径: `src/buddy/`
> 文件数: 6 个（含 CompanionSprite.tsx）
> 功能: 伴侣系统 — 虚拟宠物彩蛋（teaser 窗口 2026 年 4 月 1-7 日，命令在之后持续可用）

---

## 模块概述

`buddy/` 是一个有趣的彩蛋模块，实现了一个虚拟伴侣（宠物）系统。使用种子随机数生成器确保确定性，基于稀有度的抽卡机制，以及 ASCII 艺术精灵动画。仅在 2026 年 4 月 1-7 日期间激活。

---

## 文件详解

### 1. types.ts — 类型定义

**行数**: 149 行

#### 稀有度权重

```typescript
const RARITY_WEIGHTS = {
  common:    0.60,  // 60% — 普通
  uncommon:  0.25,  // 25% — 不常见
  rare:      0.10,  // 10% — 稀有
  epic:      0.04,  //  4% — 史诗
  legendary: 0.01,  //  1% — 传说
}
```

#### 物种列表

```typescript
// 使用 String.fromCharCode 编码物种名称
// 避免模型代号碰撞（AI 模型可能以动物命名）
const SPECIES = [
  String.fromCharCode(99, 97, 116),        // "cat"
  String.fromCharCode(100, 111, 103),       // "dog"
  String.fromCharCode(102, 111, 120),       // "fox"
  // ... 共 18 种物种
]
```

**设计亮点**: 使用 `String.fromCharCode` 而非字符串字面量，防止代码中出现的动物名称被误认为是 AI 模型代号。

---

### 2. companion.ts — 伴侣生成核心

**行数**: 134 行

#### Mulberry32 伪随机数生成器

```typescript
// 种子确定性 PRNG — 相同种子总是生成相同伴侣
function mulberry32(seed: number): () => number {
  return function() {
    seed |= 0
    seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
```

#### 稀有度抽卡

```typescript
// 累积分布函数抽卡
function rollRarity(rng: () => number): Rarity {
  const roll = rng()
  let cumulative = 0
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    cumulative += weight
    if (roll <= cumulative) return rarity as Rarity
  }
  return 'common' // 兜底
}
```

#### 伴侣生成

```typescript
function generateCompanion(sessionId: string): Companion {
  // 用 sessionId 作为种子 → 同一会话总是同一伴侣
  const seed = hashString(sessionId)
  const rng = mulberry32(seed)

  const rarity = rollRarity(rng)
  const species = SPECIES[Math.floor(rng() * SPECIES.length)]
  const name = generateName(rng)

  return { species, rarity, name, seed }
}
```

---

### 3. sprites.ts — ASCII 艺术精灵

**行数**: 515 行

#### 功能
为 18 种物种提供 ASCII 艺术，每种有 3 帧动画。

#### 精灵格式

```typescript
// 每个精灵: 5 行 × 12 字符宽 × 3 动画帧
type Sprite = {
  frames: [string[], string[], string[]]  // 3 帧
  // 每帧 5 行
}

// 示例 (cat):
const catSprite = {
  frames: [
    // 帧 1
    [
      '  /\\_/\\    ',
      ' ( o.o )   ',
      '  > ^ <    ',
      ' /|   |\\   ',
      '(_|   |_)  ',
    ],
    // 帧 2 (微动)
    [
      '  /\\_/\\    ',
      ' ( o.o )   ',
      '  > ^ <    ',
      ' /|   |\\   ',
      '(_|   |_)  ',
    ],
    // 帧 3
    // ...
  ]
}
```

---

### 4. prompt.ts — 介绍文本

**行数**: 37 行

```typescript
function companionIntroText(companion: Companion): string {
  return `
## 🎉 你获得了一个伴侣！

**${companion.name}** (${companion.species})
稀有度: ${formatRarity(companion.rarity)}

${renderSprite(companion.species, 0)}
  `.trim()
}
```

---

### 5. useBuddyNotification.tsx — React Hook

**行数**: 97 行

#### 功能
React Hook，区分 teaser 窗口和 live 状态：

- `isBuddyTeaserWindow()` — 仅 2026 年 4 月 1-7 日为 true（本地时间，非 UTC）
- `isBuddyLive()` — 2026 年 4 月之后持续为 true

`useBuddyNotification()` 只负责显示 `/buddy` 彩虹文字 teaser 通知（15 秒超时），不负责直接生成 companion 卡片。Companion 的空闲展示和反应由 `CompanionSprite.tsx` 处理。

```typescript
// teaser 窗口: 2026-04-01 到 2026-04-07（本地时间）
export function isBuddyTeaserWindow(): boolean {
  const d = new Date()
  return d.getFullYear() === 2026 && d.getMonth() === 3 && d.getDate() <= 7
}

// live: 2026 年 4 月之后永久生效
export function isBuddyLive(): boolean {
  const d = new Date()
  return d.getFullYear() > 2026 || (d.getFullYear() === 2026 && d.getMonth() >= 3)
}
```

---

### 6. CompanionSprite.tsx — 伴侣精灵组件

React 组件，负责伴侣的空闲展示和动画反应。在 `isBuddyLive()` 为 true 时渲染。

---

## 设计亮点

1. **确定性随机**: Mulberry32 PRNG 确保相同会话总是生成相同伴侣
2. **反碰撞编码**: `String.fromCharCode` 避免动物名称与 AI 模型代号冲突
3. **限时彩蛋**: 仅在愚人节期间激活，不影响正常使用
4. **抽卡机制**: 累积分布函数实现的稀有度系统，1% 传说概率
