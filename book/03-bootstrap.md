# 03 - bootstrap 模块源码分析

> 路径: `src/bootstrap/`
> 文件数: 1 个（但极其庞大）
> 功能: 全局应用状态管理 — 整个应用的"神经系统"

---

## 模块概述

`bootstrap/` 模块只有一个文件 `state.ts`，但它是整个 Claude Code 应用最核心的状态容器。它维护了一个全局单例 `STATE` 对象，通过 150+ 个 getter/setter 函数提供类型安全的状态访问。

---

## state.ts — 全局状态容器

**行数**: 1758 行
**导出数量**: 150+ 个函数

### 架构设计

```
┌─────────────────────────────────────────┐
│              STATE (单例对象)              │
├─────────────────────────────────────────┤
│  会话管理    │  费用追踪    │  Token 统计  │
│  路径管理    │  模型配置    │  遥测指标    │
│  Agent 状态  │  API 缓存    │  错误日志    │
│  插件系统    │  权限管理    │  Cron 任务   │
│  Hook 系统   │  技能追踪    │  提示缓存    │
│  模式标志    │  团队创建    │  调试状态    │
└─────────────────────────────────────────┘
         ↕ (通过 getter/setter 访问)
    整个应用的所有模块
```

### 状态分类详解

#### 1. 会话管理 (Session Management)

```typescript
// 核心函数
getSessionId(): SessionId           // 获取当前会话 ID
regenerateSessionId(): void         // 重新生成会话 ID
switchSession(id: SessionId): void  // 切换到指定会话
getParentSessionId(): SessionId | undefined  // 获取父会话 ID（子Agent场景）
setParentSessionId(id: SessionId): void
```

**设计说明**: 会话 ID 使用 `crypto.randomUUID()` 生成，支持父子会话关系（用于子 Agent 场景）。`switchSession` 在恢复历史会话时使用。

#### 2. 路径管理 (Path Management)

```typescript
getOriginalCwd(): string            // 获取原始工作目录
setOriginalCwd(path: string): void
getProjectRoot(): string            // 获取项目根目录
setProjectRoot(path: string): void
getCwdState(): CwdState             // 获取当前工作目录状态
setCwdState(state: CwdState): void
```

**设计说明**: 区分"原始工作目录"（用户启动 CLI 的位置）和"项目根目录"（git 仓库根目录），这对于正确解析相对路径至关重要。

#### 3. 费用与性能追踪 (Cost & Performance Tracking)

```typescript
// 费用
addToTotalCostState(cost: number): void
getTotalCostUSD(): number

// API 耗时
getTotalAPIDuration(): number
getTotalAPIDurationWithoutRetries(): number

// 工具耗时（按回合）
addToTurnHookDuration(ms: number): void
addToTurnToolDuration(ms: number): void
addToTurnClassifierDuration(ms: number): void
getTurnHookDurationMs(): number
getTurnToolDurationMs(): number
getTurnClassifierDurationMs(): number
```

**设计说明**: 性能追踪分为"总计"和"按回合"两个维度。回合级别的追踪用于识别单次交互中的性能瓶颈。

#### 4. Token 统计 (Token Tracking)

```typescript
// 全局 Token 统计
getTotalInputTokens(): number
getTotalOutputTokens(): number
getTotalCacheReadInputTokens(): number
getTotalCacheCreationInputTokens(): number

// 按模型统计
recordModelUsage(model: string, usage: ModelUsage): void
getModelUsage(): { [modelName: string]: ModelUsage }
getTotalTokensAcrossModels(): number
```

**ModelUsage 结构**:
```typescript
interface ModelUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  apiCalls: number
  totalDurationMs: number
}
```

**设计说明**: 使用 `lodash-es/sumBy` 聚合跨模型的 token 统计。支持多模型场景（主模型 + 分类器模型）。

#### 5. 模型配置 (Model Configuration)

```typescript
getMainLoopModelOverride(): ModelSetting | undefined
setMainLoopModelOverride(model: ModelSetting | undefined): void
getInitialMainLoopModel(): ModelSetting
setInitialMainLoopModel(model: ModelSetting): void
getModelStrings(): ModelSetting
setModelStrings(settings: ModelSetting): void
```

**设计说明**: 支持运行时模型切换（通过 `/model` 命令），同时保留初始模型配置用于回退。

#### 6. OpenTelemetry 遥测 (Telemetry)

