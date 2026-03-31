# 16 - context 模块源码分析

> 路径: `src/context/`
> 功能: 上下文收集 — git 状态、CLAUDE.md、环境信息注入系统提示

---

## 模块概述

`context/` 负责收集对话所需的各种上下文信息并注入到系统提示中，帮助 AI 理解当前项目环境。所有收集操作都带 memoization 缓存。

---

## 收集的上下文类型

### 1. Git 上下文

```typescript
interface GitContext {
  branch: string           // 当前分支名
  status: string           // 工作区状态（截断到 2000 字符）
  recentCommits: string[]  // 最近 N 条提交
  user: string             // git 用户名
  isRepo: boolean          // 是否在 git 仓库中
  mainBranch: string       // 主分支名（main/master）
}
```

- `git status` 输出截断到 2000 字符，防止大仓库状态溢出
- 最近提交用于 AI 理解项目活跃度和变更方向

### 2. CLAUDE.md 上下文

```
发现路径优先级（从高到低）:
1. 项目根目录/CLAUDE.md          ← 项目级指令
2. 项目根目录/CLAUDE.local.md    ← 本地个人指令（gitignore）
3. 当前目录/CLAUDE.md            ← 子目录级指令
4. 父目录链中的 CLAUDE.md        ← 继承链
5. ~/.claude/CLAUDE.md           ← 全局指令
```

### 3. 环境上下文

```typescript
interface EnvironmentContext {
  platform: string         // darwin / linux / win32
  shell: string            // bash / zsh / fish
  osVersion: string        // Darwin 24.6.0
  cwd: string              // 当前工作目录
  projectRoot: string      // 项目根目录
}
```

---

## 核心函数

```typescript
// 主入口 — 带 memoization 缓存
const gatherContext = memoize(async (): Promise<ConversationContext> => {
  const [git, claudeMd, env] = await Promise.all([
    gatherGitContext(),
    gatherClaudeMdContext(),
    gatherEnvironmentContext(),
  ])
  return { git, claudeMd, env }
})
```

---

## 特性

- **Memoized**: 避免重复收集，同一会话内只收集一次
- **Bare 模式**: 最小上下文，用于轻量级场景
- **显式目录添加**: 支持手动添加额外目录的 CLAUDE.md
- **诊断日志**: 带 PII 过滤的调试日志
- **缓存破坏**: 调试用的缓存破坏注入机制
