# 25 - vim 模块源码分析

> 路径: `src/vim/`
> 文件数: 5 个
> 总行数: 1513 行
> 功能: Vim 模式 — 终端输入框的 Vim 键绑定支持

---

## 文件详解

### 1. types.ts — Vim 状态类型（199 行）

```typescript
// VimState 是联合类型，只有 INSERT 和 NORMAL 两种模式（大写）
// 不存在 Visual 和 Command 模式
type VimState =
  | { mode: 'INSERT'; insertedText: string }
  | { mode: 'NORMAL'; command: CommandState }

// NORMAL 模式下的命令状态机（11 种状态）
type CommandState =
  | { type: 'idle' }
  | { type: 'count'; digits: string }
  | { type: 'operator'; op: Operator; count: number }
  | { type: 'operatorCount'; op: Operator; count: number; digits: string }
  | { type: 'operatorFind'; op: Operator; count: number; find: FindType }
  | { type: 'operatorTextObj'; op: Operator; count: number; scope: TextObjScope }
  | { type: 'find'; find: FindType; count: number }
  | { type: 'g'; count: number }
  | { type: 'operatorG'; op: Operator; count: number }
  | { type: 'replace'; count: number }
  | { type: 'indent'; dir: '>' | '<'; count: number }

// 持久状态（跨命令保持）
type PersistentState = {
  lastChange: RecordedChange | null  // dot-repeat 记录
  lastFind: { type: FindType; char: string } | null
  register: string                    // 寄存器内容
  registerIsLinewise: boolean
}

function createInitialVimState(): VimState {
  return { mode: 'INSERT', insertedText: '' }
}
```

### 2. motions.ts — 光标移动（82 行）

| 键 | 动作 | 说明 |
|----|------|------|
| `h` | 左移 | 字符级 |
| `l` | 右移 | 字符级 |
| `w` | 下一个词首 | 词级 |
| `b` | 上一个词首 | 词级 |
| `e` | 当前词尾 | 词级 |
| `0` | 行首 | 行级 |
| `$` | 行尾 | 行级 |
| `^` | 首个非空字符 | 行级 |
| `gg` | 文档开头 | 文档级 |
| `G` | 文档末尾 | 文档级 |

### 3. operators.ts — 操作符（556 行）

| 键 | 操作 | 说明 |
|----|------|------|
| `d` | 删除 | `dw` 删除一个词 |
| `c` | 修改 | `cw` 修改一个词（进入 INSERT） |
| `y` | 复制 | `yw` 复制一个词 |
| `p` | 粘贴 | 粘贴寄存器内容 |
| `x` | 删除字符 | 删除光标下字符 |

### 4. textObjects.ts — 文本对象（186 行）

| 键 | 对象 | 说明 |
|----|------|------|
| `iw` | 内部词 | 不含周围空格 |
| `aw` | 一个词 | 含周围空格 |
| `i"` | 引号内 | 双引号内容 |
| `a"` | 含引号 | 含双引号本身 |
| `i(` | 括号内 | 圆括号内容 |
| `a(` | 含括号 | 含圆括号本身 |

### 5. transitions.ts — 状态转换（490 行）

这是一个完整的状态机实现，处理 NORMAL 模式下 11 种 CommandState 之间的转换。

```
INSERT 模式
  └── Escape → NORMAL (idle)

NORMAL 模式 (CommandState 状态机)
  idle
    ├── i/a/o/A/I/O/s/S/C → INSERT
    ├── 数字 → count
    ├── d/c/y → operator
    ├── f/F/t/T → find
    ├── g → g
    ├── r → replace
    ├── >/<  → indent
    └── h/l/w/b/e/0/$... → 执行 motion

  count
    ├── 数字 → count (追加)
    └── 操作符/motion → 带 count 执行

  operator
    ├── 数字 → operatorCount
    ├── f/F/t/T → operatorFind
    ├── i/a → operatorTextObj
    ├── g → operatorG
    └── motion → 执行 operator+motion
```

> 注意：不存在 Visual 模式和 Command 模式。Vim 实现仅覆盖 INSERT 和 NORMAL 两种模式。

---

## 设计说明

- Vim 模式仅作用于 PromptInput 输入框，不影响对话记录的浏览
- 使用 discriminated union 实现类型安全的状态机
- CommandState 的 11 种状态确保了 TypeScript 的穷举检查
- PersistentState 支持 dot-repeat（`.` 重复上次操作）和寄存器
- 初始状态为 INSERT 模式（与传统 Vim 不同，因为终端输入框默认需要输入）
