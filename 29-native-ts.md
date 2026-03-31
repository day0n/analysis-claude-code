# 29 - native-ts 模块源码分析

> 路径: `src/native-ts/`
> 文件数: 4 个 .ts 文件（3 个子目录各 1 个 index.ts + 1 个 enums.ts）
> 功能: 纯 TypeScript 原生实现 — 文件索引、Yoga 布局引擎、颜色 Diff

---

## 模块概述

`native-ts/` 包含三个高性能的纯 TypeScript 实现，替代了原本需要原生 C/C++ 绑定的功能。这种设计选择优先考虑可移植性和零依赖安装体验。

---

## 1. file-index/ — 模糊文件搜索引擎

### index.ts (370 行)

#### 功能概述
实现 nucleo 风格的模糊文件搜索，使用位图过滤实现 O(1) 快速拒绝，支持边界/驼峰加分和间隔惩罚。

#### 导出
- `FileIndex` 类

#### 核心算法

```typescript
class FileIndex {
  private files: string[]
  private bitmaps: Uint32Array[]  // 每个文件的字符位图

  constructor(files: string[]) {
    this.files = files
    // 预计算每个文件的字符位图
    this.bitmaps = files.map(f => computeBitmap(f))
  }

  search(query: string, topK: number = 20): SearchResult[] {
    const queryBitmap = computeBitmap(query)

    const results: SearchResult[] = []
    for (let i = 0; i < this.files.length; i++) {
      // Phase 1: 位图快速拒绝 — O(1)
      // 如果查询中的字符不全在文件名中出现，直接跳过
      if ((queryBitmap & ~this.bitmaps[i]) !== 0) continue

      // Phase 2: 融合 indexOf 扫描
      const score = this.computeScore(query, this.files[i])
      if (score > 0) {
        results.push({ file: this.files[i], score })
      }
    }

    // Top-K 堆维护
    return topKHeap(results, topK)
  }
}
```

#### 评分规则

评分语义：**分数越低越好**（lower = better）。分数是 position-in-results / result-count，最佳匹配为 0.0。包含 "test" 的路径有 1.05× 惩罚（上限 1.0），使非测试文件排名略高。

内部使用 nucleo 风格的评分常量：
| 常量 | 值 | 说明 |
|------|-----|------|
| `SCORE_MATCH` | 16 | 基础匹配分 |
| `BONUS_BOUNDARY` | +8 | 单词边界匹配 |
| `BONUS_CAMEL` | +6 | 驼峰位置匹配 |
| `BONUS_CONSECUTIVE` | +4 | 连续字符匹配 |
| `BONUS_FIRST_CHAR` | +8 | 首字符匹配 |
| `PENALTY_GAP_START` | -3 | 间隔惩罚 |

#### 智能大小写

```typescript
// 全小写查询 → 大小写不敏感
// 包含大写 → 大小写敏感
const caseSensitive = query !== query.toLowerCase()
```

---

## 2. color-diff/ — 语法高亮差异

### index.ts (999 行)

#### 功能概述
实现带语法高亮的代码差异显示，使用懒加载的 highlight.js 避免 50MB+ 的包体积。

#### 导出
- `ColorDiff` 类

#### 核心架构

```
ColorDiff
├── 懒加载 highlight.js（避免 50MB 包体积）
├── 词级别差异（word-level diffing）
├── ANSI 颜色渲染
│   ├── truecolor 模式（24-bit）
│   ├── color256 模式（8-bit）
│   └── ansi 模式（16 色）
└── 行级别 + 词级别混合差异
```

#### 懒加载策略

```typescript
class ColorDiff {
  private hljs: HighlightJS | null = null

  private async getHighlighter(): Promise<HighlightJS> {
    if (!this.hljs) {
      // 动态导入，避免启动时加载 50MB+
      const { default: hljs } = await import('highlight.js')
      this.hljs = hljs
    }
    return this.hljs
  }
}
```

#### 词级别差异

```typescript
// 不是简单的行级别 diff，而是在行内进一步做词级别 diff
// 这样可以精确高亮行内的具体变更
function wordDiff(oldLine: string, newLine: string): DiffSegment[] {
  const oldWords = tokenize(oldLine)
  const newWords = tokenize(newLine)
  return computeLCS(oldWords, newWords) // 最长公共子序列
}
```

