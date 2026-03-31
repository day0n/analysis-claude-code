# 09 - query 模块源码分析

> 路径: `src/query/`
> 文件数: 5 个
> 功能: 查询执行核心 — 与 Claude API 交互的主循环

---

## 模块概述

`query/` 是 Claude Code 与 AI 模型交互的核心引擎。它管理查询生命周期、token 预算、依赖注入和停止钩子执行。设计上追求纯函数化，便于测试和未来的 step() 提取。

---

## 1. config.ts — 查询配置快照

**行数**: 46 行

### 功能概述
在 `query()` 入口点创建不可变的配置快照，将运行时配置与可变状态分离。

### 导出
- `QueryConfig` 类型 — 配置快照结构
- `buildQueryConfig()` — 工厂函数

### 配置结构

```typescript
type QueryConfig = {
  sessionId: SessionId
  gates: {
    streamingToolExecution: boolean  // gate: tengu_streaming_tool_execution2
    emitToolUseSummaries: boolean
    isAnt: boolean
    fastModeEnabled: boolean         // 字段名是 fastModeEnabled，不是 fastMode
  }
}
```

### 构建逻辑

```typescript
function buildQueryConfig(): QueryConfig {
  return {
    sessionId: getSessionId(),
    gates: {
      // Statsig 特性门控（使用缓存值，可能过期）
      streamingToolExecution: checkStatsigFeatureGate_CACHED_MAY_BE_STALE('streaming_tool_exec'),
      // 环境变量控制
      emitToolUseSummaries: isEnvTruthy('EMIT_TOOL_USE_SUMMARIES'),
      // 内部用户检测
      isAnt: detectIsAnt(),
      // 快速模式（内联检测，避免引入重模块图）
      fastMode: isFastModeEnabled(),
    }
  }
}
```

### 设计亮点
- **不可变快照**: 配置在 query() 入口创建后不再变化，避免中途配置变更导致的不一致
- **刻意排除 feature() 门控**: 为了 tree-shaking 优化，不引入 `bun:bundle` 的 feature() 函数
- **内联检测**: fastMode 检测内联实现，避免引入 heavy module graph

---

## 2. deps.ts — 依赖注入容器

**行数**: 40 行

### 功能概述
为 `query()` 函数提供依赖注入，允许测试时注入 fake 实现而无需 `spyOn`。

### 导出
- `QueryDeps` 类型 — 依赖接口
- `productionDeps()` — 生产环境依赖工厂

### 依赖接口

```typescript
type QueryDeps = {
  callModel: typeof queryModelWithStreaming   // 模型 API 调用
  microcompact: typeof microcompactMessages   // 消息微压缩
  autocompact: typeof autoCompactIfNeeded     // 自动压缩
  uuid: typeof randomUUID                     // UUID 生成
}
```

### 生产实现

```typescript
function productionDeps(): QueryDeps {
  return {
    callModel: queryModelWithStreaming,
    microcompact: microcompactMessages,
    autocompact: autoCompactIfNeeded,
    uuid: randomUUID,
  }
}
```

### 设计亮点
- **typeof 同步**: 使用 `typeof fn` 保持签名与真实实现自动同步
- **窄范围**: 刻意只注入 4 个依赖，作为模式验证（proof of pattern）
- **无 mock 测试**: 测试直接注入 fake 对象，比 `jest.spyOn` 更可靠

---

## 3. tokenBudget.ts — Token 预算管理

**行数**: 93 行

### 功能概述
追踪 token 使用量，在预算耗尽或收益递减时决定停止查询继续。

### 导出
- `BudgetTracker` 类型 — 预算追踪状态
- `createBudgetTracker()` — 创建追踪器
- `TokenBudgetDecision` 类型 — 决策联合类型
- `checkTokenBudget()` — 主决策函数

### 常量

```typescript
const COMPLETION_THRESHOLD = 0.9    // 90% 预算使用率阈值
const DIMINISHING_THRESHOLD = 500   // 收益递减阈值（tokens）
```

### 决策流程

```
checkTokenBudget(tracker, currentTokens, budget, agentId)
  │
  ├── agentId 存在? → STOP（子Agent不续传）
  ├── budget 为 null/0? → STOP
  │
  ├── 计算当前使用百分比
  ├── 计算自上次检查的 delta
  │
  ├── 检测收益递减:
  │   └── 连续 2 次 delta < 500 tokens 且续传次数 ≥ 3
  │       → STOP（附带 completion_event）
  │
  ├── 未递减 且 < 90% 预算
  │   → CONTINUE（附带 nudge 消息）
  │
  └── 超过 90% 或递减
      → STOP（附带 completion_event + 指标）
```

