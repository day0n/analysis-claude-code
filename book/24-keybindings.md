# 24 - keybindings 模块源码分析

> 路径: `src/keybindings/`
> 文件数: 14 个
> 功能: 快捷键系统 — 上下文感知的键盘绑定管理

---

## 模块概述

`keybindings/` 实现了一套完整的键盘快捷键系统，支持 17 种上下文、72+ 种动作、和弦序列（chord）、平台特定处理和用户自定义。

---

## 架构总览

```
┌─────────────────────────────────────────────┐
│              快捷键系统架构                    │
├─────────────────────────────────────────────┤
│                                             │
│  用户输入 (按键事件)                          │
│       ↓                                     │
│  KeybindingProviderSetup.tsx (React 组件)    │
│       ↓                                     │
│  resolver.ts (纯函数解析器)                   │
│       ├── 和弦状态管理                        │
│       ├── Escape 取消                        │
│       └── 上下文匹配                         │
│       ↓                                     │
│  match.ts (匹配逻辑)                         │
│       ├── Alt/Meta 等价处理                   │
│       └── Escape 键特殊处理                   │
│       ↓                                     │
│  defaultBindings.ts + loadUserBindings.ts    │
│       ├── 默认绑定                            │
│       ├── 用户自定义 (~/.claude/keybindings.json) │
│       └── 合并策略                            │
│       ↓                                     │
│  useKeybinding.ts (React Hook)              │
│       └── 注册到处理器 Map                    │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 核心文件详解

### 1. schema.ts — Schema 定义

**行数**: 237 行

#### 导出
- `KEYBINDING_CONTEXTS` — 19 种上下文
- `KEYBINDING_ACTIONS` — 72+ 种动作
- Zod Schema 定义

#### 上下文列表（17 个）

| 上下文 | 说明 |
|--------|------|
| Global | 全局 |
| Chat | 聊天输入 |
| Autocomplete | 自动补全 |
| Confirmation | 确认对话框 |
| Help | 帮助页面 |
| Transcript | 对话记录 |
| HistorySearch | 历史搜索 |
| Task | 任务管理 |
| ThemePicker | 主题选择器 |
| Settings | 设置页面 |
| Tabs | 标签页 |
| Attachments | 附件管理 |
| Footer | 底部栏 |
| MessageSelector | 消息选择器 |
| DiffDialog | Diff 对话框 |
| ModelPicker | 模型选择器 |
| Select | 选择列表 |
| Plugin | 插件管理 |

注意：源码中**没有** `Permission` 和 `Voice` 这两个 context（语音按键绑定通过 `voice:pushToTalk` action 在其他 context 中处理）。

#### 动作分类

```typescript
// 应用级动作
'app:quit', 'app:help', 'app:settings', 'app:theme'

// 聊天动作
'chat:submit', 'chat:newline', 'chat:clear', 'chat:interrupt'
'chat:paste-image', 'chat:history-prev', 'chat:history-next'

// 自动补全动作
'autocomplete:accept', 'autocomplete:dismiss'

// 确认动作
'confirmation:yes', 'confirmation:no', 'confirmation:always'

// 标签页动作
'tabs:next', 'tabs:prev', 'tabs:close'

// 对话记录动作
'transcript:scroll-up', 'transcript:scroll-down'
'transcript:page-up', 'transcript:page-down'
'transcript:top', 'transcript:bottom'

// 更多...
```

---

### 2. parser.ts — 按键解析器

**行数**: 204 行

#### 功能
解析按键字符串（如 `ctrl+shif化对象，处理修饰键别名和平台特定显示。

#### 修饰键别名

```typescript
const MODIFIER_ALIASES = {
  'ctrl': 'ctrl',
  'control': 'ctrl',
  'cmd': 'meta',
  'command': 'meta',
  'win': 'meta',
  'super': 'meta',
  'alt': 'alt',
  'option': 'alt',
  'shift': 'shift',
}
```

#### 平台显示

```typescript
// macOS: ⌘⇧K
// Windows/Linux: Ctrl+Shift+K
function formatKeystroke(keystroke: Keystroke, platform: Platform): string
```

---

### 3. defaultBindings.ts — 默认绑定

**行数**: 341 行

#### 功能
定义所有默认快捷键绑定，包含平台特定处理。

#### 平台特定绑定

```typescript
// 图片粘贴键
const IMAGE_PASTE_KEY = process.platform === 'darwin'
  ? 'cmd+v'      // macOS
  : 'ctrl+shift+v' // Windows/Linux

// Windows Terminal VT 模式检测
if (isWindowsTerminalVTMode()) {
  // 调整某些绑定以适应 VT 模式
}
```

#### Feature Flag 集成
某些绑定受 feature flag 控制，仅在特定条件下启用。

---

### 4. reservedShortcuts.ts — 保留快捷键

**行数**: 128 行

#### 不可重绑定的快捷键

```typescript
const NON_REBINDABLE = new Set([
  'ctrl+c',  // 中断/复制
  'ctrl+d',  // EOF
  'ctrl+m',  // 回车等价
])
```

#### 终端保留

```typescript
const TERMINAL_RESERVED = new Set([
  'ctrl+z',   // 挂起
  'ctrl+\\',  // SIGQUIT
])
```

#### macOS 保留