---

## 3. yoga-layout/ — Flexbox 布局引擎

### enums.ts (134 行)

#### 功能概述
定义 Yoga 布局引擎的枚举常量，使用 `const` 对象而非 TypeScript `enum` 以支持 tree-shaking。

```typescript
// 使用 const 对象而非 enum，支持 tree-shaking
export const Align = {
  Auto: 0,
  FlexStart: 1,
  Center: 2,
  FlexEnd: 3,
  Stretch: 4,
  Baseline: 5,
  SpaceBetween: 6,
  SpaceAround: 7,
  SpaceEvenly: 8,
} as const

export const Edge = {
  Left: 0,
  Top: 1,
  Right: 2,
  Bottom: 3,
  Start: 4,
  End: 5,
  Horizontal: 6,
  Vertical: 7,
  All: 8,
} as const

export const FlexDirection = {
  Column: 0,
  ColumnReverse: 1,
  Row: 2,
  RowReverse: 3,
} as const

// Display, Justify, Overflow, Position, Wrap 等...
```

### index.ts (2578 行)

#### 功能概述
Yoga Flexbox 布局引擎的**简化 TypeScript 移植**，覆盖 Ink 实际使用的子集，不是完整的 Meta Yoga 全量移植。源码注释明确说明："simplified single-pass flexbox implementation that covers the subset of features Ink actually uses"。

#### 核心特性

```typescript
class Node {
  // 脏标志系统 — 只重新计算变更的节点
  private isDirty: boolean = true

  // 4 条目布局缓存 — 避免重复计算
  private layoutCache: LayoutCache = new Array(4)

  // 9 边模型折叠为 4 物理边
  // Edge: Left, Top, Right, Bottom, Start, End, Horizontal, Vertical, All
  // → 物理: left, top, right, bottom
  private resolveEdge(edge: Edge): PhysicalEdge

  // Flexbox 布局计算
  calculateLayout(
    availableWidth: number,
    availableHeight: number,
    direction: Direction
  void
}
```

#### Value 类型

```typescript
type Value = {
  value: number
  unit: 'point' | 'percent' | 'auto' | 'undefined'
}

function resolveValue(value: Value, parentSize: number): number {
  switch (value.unit) {
    case 'point': return value.value
    case 'percent': return value.value / 100 * parentSize
    case 'auto': return NaN  // 由布局算法决定
    case 'undefined': return NaN
  }
}
```

#### 布局算法核心

```
calculateLayout(node, availableWidth, availableHeight)
  │
  ├── 检查缓存（4 条目）
  │   └── 命中 → 直接返回
  │
  ├── 解析 margin, padding, border
  │
  ├── 确定主轴和交叉轴
  │   ├── row → 主轴=水平, 交叉轴=垂直
  │   └── column → 主轴=垂直, 交叉轴=水平
  │
  ├── 测量子节点
  │   ├── 固定尺寸子节点 → 直接使用
  │   ├── flex 子节点 → 按 flex-grow/shrink 分配
  │   └── auto 子节点 → 递归计算
  │
  ├── 主轴布局
  │   ├── justify-content 对齐
  │   └── 分配剩余空间
  │
  ├── 交叉轴布局
  │   ├── align-items 对齐
  │   └── align-self 覆盖
  │
  ├── 写入布局结果
  │   ├── left, top, width, height
  │   └── 递归写入子节点
  │
  └── 更新缓存
```

---

## 设计哲学

1. **零原生依赖**: 纯 TypeScript 实现避免了 node-gyp 编译问题和平台兼容性问题
2. **懒加载**: highlight.js 等重依赖按需加载，不影响启动速度
3. **const 对象 vs enum**: 使用 `as const` 对象替代 TypeScript enum，支持 tree-shaking 减小包体积
4. **位图优化**: 文件索引使用位图实现 O(1) 快速拒绝，大幅减少不必要的字符串比较
5. **缓存策略**: Yoga 布局使用 4 条目缓存 + 脏标志，避免重复计算
