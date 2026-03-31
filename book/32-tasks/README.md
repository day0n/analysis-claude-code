# 32 - tasks 模块源码分析

> 路径: `src/tasks/`
> 文件数: 12 个
> 功能: 后台任务管理 — 类型系统定义了 7 种任务类型，其中 5 种有独立子目录实现

---

## 模块概述

`tasks/` 实现了 Claude Code 的后台任务系统，使用 discriminated union 架构统一管理 7 种任务类型。每种任务类型有独立的状态接口、类型守卫、React 组件和生命周期函数。

> **注意**: `LocalWorkflowTask` 和 `MonitorMcpTask` 在 `types.ts` 中被引用，但源码目录中没有对应的 TypeScript 源文件（可能是构建时生成或尚未完全实现）。`LocalMainSessionTask` 是根级文件而非子目录。

---

## 架构总览

```
TaskState (discriminated union)
├── LocalShellTask      — 本地 Shell 命令 (type: 'local_bash')
├── LocalAgentTask      — 本地子 Agent (type: 'local_agent')
├── RemoteAgentTask     — 远程 Agent (type: 'remote_agent')
├── InProcessTeammate   — 进程内队友 (type: 'in_process_teammate')
├── LocalWorkflowTask   — 本地工作流 (type: 'local_workflow')（源码中无 TS 目录）
├── MonitorMcpTask      — MCP 监控 (type: 'monitor_mcp')（源码中无 TS 目录）
└── DreamTask           — 后台推理/记忆整合 (type: 'dream')
```

> `LocalMainSessionTask` 作为根级文件 `LocalMainSessionTask.ts`（479 行）存在，未包含在 TaskState union 中，它复用了 LocalAgentTask 的状态结构。

---

## 核心文件

### 1. types.ts — 类型统一

**行数**: 47 行

```typescript
// 所有任务类型的 discriminated union
type TaskState =
  | LocalShellTaskState
  | LocalAgentTaskState
  | RemoteAgentTaskState
  | InProcessTeammateTaskState
  | LocalWorkflowTaskState
  | MonitorMcpTaskState
  | DreamTaskState

// 后台任务（运行中或待处理 + 已后台化）
type BackgroundTaskState = TaskState

function isBackgroundTask(task: TaskState): boolean {
  return (task.status === 'running' || task.status === 'pending')
    && task.isBackgrounded
}
```

---

### 2. stopTask.ts — 任务终止

**行数**: 101 行

#### 导出
- `StopTaskError` — 自定义错误类
- `stopTask(appState, taskId)` — 通用任务终止函数

#### 逻辑

```typescript
async function stopTask(appState: AppState, taskId: string): Promise<void> {
  // 1. 验证任务存在且正在运行
  const task = findTask(appState, taskId)
  if (!task) throw new StopTaskError('Task not found')
  if (task.status !== 'running') throw new StopTaskError('Task not running')

  // 2. 调用任务特定的 kill 实现
  await task.kill()

  // 3. Shell 任务: 抑制 exit code 137 的噪音通知
  if (isLocalShellTask(task) && task.exitCode === 137) {
    suppressNotification(task)
  }

  // 4. 发送 SDK 事件
  emitTaskTerminatedSdk(task)
}
```

---

### 3. pillLabel.ts — 任务标签 UI

**行数**: 83 行

#### 功能
为底部状态栏的后台任务药丸标签生成紧凑文本。

```typescript
// 类型特定标签
"1 shell"       // 1 个 Shell 任务
"2 teams"       // 2 个队友任务
"◇ ultraplan"   // ultraplan 阶段（空心钻石 = 等待输入）
"◆ ultraplan"   // ultraplan 阶段（实心钻石 = 计划就绪）
```

---

## 任务类型详解

### 4. DreamTask — 后台推理/记忆整合

**行数**: 158 行

#### 功能
在用户不活跃时，AI 在后台进行记忆整合和推理。

#### 状态

```typescript
interface DreamTaskState extends TaskStateBase {
  type: 'dream'
  phase: DreamPhase        // 'starting' | 'updating'
  turns: DreamTurn[]       // 最近 30 轮（用于实时显示）
  touchedFiles: string[]   // 通过 Edit/Write 触及的文件
}
```

#### 生命周期

```
registerDreamTask()
    ↓
phase: 'starting'
    ↓ (首次工具调用)
phase: 'updating'
    ↓ (追踪 EdWrite 的文件)
addDreamTurn(turn)  // 保留最近 30 轮
    ↓
completeDreamTask() 或 failDreamTask()
```

#### 清理
注册到 cleanup 系统，通过 AbortController 处理中止。

---

### 5. LocalMainSessionTask — 主会话后台化

**行数**: 479 行（根级文件 `LocalMainSessionTask.ts`，非子目录）

#### 功能
支持用户按 Ctrl+B 两次将当前主会话查询后台化，继续在前台进行新对话。

#### 关键设计

```typescript
// 任务 ID 使用 's' 前缀（vs Agent 的 'a' 前缀）
const taskId = 's' + generateId()

// 隔离的 transcript 文件，防止 /clear 后损坏
const transcriptFile = createIsolatedTranscript()
```

#### 生命周期

```
用户按 Ctrl+B 两次
    ↓
registerMainSessionTask()
    ├── 创建隔离 transcript
    ├── 保存当前消息上下文
    └── 启动后台查询
    ↓
后台运行中...
    ↓
foregroundMainSessionTask()  // 用户选择前台化
    ├── 恢复消息到主对话
    └── 继续交互
```

---

### 6. InProcessTeammateTask — 进程内队友

**行数**: 122 行 (types) + 126 行 (component)

#### 功能
支持多个 AI Agent 在同一进程内协作（Swarm 模式）。

#### 身份系统