### 决策类型

```typescript
type ContinueDecision = {
  action: 'continue'
  nudgeMessage: string
  continuationCount: number
  pct: number              // 字段名是 pct，不是 percentage
  turnTokens: number
  budget: number
}

type StopDecision = {
  action: 'stop'
  completionEvent?: {
    totalTokens: number
    budget: number
    continuations: number
    pct: number            // 同上
    diminishingReturns: boolean
  }
}
```

---

## 4. stopHooks.ts — 停止钩子编排器

**行数**: 474 行

### 功能概述
在每个查询回合结束时编排停止钩子的执行，管理后台任务（记忆提取、自动推理、提示建议），协调钩子结果。

### 导出
- `handleStopHooks()` — 异步生成器函数

### 执行流程

```
handleStopHooks(context)
  │
  ├── 1. 设置阶段
  │   ├── 创建钩子上下文（消息、系统提示、工具上下文）
  │   ├── 保存缓存安全参数（仅主会话）
  │   └── 运行模板任务分类（如果在 job 模式）
  │
  ├── 2. 后台任务（fire-and-forget，bare 模式跳过）
  │   ├── 提示建议执行
  │   ├── 记忆提取（如果 extract 模式激活）
  │   └── 自动推理（非子Agent）
  │
  ├── 3. Chicago MCP 清理
  │   └── 自动取消隐藏 & 释放计算机使用锁
  │
  ├── 4. Stop 钩子执行
  │   ├── 通过生成器执行钩子
  │   ├── 追踪进度消息、钩子计数、错误
  │   ├── 收集阻塞错误
  │   ├── 检查续传阻止标志
  │   └── 处理中止信号
  │
  ├── 5. 队友特定钩子（如果队友模式）
  │   ├── TaskCompleted 钩子（每个进行中的任务）
  │   └── TeammateIdle 钩子
  │
  └── 6. 结果聚合
      ├── 返回 StopHookResult
      │   ├── blockingErrors: Error[]
      │   └── preventContinuation: boolean
      └── yield件、摘要
```

### 钩子类型

| 钩子事件 | 触发时机 | 说明 |
|----------|----------|------|
| `Stop` | 每个回合结束 | 通用停止钩子 |
| `TaskCompleted` | 任务完成时 | 队友模式专用 |
| `TeammateIdle` | 队友空闲时 | 队友模式专用 |

### 后台任务

```typescript
// 提示建议（fire-and-forget）
executePromptSuggestion(context).catch(logError)

// 记忆提取（条件执行）
if (isExtractModeActive()) {
  extractMemories(context).catch(logError)
}

// 自动推理（非子Agent）
if (!isSubagent) {
  autoDream(context).catch(logError)
}
```

---

## 5. 查询主循环（推断）

虽然 `src/query/` 目录包含配置、依赖注入、token 预算和停止钩子，但真正的查询主循环在根级 `src/query.ts`（1729 行），不需要"推断"。

```
query(messages, tools, config, deps)
  │
  ├── 构建配置快照 (c
  ├── 注入依赖 (deps.ts)
  ├── 创建预算追踪器 (tokenBudget.ts)
  │
  ├── 主循环:
  │   ├── 微压缩消息 (deps.microcompact)
  │   ├── 自动压缩检查 (deps.autocompact)
  │   ├── 调用模型 (deps.callModel) — 流式
  │   ├── 处理响应:
  │   │   ├── 文本块 → yield 给 UI
  │   │   ├── 工具调用 → 执行工具 → 追加结果
  │   │   └── 停止信号 → 退出循环
  │   ├── 检查 token 预算 (tokenBudget.ts)
  │   │   ├── CONTINUE → 继续循环
  │   │   └── STOP → 退出循环
  │   └── 循环继续...
  │
  └── 执行停止钩子 (stopHooks.ts)
```

---

## 模块设计哲学

1. **纯函数化追求**: config 和 deps 的分离是为了将 query() 逐步重构为纯 reducer
2. **可测试性优先**: 依赖注入而非模块 mock
3. **渐进式停止**: token 预算不是硬切断，而是通过收益递减检测智能停止
4. **生opHooks 使用 async generator，允许调用方逐步消费结果
5. **关注点分离**: 配置、依赖、预算、钩子各自独立，互不耦合
