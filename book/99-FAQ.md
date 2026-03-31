# 快问快答 (FAQ)

## 基础概念

### Q: Claude Code 到底是什么？和 Claude 网页版有什么区别？

Claude Code 是 Anthropic 官方的 CLI 工具，直接在终端里和 Claude 交互，核心区别是它能**直接操作你的文件系统** — 读写文件、执行 Shell 命令、搜索代码，本质上是一个 AI 驱动的编程 Agent，不只是聊天。

### Q: 用什么语言写的？为什么选 TypeScript + Bun？

全部 TypeScript，1884 个文件。选 Bun 而不是 Node 主要是为了：
- 更快的启动速度（CLI 工具对冷启动敏感）
- 内置打包器，不需要额外的 webpack/esbuild
- 原生支持 TypeScript，不需要编译步骤

### Q: 为什么 Fork 了 Ink 而不是直接用 npm 包？

标准 Ink 不够用。Claude Code 需要：
- 鼠标点击支持（hit-test）
- 完整终端协议栈（CSI/SGR/OSC/DEC）
- 声明式光标管理
- 搜索高亮
- 纯 TS 的 Yoga 布局（避免 WASM 加载问题）

这些都不是简单的插件能解决的，所以直接 Fork 了整个框架，改了约 80 个文件。

---

## 架构设计

### Q: main.tsx 4683 行、REPL.tsx 5005 行，为什么不拆分？

这是个好问题。从源码来看：
- **main.tsx** 是编排器，负责初始化所有模块（bootstrap、tools、skills、plugins、bridge、server、coordinator），拆开会导致初始化顺序难以管理
- **REPL.tsx** 是整个交互的状态中心，消息数组、权限请求、文件状态缓存、后台任务全在这里，拆开会导致状态同步问题

本质上是"God Component"反模式，但在 CLI 场景下，状态集中管理比分散管理更实际。

### Q: query.ts 和 query/ 目录是什么关系？

- `query.ts`（根级，1729 行）是**查询主循环**，直接被 REPL.tsx import，负责调用 Claude API、处理流式响应、执行工具
- `query/`（目录）是主循环的**支撑模块**：配置快照（config.ts）、依赖注入（deps.ts）、Token 预算（tokenBudget.ts）、停止钩子（stopHooks.ts）

### Q: hooks/ 和 utils/hooks/ 为什么分成两个？

完全不同的东西：
- `src/hooks/`（104 个文件）— **React Hooks**，给 UI 组件用的（useSearchInput、useTerminalSize 等）
- `src/utils/hooks/`（17 个文件）— **钩子执行引擎**，处理 28 种生命周期事件（Stop、PreToolUse、PostToolUse 等）

前者是 React 的 `useState/useEffect` 那套，后者是 Claude Code 自己的事件系统。

### Q: 工具是怎么注册的？类继承还是工厂模式？

工厂模式。所有 40 个工具都通过 `buildTool(def)` 构建：

```typescript
// src/Tool.ts:783-792
export function buildTool<D>(def: D): BuiltTool<D>
```

传入一个 `ToolDef` 对象（包含 name、description、inputSchema、execute 等），返回 `BuiltTool`。没有基类继承。

### Q: MCP 工具是怎么集成的？

Claude Code 同时是 MCP Client 和 MCP Server：
- 作为 **Client**：启动时动态发现并注册第三方 MCP 工具，和内置工具统一管理
- 作为 **Server**：通过 `entrypoints/mcp.ts` 入口暴露自己的能力给其他 MCP Client

---

## 核心流程

### Q: 用户输入到 AI 回复的完整链路是什么？

```
用户输入 → REPL.tsx 解析
  → import { query } from '../query.js' 直接调用
    → microcompact 消息压缩
    → autocompact 检查（上下文太长时自动压缩）
    → callModel() → services/api → Claude API（流式）
         - 文本 → yield 给 REPL → ink/ 渲染到终端
      - 工具调用 → 权限检查 → 执行 → 结果追加到消息 → 继续循环
    → checkTokenBudget()（连续2次 delta<500 且续传≥3 → 停止）
  → 停止钩子（记忆提取、自动推理、提示建议）
  → 会话持久化
```

