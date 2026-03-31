# 25 - vim 模块源码分析

> 路径: `src/vim/`
> 文件数: 5 个
> 功能: Vim 模式 — 终端输入框的 Vim 键绑定支持

---

## 文件详解

### 1. types.ts — Vim 模式类型

```typescript
type VimMode = 'normal' | 'insert' | 'visual' | 'command'

interface VimState {
  mode: VimMode
  cursor: number
  register: string          // 寄存器内容（yank/paste）
  count: number             // 数字前缀（如 3dw）
  pendingOperator: string | null  // 待处理操作符
  visualStart: number       // Visual 模式起始位置
}
```

### 2. motions.ts — 光标移动

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

### 3. operators.ts — 操作符

| 键 | 操作 | 说明 |
|----|------|------|
| `d` | 删除 | `dw` 删除一个词 |
| `c` | 修改 | `cw` 修改一个词（进入 Insert） |
| `y` | 复制 | `yw` 复制一个词 |
| `p` | 粘贴 | 粘贴寄存器内容 |
| `x` | 删除字符 | 删除光标下字符 |

### 4. textObjects.ts — 文本对象

| 键 | 对象 | 说明 |
|----|------|------|
| `iw` | 内部词 | 不含周围空格 |
| `aw` | 一个词 | 含周围空格 |
| `i"` | 引号内 | 双引号内容 |
| `a"` | 含引号 | 含双引号本身 |
| `i(` | 括号内 | 圆括号内容 |
| `a(` | 含括号 | 含圆括号本身 |

### 5. transitions.ts — 模式转换

```
Normal 模式
  ├── i → Insert（光标前）
  ├── a → Insert（光标后）
  ├── o → Insert（新行）
  ├── A → Insert（行尾）
  ├── I → Insert（行首）
  ├── v → Visual
  ├── V → Visual Line
  └── : → Command

Insert 模式
  └── Escape → Normal

Visual 模式
  ├── Escape → Normal
  ├── d/c/y → 执行操作 → Normal
  └── 动作键 → 扩展选择
```

---

## 设计说明

Vim 模式仅作用于 PromptInput 输入框，不影响对话记录的浏览。实现了 Vim 的核心子集，覆盖了日常编辑最常用的操作。
