# 08 - ink 模块源码分析

> 路径: `src/ink/`
> 文件数: 96 个
> 功能: 深度定制的 Ink 终端渲染引擎

---

## 模块概述

`ink/` 是对 Ink（React 终端 UI 框架）的深度定制版本。Claude Code 没有直接使用 npm 上的 ink 包，而是将其 fork 并大幅扩展，添加了自定义布局引擎、事件系统、终端查询、搜索高亮等功能。

---

## 架构总览

```
ink/
├── 核心渲染
│   ├── ink.tsx              # Ink 主入口 & render()
│   ├── reconciler.ts        # React Reconciler（自定义）
│   ├── renderer.ts          # 渲染管线
│   ├── root.ts              # 根节点管理
│   ├── dom.ts               # 虚拟 DOM 节点
│   └── instances.ts         # 实例管理
│
├── 布局系统
│   ├── layout/
│   │   ├── engine.ts        # 薄包装：createLayoutNode() → createYogaLayoutNode()
│   │   ├── node.ts          # 布局节点
│   │   ├── geometry.ts      # 几何计算
│   │   └── yoga.ts          # Yoga 集成（真正的布局核心，308 行）
│   ├── styles.ts            # 样式处理
│   └── get-max-width.ts     # 最大宽度计算
│
├── 输出管线
│   ├── output.ts            # 输出缓冲
│   ├── render-node-to-output.ts  # 节点→输出
│   ├── render-border.ts     # 边框渲染
│   ├── render-to-screen.ts  # 输出→屏幕
│   ├── frame.ts             # 帧管理
│   └── log-update.ts        # 增量屏幕更新
│
├── 文本处理
│   ├── stringWidth.ts       # 字符串宽度计算
│   ├── wrapAnsi.ts          # ANSI 文本换行
│   ├── widest-line.ts       # 最宽行计算
│   ├── squash-text-nodes.ts # 文本节点合并
│   ├── bidi.ts              # 双向文本支持
│   ├── colorize.ts          # 颜色化
│   └── tabstops.ts          # Tab 停止位
│
├── 事件系统
│   ├── events/
│   │   ├── emitter.ts       # 事件发射器
│   │   ├── dispatcher.ts    # 事件分发器
│   │   ├── event.ts         # 基础事件
│   │   ├── input-event.ts   # 输入事件
│   │   ├── keyboard-event.ts # 键盘事件
│   │   ├── click-event.ts   # 点击事件
│   │   ├── focus-event.ts   # 焦点事件
│   │   └── terminal-event.ts # 终端事件
│   ├── parse-keypress.ts    # 按键解析
│   └── hit-test.ts          # 点击测试
│
├── 终端交互
│   ├── terminal.ts          # 终端抽象
│   ├── terminal-querier.ts  # 终端能力查询
│   ├── terminal-focus-state.ts # 终端焦点状态
│   ├── supports-hyperlinks.ts  # 超链接支持检测
│   └── termio/              # 终端 IO 协议
│       ├── tokenize.ts      # 令牌化
│       ├── parser.ts        # 解析器
│       ├── ansi.ts          # ANSI 序列
│       ├── csi.ts           # CSI 序列
│       ├── sgr.ts           # SGR（颜色/样式）
│       ├── osc.ts           # OSC 序列
│       ├── esc.ts           # ESC 序列
│       ├── dec.ts           # DEC 私有序列
│       └── types.ts         # 类型定义
│
├── 基础组件
│   ├── components/
│   │   ├── Box.tsx          # 盒模型容器
│   │   ├── Text.tsx         # 文本组件
│   │   ├── Spacer.tsx       # 间距组件
│   │   ├── Newline.tsx      # 换行组件
│   │   ├── Link.tsx         # 超链接组件
│   │   ├── Button.tsx       # 按钮组件
│   │   ├── ScrollBox.tsx    # 滚动容器
│   │   ├── NoSelect.tsx     # 不可选择区域
│   │   ├── RawAnsi.tsx      # 原始 ANSI 输出
│   │   ├── AlternateScreen.tsx # 备用屏幕
│   │   ├── ErrorOverview.tsx   # 错误概览
│   │   ├── App.tsx          # 应用根组件
│   │   └── 上下文提供者...
│   └── Ansi.tsx             # ANSI 渲染组件
│
├── Hooks
│   ├── hooks/
│   │   ├── use-input.ts     # 输入处理
│   │   ├── use-stdin.ts     # stdin 访问
│   │   ├── use-app.ts       # 应用上下文
│   │   ├── use-selection.ts # 选择状态
│   │   ├── use-interval.ts  # 定时器
│   │   ├── use-animation-frame.ts # 动画帧
│   │   ├── use-terminal-viewport.ts # 终端视口
│   │   ├── use-terminal-title.ts    # 终端标题
│   │   ├── use-terminal-focus.ts    # 终端焦点
│   │   ├── use-declared-cursor.ts   # 光标声明
│   │   ├── use-tab-status.ts        # Tab 状态
│   │   └── use-search-highlight.ts  # 搜索高亮
│
├── 优化
│   ├── optimizer.ts         # 渲染优化器
│   ├── node-cache.ts        # 节点缓存
│   └── line-width-cache.ts  # 行宽缓存
│
├── 焦点管理
│   ├── focus.ts             # 焦点系统
│   └── selection.ts         # 选择管理
│
├── 搜索
│   └── searchHighlight.ts   # 搜索高亮
│
└── 常量
    ├── constants.ts         # 常量定义
    └── warn.ts              # 警告工具
```

