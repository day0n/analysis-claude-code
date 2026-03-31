# 21 - coordinator 模块源码分析

> 路径: `src/coordinator/`
> 文件数: 1 个
> 行数: 369 行
> 功能: 协调器模式 — 功能标志检测、会话模式匹配和 Worker 上下文构建

---

## 模块概述

`coordinator/` 模块实现的是协调器模式的功能标志和上下文构建，**不是**多会话管理或容量控制系统。核心功能是检测当前是否处于协调器模式，匹配会话模式，以及为 Worker 构建工具上下文和系统提示。

---

## coordinatorMode.ts — 唯一文件

### 核心导出

```typescript
// 检测是否处于协调器模式
function isCoordinatorMode(): boolean {
  if (feature('COORDINATOR_MODE')) {
    return isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE)
  }
  return false
}

// 匹配会话模式（恢复会话时检查模式是否一致）
function matchSessionMode(
  sessionMode: 'coordinator' | 'normal' | undefined
): string | undefined

// 构建 Worker 的用户上下文（工具列表、系统提示等）
function getCoordinatorUserContext(options: {
  scratchpadDir?: string
}): CoordinatorUserContext

// 返回协调器系统提示词
function getCoordinatorSystemPrompt(): string
```

### 设计说明

- 通过 `feature('COORDINATOR_MODE')` 编译时门控 + `CLAUDE_CODE_COORDINATOR_MODE` 环境变量双重控制
- `matchSessionMode()` 在恢复会话时检查当前模式与会话存储的模式是否一致，不一致时翻转环境变量
- Worker 工具上下文定义了 Worker 可用的工具集（排除 TeamCreate/TeamDelete/SendMessage/SyntheticOutput 等内部工具）
- 支持 scratchpad 功能（通过 `tengu_scratch` Statsig 门控）

### 内部常量

```typescript
// Worker 不可用的内部工具
const INTERNAL_WORKER_TOOLS = new Set([
  TEAM_CREATE_TOOL_NAME,
  TEAM_DELETE_TOOL_NAME,
  SEND_MESSAGE_TOOL_NAME,
  SYNTHETIC_OUTPUT_TOOL_NAME,
])
```

---

## 与其他模块的关系

```
coordinator/
├── ← bootstrap/state.ts (isCoordinatorMode 被全局使用)
├── → tools/ (引用工具名常量)
├── → services/analytics/ (Statsig 门控)
└── → constants/tools.ts (ASYNC_AGENT_ALLOWED_TOOLS)
```

> 注意：多会话的 Spawn 模式逻辑在 `bridge/bridgeUI.ts` 中，不在 coordinator 模块。