### Q: 权限系统怎么工作的？

三级权限：
1. **自动允许** — 只读工具（Read、Glob、Grep）和匹配白名单的命令
2. **需要确认** — 写文件、执行未知命令，弹出权限对话框
3. **沙箱执行** — 在受限环境中运行，网络和文件系统访问受控

权限规则在 `utils/permissions/` 中定义，检查逻辑在 `hooks/useCanUseTool.ts`。

### Q: Token 预算是怎么控制的？

不是硬切断，而是**收益递减检测**：

```typescript
const COMPLETION_THRESHOLD = 0.9    // 90% 预算使用率
const DIMINISHING_THRESHOLD = 500   // 收益递减阈值

// 连续 2 次 delta < 500 tokens 且续传次数 ≥ 3 → 停止
```

也就是说，如果 AI 连续两轮只产出很少的新内容，系统会判断它在"原地打转"，主动停止。

---

## 连接与扩展

### Q: bridge/ 是干什么的？VS Code 扩展怎么和 CLI 通信？

`bridge/` 实现了 IDE 桥接协议。VS Code/JetBrains 扩展通过这个桥接层和 Claude Code CLI 进程通信，实现：
- 文件 diff 同步
- 编辑器内显示 AI 修改
- 共享终端上下文

REPL 不直接 import bridge/，而是通过 `hooks/useReplBridge.tsx` 间接访问。

### Q: 多个 Claude Code 实例怎么协调？

`coordinator/` 模块负责多实例协调，被 main.tsx 在启动时初始化。主要解决：
- 同一项目多个终端窗口的会话隔离
- 文件锁冲突
- 共享状态同步

### Q: 子 Agent 是怎么工作的？

通过 `tools/AgentTool/` 实现。用户或 AI 可以启动子 Agent：

- **general-purpose** — 通用 Agent，拥有所有工具
- **Explore** — 只读代码探索，不能修改文件
- **Plan** — 计划模式，只读分析后输出方案

子 Agent 可以选择在 Git Worktree 中隔离运行，避免影响主工作区。

---

## 有趣的细节

### Q: Task ID 是怎么生成的？

不是 UUID，而是 `randomBytes(8)` + 单字符类型前缀 + 36 字符字母表编码。比 UUID 短很多，在终端显示更友好。

### Q: Buddy 彩蛋是什么？

`src/buddy/` 目录（6 个文件）实现了一个隐藏的伴侣系统：
- `isBuddyTeaserWindow`：2026 年 4 月 1-7 日显示预告
- `isBuddyLive`：2026 年 4 月之后正式上线
- 包含 `CompanionSprite.tsx` 精灵动画组件

看起来是个愚人节彩蛋，但代码写得很认真。

### Q: 为什么用纯 TS 重写 Yoga 布局而不是用 WASM？

`native-ts/yoga-layout/` 是 Meta Yoga 的简化子集移植，不是完整移植。原因：
- 避免 WASM 加载的兼容性问题（不同平台、不同 Node/Bun 版本）
- CLI 场景只需要基础 Flexbox（行/列布局、对齐、padding），不需要完整 CSS 规范
- 纯 TS 更容易调试和定制

### Q: 会话数据存在哪里？

`utils/sessionStorage.ts` 负责持久化，存储在 `~/.claude/` 目录下：
- 会话消息历史
- 会话元数据（标题、时间戳、项目路径）
- 支持跨项目恢复（`crossProjectResume.ts`）
- 自动定时保存

### Q: 快速模式 (Fast Mode) 是什么？

不是切换到更小的模型，而是**同一个模型用更快的输出配置**。通过 `bootstrap/state` 中的 `fastModeEnabled` 标志控制，影响 `query/config.ts` 中的查询参数。