```typescript
interface TeammateIdentity {
  agentId: AgentId
  agentName: string
  teamName: string
  color: string                // UI 区分颜色
  planModeRequired: boolean    // 是否需要计划模式审批
  parentSessionId: string
}
```

#### 消息上限

```typescript
const TEAMMATE_MESSAGES_UI_CAP = 50

// 防止 36.8GB 内存膨胀
function appendCappedMessage(messages: Message[], msg: Message): Message[] {
  if (messages.length >= TEAMMATE_MESSAGES_UI_CAP) {
    return [...messages.slice(1), msg]  // FIFO
  }
  return [...messages, msg]
}
```

#### 隔离机制
- 使用 `AsyncLocalStorage` 实现并发 Agent 隔离
- 邮箱消息系统用于 Agent 间通信
- 优雅关闭：处理待处理消息后再停止

---

### 7. LocalShellTask — Shell 命令执行

**行数**: 42 行 (guards) + 77 行 (kill) + 522 行 (component)

#### 卡住检测

```typescript
const STALL_THRESHOLD = 45_000  // 45 秒
const STALL_CHECK_INTERVAL = 5_000  // 每 5 秒检查

function isShellTaskStalled(task: LocalShellTaskState): boolean {
  // 检测交互式提示模式
  const interactivePatterns = [
    /\(y\/n\)/,
    /\[y\/n\]/,
    /Press any key|Enter password/,
  ]
  return task.lastOutputAge > STALL_THRESHOLD
    || interactivePatterns.some(p => p.test(task.lastOutput))
}
```

#### 任务种类

```typescript
type BashTaskKind = 'bash' | 'monitor'

// bash: 标准命令，有完成通知
// monitor: 流式输出，无完成通知（如 tail -f）
```

#### 僵尸进程清理

```typescript
// 防止 10 天僵尸进程
function killShellTasksForAgent(agentId: AgentId): void {
  // 终止该 Agent 的所有 Shell 任务
  // 清除排队的通知
  // 驱逐任务输出缓存
}
```

---

### 8. LocalAgentTask — 本地子 Agent

**行数**: 682 行

#### 功能
管理本地子 Agent 执行，包括进度追踪、消息队列和磁盘输出。

#### 进度追踪

```typescript
interface ProgressTracker {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  toolActivities: ToolActivity[]  // 工具活动列表
  startTime: number
  lastActivityTime: number
}

interface ToolActivity {
  toolName: string
  description: string
  timestamp: number
}
```

#### 消息队列

```typescript
// 后台 Agent 的消息队列
function appendMessageToLocalAgent(taskId: string, message: Message): void
function drainPendingMessages(taskId: string): Message[]
```

#### 磁盘输出

```typescript
// 输出写入磁盘文件，带驱逐策略
// 防止内存膨胀
const outputFile = createTempFile(`agent-${taskId}.jsonl`)
```

---

### 9. RemoteAgentTask — 远程 Agent

**行数**: 855 行（最大的任务文件）

#### 远程任务类型

```typescript
type RemoteTaskType =
  | 'remote-agent'     // 通用远程 Agent
  | 'ultraplan'        // 超级计划
  | 'ultrareview'      // 超级审查
  | 'autofix-pr'       // 自动修复 PR
  | 'background-pr'    // 后台 PR
```

#### 前置条件检查

```
registerRemoteAgentTask()
    ↓
前置条件验证:
  ├── 用户已登录?
  ├── 远程环境可用?
  ├── 在 Git 仓库中?
  ├── 有 GitHub 远程?
  └── GitHub App 已安装?
    ↓
全部通过 → 创建远程会话
任一失败 → 显示错误 + 修复指导
```

#### Ultraplan 阶段追踪

```typescript
// Ultraplan 有特殊的阶段状态
type UltraplanPhase =
  | 'needs_input'   // 等待用户输入（◇ 空心钻石）
  | 'plan_ready'    // 计划就绪（◆ 实心钻石）
  | 'executing'     // 执行中
```

#### 元数据持久化
```typescript
// 元数据保存到会话 sidecar 文件
// 支持跨会话恢复远程任务状态
persistMetadata(taskId, { remoteSessionId, status, phase })
```

---

## 通用设计模式

### 1. TaskStateBase 基础接口

```typescript
interface TaskStateBase {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed'
  isBackgrounded: boolean
  startTime: number
  endTime?: number
  error?: string
}
```

### 2. 每种任务类型的标准导出

```typescript
// 类型守卫
export function isXxxTask(task: TaskState): task is XxxTaskState

// 生命周期函数
export function registerXxxTask(params): void
export function backgroundXxxTask(taskId): void
export function foregroundXxxTask(taskId): void

// React 组件
export function XxxTask(props): JSX.Element
```

### 3. AbortController 取消机制

所有长时间运行的任务都使用 AbortController，支持优雅取消。

### 4. 清理注册

所有任务注册到 cleanup 系统，确保进程退出时资源被正确释放。

---

## 模块依赖关系

```
tasks/
├── types.ts ← 所有任务状态类型
├── stopTask.ts ← 通用终止逻辑
├── pillLabel.ts ← UI 标签
│
├── DreamTask/ ← 后台推理
├── LocalMainSessionTask.ts ← 主会话后台化（根级文件，复用 LocalAgentTask 状态）
├── InProcessTeammateTask/ ← 队友协作
│   ├── types.ts
│   └── InProcessTeammateTask.tsx
├── LocalShellTask/ ← Shell 命令
│   ├── guards.ts
│   ├── killShellTasks.ts
│   LocalShellTask.tsx
├── LocalAgentTask/ ← 本地 Agent
│   └── LocalAgentTask.tsx
└── RemoteAgentTask/ ← 远程 Agent
    └── RemoteAgentTask.tsx
```