```typescript
// Meter（指标）
setMeter(meter: Meter): void
getMeter(): Meter | undefined

// 各种计数器
getSessionCounter(): Counter
getLocCounter(): Counter          // 代码行数计数器
getPrCounter(): Counter           // PR 计数器
getCommitCounter(): Counter       // 提交计数器
getCostCounter(): Counter         // 费用计数器
getTokenCounter(): Counter        // Token 计数器
getCodeEditToolDecisionCounter(): Counter  // 代码编辑决策计数器
getActiveTimeCounter(): Counter   // 活跃时间计数器

// Logger & Tracer
setLoggerProvider(provider: LoggerProvider): void
getEventLogger(): Logger | undefined
setMeterProvider(provider: MeterProvider): void
setTracerProvider(provider: BasicTracerProvider): voi**设计说明**: 完整集成 OpenTelemetry 标准，支持 Metrics、Logs、Traces 三大支柱。计数器覆盖了从会话到代码编辑的各个维度。

#### 7. Agent 与 UI (Agent & UI)

```typescript
getAgentColor(): string                    // 获取当前 Agent 颜色
getAgentColorMap(): Map<string, string>    // Agent ID → 颜色映射
incrementAgentColorIndex(): void           // 递增颜色索引
```

**设计说明**: 多 Agent 场景下，每个 Agent 分配不同颜色用于 UI 区分。颜色从预定义调色板中循环分配。

#### 8. API 请求缓存 (API Request Caching)

```typescript
getLastAPIRequest(): unknown
setLastAPIRequest(request: unknown): void
getLastAPIRequestMessages(): Message[]
setLastAPIRequestMessages(messages: Messageid
getLastClassifierRequests(): unknown[]
setLastClassifierRequests(requests: unknown[]): void
```

**设计说明**: 缓存最近的 API 请求用于调试和重试。分别缓存主模型请求和分类器请求。

#### 9. 错误日志 (Error Logging)

```typescript
addToInMemoryErrorLog(error: ErrorLogEntry): void
getInMemoryErrorLog(): ErrorLogEntry[]
```

**设计说明**: 内存中的错误日志，用于 `doctor` 诊断命令和调试。不持久化到磁盘。

#### 10. 插件系统 (Plugin System)

```typescript
getInlinePlugins(): Array<string>
setInlinePlugins(plugins: Array<string>): void
getUseCoworkPlugins(): boolean
setUseCoworkPlugins(enabled: boolean): void
```

#### 11. 权限与信任 (Permissions & Trust)

```typescript
getSessionBypassPermissionsMode(): boolean
setSessionBypassPermissionsMode(bypass: boolean): void
getSessionTrustAccepted(): boolean
setSessionTrustAccepted(accepted: boolean): void
```

**设计说明**: `bypassPermissions` 用于自动化场景（如 CI/CD），`trustAccepted` 记录用户是否已接受项目信任提示。

#### 12. Cron 任务 (Cron Tasks)

```typescript
getSessionCronTasks(): SessionCronTask[]
addSessionCronTask(task: SessionCronTask): void
removeSessionCronTasks(ids: string[]): void
getScheduledTasksEnabled(): boolean
setScheduledTasksEnabled(enabled: boolean): void
```

**设计说明**: 支持会话内的定时任务（如定期检查部署状态），任务随会话结束而销毁。

#### 13. Hook 系统System)

```typescript
registerHookCallbacks(event: HookEvent, callbacks: HookCallback[]): void
getRegisteredHooks(): Map<HookEvent, HookCallback[]>
clearRegisteredHooks(): void
```

#### 14. 技能追踪 (Skills Tracking)

```typescript
addInvokedSkill(skill: string): void
getInvokedSkills(): Map<string, InvokedSkillInfo>
clearInvokedSkills(): void
```

**设计说明**: 追踪已调用的技能，在消息压缩（compaction）事件后保持持久化。

#### 15. 提示缓存 (Prompt Caching)

```typescript
getPromptCache1hAllowlist(): string[] | null
setPromptCache1hAllowlist(allowlist: string[] | null): void
getPromptCache1hEligible(): boolean
setPromptCache1hEligible(eligible: boolean): void
getCachedClaudeMdContent(): string | undefined
setCachedClaudeMdContent(content: string): void
```

**设计说明**: 1 小时提示缓存白名单机制，减少重复的系统提示发送。CLAUDE.md 内容也被缓存以避免重复读取。

#### 16. 模式标志 (Mode Flags)

```typescript
getAfkModeHeaderLatched(): boolean    // AFK 模式（离开键盘）
setAfkModeHeaderLatched(v: boolean): void
getFastModeHeaderLatched(): boolean   // 快速模式
setFastModeHeaderLatched(v: boolean): void
getCacheEditingHeaderLatched(): boolean  // 缓存编辑模式
setCacheEditingHeaderLatched(v: boolean): void
```

**设计说明**: 使用"锁存"（latched）模式，一旦设置在整个会变。这些标志通过 HTTP 头传递给 API。

---

## 设计模式分析

### 1. 单例模式
整个模块维护一个 `STATE` 对象，所有状态集中管理。

### 2. 函数式访问器
不直接暴露 STATE 对象，而是通过 getter/setter 函数访问，确保类型安全和封装性。

### 3. 不可变性倾向
虽然 STATE 本身是可变的，但通过函数式接口鼓励单向数据流。

### 4. 关注点分离
150+ 个函数按功能域组织，每个域独立管理自己的状态切片。

---

## 为什么这个文件这么大？

`state.ts` 的 1758 行看起来很多，但考虑到：
- 它是整个应用唯一的全局状态容器
- 150+ 个函数大多是简单的 getter/setter（平均每个 ~10 行）
- 集中管理避免了状态分散导致的一致性问题
- 类型安全的访问器比直接操作全局对象更可靠

这是一个经过深思熟虑的架构决策，而非代码膨胀。