---

## 核心渲染管线
`
React 组件树
    ↓ (reconciler.ts — 自定义 React Reconciler)
虚拟 DOM 树 (dom.ts)
    ↓ (layout/engine.ts — Yoga Flexbox 布局)
布局树（带位置和尺寸）
    ↓ (render-node-to-output.ts)
输出缓冲 (output.ts)
    ↓ (render-border.ts — 边框渲染)
    ↓ (colorize.ts — 颜色化)
    ↓ (render-to-screen.ts)
ANSI 字符串
    ↓ (log-update.ts — 增量更新)
终端屏幕
```

---

## 关键子系统

### 1. 自定义 React Reconciler

```typescript
// reconciler.ts
// 使用 react-reconciler 创建自定义渲染器
// 将 React 组件映射到终端虚拟 DOM 节点
const reconciler = createReconciler({
  createInstance(type, props) {
    return new DOMNode(type, props)
  },
  aToContainer(container, child) {
    container.appendChild(child)
  },
  // ... 完整的 reconciler 接口实现
})
```

### 2. 终端 IO 协议栈 (termio/)

```
原始字节流
    ↓ tokenize.ts (令牌化)
令牌流 (ANSI/CSI/SGR/OSC/ESC/DEC)
    ↓ parser.ts (解析)
结构化事件
    ↓ 分发到对应处理器
```

#### 支持的终端协议
- **ANSI**: 基础控制序列
- **CSI**: 控制序列引入（光标移动、清屏等）
- **SGR**: 选择图形再现（颜色、粗体等）
- **OSC**: 操作系统命令（超链接、标题等）
- **ESC**: 转义序列
- **DEC**: DEC 私有序列（光标样式等）

### 3. 事件系统

```
终端原始输入
    ↓ parse-keypress.ts
键盘事件 (KeyboardEvent)
    ↓ hit-test.ts
点击事件 (ClickEvent) — 如果是鼠标输入
    ↓ dispatcher.ts
事件分发到组件树
    ↓ emitter.ts
组件事件处理器
```

### 4. 焦点管理

```typescript
// focus.ts
// 管理组件焦点状态
// 支持 Tab 导航和程序化焦点切换
class FocusManager {
  focusNext(): void
  focusPrevious(): void
  focus(id: string): void
  blur(): void
}
```

---

## 与标准 Ink 的差异

| 特性 | 标准 Ink | Claude Code Ink |
|------|----------|-----------------|
| 布局引擎 | yoga-wasm | 纯 TS Yoga 移植 |
| 事件系统 | 基础键盘 | 完整事件系统（键盘/鼠标/焦点） |
| 终端协议 | 基础 ANSI | 完整协议栈（CSI/SGR/OSC/DEC） |
| 搜索高亮 | 无 | 内置搜索高亮 |
| 点击测试 | 无 | 支持鼠标点击 |
| 超链接 | 无 | OSC 8 终端超链接 |
| 双向文本 | 无 | BiDi 支持 |
| 渲染优化 | 基础 | 节点缓存 + 行宽缓存 + 优化器 |
| 光标管理 | 基础 | 声明式光标系统 |

---

## 设计亮点

1. **零 WASM 依赖**: 用纯 TS Yoga 替代 yoga-wasm，避免 WASM 加载问题
2. **完整终端协议**: 部能力（超链接、鼠标、焦点追踪）
3. **声明式光标**: 组件声明光标位置，框架自动管理
4. **增量渲染**: log-update 只更新变化的行，减少闪烁
5. **多层缓存**: 节点缓存 + 行宽缓存 + 布局缓存，确保渲染性能