```typescript
const MACOS_RESERVED = new Set([
  'cmd+c',    // 复制
  'cmd+v',    // 粘贴
  'cmd+x',    // 剪切
  'cmd+q',    // 退出
  'cmd+w',    // 关闭窗口
  'cmd+tab',  // 切换应用
  'cmd+space', // Spotlight
])
```

---

### 5. match.ts — 匹配逻辑

**行数**: 121 行

#### 功能
将 Ink 输入事件与快捷键定义进行匹配。

#### 特殊处理

```typescript
// Alt 和 Meta 等价处理
// 在某些终端中 Alt 和 Meta 是同一个键
if (binding.alt && event.meta) return true
if (binding.meta && event.alt) return true

// Escape 键特殊处理
// Escape 可能是 Alt 前缀的一部分
if (event.key === 'escape' && !binding.escape) {
  // 等待下一个按键判断是否是 Alt 组合
}
```

---

### 6. resolver.ts — 纯函数解析器

**行数**: 245 行

#### 功能
纯函数实现的快捷键解析，管理和弦状态和 Escape 取消。

#### 和弦序列

```typescript
// 和弦示例: ctrl+k ctrl+s
// 第一次按 ctrl+k → 进入和弦等待状态
// 第二次按 ctrl+s → 匹配完成，执行动作
// 按 Escape → 取消和弦

type ChordState = {
  firstKeystroke: Keystroke
  timestamp: number
  timeout: number  // 1000ms 超时
}
```

---

### 7. loadUserBindings.ts — 用户自定义加载

**行数**: 473 行

#### 功能
从 `~/.claude/keybindings.json` 加载用户自定义绑定，支持热重载。

#### 文件监听

```typescript
// 使用 chokidar 监听文件变化
const watcher = chokidar.watch(keybindingsPath, {
  persistent: true,
  ignoreInitial: true,
})

watcher.on('change', () => {
  // 重新加载并合并绑定
  reloadBindings()
})
```

#### 合并策略

```typescript
// 用户绑定覆盖默认绑定
// 如果用户绑定作，替换默认绑定
// 如果用户绑定了一个新的动作，追加
function mergeBindings(defaults, userBindings) {
  const merged = new Map(defaults)
  for (const [action, binding] of userBindings) {
    merged.set(action, binding) // 覆盖或追加
  }
  return merged
}
```

---

### 8. validate.ts — 验证系统

**行数**: 499 行

#### 功能
全面验证用户自定义绑定的合法性。

#### 验证项目

| 验证 | 说明 |
|------|------|
| 上下文名称 | 必须是 19 种合法上下文之一 |
| 动作格式 | 必须匹配 `context:action` 格式 |
| 按键语法 | 修饰键 + 键名的合法组合 |
| 命令绑定 | 正则验证命令绑定格式 |
| 重复检测 | 同一上下文中的重复绑定警告 |
| 保留键检测 | 不可重绑定的快捷键警告 |
| voice:pushToTalk | 特殊处理语音按键绑定 |

---

### 9. useKeybinding.ts — React Hook

**行数**: 197 行

#### 功能
React Hook，支持和弦序列和 `stopImmediatePropagation` 事件控制。

```typescript
function useKeybinding(
  context: KeybindingContext,
  action: KeybindingAction,
  handler: () => void,
  options?: { enabled?: boolean }
): void {
  // 注册到处理器 Map
  // 支持和弦序列
  // stopImmediatePropagation 防止事件冒泡
}
```

---

### 10. KeybindingProviderSetup.tsx — React 组件

**行数**: 307 行

#### 功能
React 组件，提供快捷键上下文、热重载和和弦拦截。

#### 核心结构

```tsx
function KeybindingProviderSetup({ children }) {
  // 处理器注册表 Map
  const handlers = useRef(new Map())

  // 活跃上下文 refs
  const activeContexts = useRef(new Set())

  // 和弦超时: 1000ms
  const CHORD_TIMEOUT = 1000

  return (
    <KeybindingContext.Provider value={{ handlers, activeContexts }}>
      <ChordInterceptor>
        {children}
      </ChordInterceptor>
    </KeybindingContext.Provider>
  )
}
```

#### ChordInterceptor 组件
拦截按键事件，管理和弦状态，在超时后自动取消。

---

### 11. shortcutFormat.ts / useShortcutDisplay.ts

#### shortcutFormat.ts (64 行)
非 React 工具函数，格式化快捷键显示字符串，带回退追踪。

#### useShortcutDisplay.ts (60 行)
React Hook 版本，附带分析日志记录。

---

### 12. template.ts — 模板生成

**行数**: 53 行

生成 `keybindings.json` 模板文件，包含 JSON Schema URL。

```typescript
function generateTemplate(): string {
  return JSringify({
    "$schema": "https://...",
    // 空的绑定模板
  }, null, 2)
}
```

---

## 设计亮点

1. **上下文感知**: 19 种上下文确保快捷键不会在错误的场景触发
2. **和弦支持**: 类似 VS Code 的多键序列（ctrl+k ctrl+s）
3. **平台适配**: macOS/Windows/Linux 各有适当的默认绑定
4. **热重载**: 修改 keybindings.json 后立即生效，无需重启
5. **安全验证**: 全面的验证系统防止无效或危险的绑定
6. **纯函数解析**: resolver 是纯函数，易于测试
