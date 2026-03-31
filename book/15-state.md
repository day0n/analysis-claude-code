# 15 - state 模块源码分析

> 路径: `src/state/`
> 文件数: 6 个
> 总行数: 1190 行
> 功能: React 感知的应用状态管理 — 组件级订阅与重渲染

---

## 模块概述

`state/` 与 `bootstrap/state.ts` 的全局单例不同，这里的状态是 React 感知的，支持组件级别的订阅和选择性重渲染。类似 Zustand 的设计模式。

---

## 文件详解

### 1. store.ts — 状态存储核心（34 行）

#### 核心 API

```typescript
type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void  // 接受 updater 函数，不是部分状态
  subscribe: (listener: () => void) => () => void  // listener 无参数，返回 unsubscribe
}

function createStore<T>(
  initialState: T,
  onChange?: (args: { newState: T; oldState: T }) => void
): Store<T>
```

> 注意：`setState` 接受 updater 函数 `(prev) => next`，不是直接传入部分状态对象。`subscribe` 的 listener 不接收参数。`onChange` 回调（接收新旧状态）是 `createStore` 的第二个参数。

---

### 2. AppStateStore.ts — 应用状态定义（569 行）

#### 功能
定义完整的应用状态结构和初始值。

#### 实际 AppState 关键字段

```typescript
interface AppState {
  // 设置与配置
  settings: SettingsJson
  verbose: boolean
  mainLoopModel: ModelSetting
  expandedView: boolean

  // 权限
  toolPermissionContext: ToolPermissionContext

  // 任务（对象映射，非数组）
  tasks: { [taskId: string]: TaskState }

  // MCP
  mcp: MCPState

  // 插件
  plugins: PluginState

  // 推测执行
  speculation: SpeculationState

  // 团队视图
  viewingAgentTaskId?: string

  // 消息与对话
  messages: Message[]

  // 文件历史
  fileHistory: FileHistoryState

  // 归因追踪
  attribution: AttributionState

  // 通知
  notifications: Notification[]

  // 待办列表
  todoList: TodoList | null

  // ... 更多字段
}
```

> 注意：`tasks` 是 `{ [taskId: string]: TaskState }` 对象映射，不是数组。

---

### 3. selectors.ts — 状态选择器（76 行）

#### 功能
派生状态选择器，用于从 AppState 中提取计算状态。

#### 实际导出

```typescript
// 获取当前查看的队友任务
function getViewedTeammateTask(
  appState: Pick<AppState, 'viewingAgentTaskId' | 'tasks'>
): InProcessTeammateTaskState | undefined

// 确定用户输入应路由到哪个 Agent
type ActiveAgentForInput =
  | { type: 'leader' }
  | { type: 'viewed'; task: InProcessTeammateTaskState }
  | { type: 'named_agent'; task: LocalAgentTaskState }

function getActiveAgentForInput(appState: AppState): ActiveAgentForInput
```

---

### 4. AppState.tsx — React Provider（199 行）

#### 功能
React Context Provider，将状态存储注入组件树。

```tsx
// Context 名称
const AppStoreContext = createContext<Store<AppState>>(...)
const HasAppStateContext = createContext<boolean>(false)  // 防嵌套

// 消费 Hook
function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useContext(AppStoreContext)
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState())
  )
}
```

---

### 5. onChangeAppState.ts — 状态变更监听（171 行）

#### 功能
硬编码的状态变更副作用处理器，响应特定字段的变化。

```typescript
// 接收新旧状态，内部硬编码了对以下字段变化的响应：
function onChangeAppState({ newState, oldState }: {
  newState: AppState
  oldState: AppState
}): void {
  // toolPermissionContext.mode 变化 → 通知权限模式变更
  // mainLoopModel 变化 → 设置模型覆盖
  // expandedView 变化 → 保存配置
  // verbose 变化 → 保存配置
  // settings 变化 → 应用环境变量、清除凭证缓存
}
```

> 注意：这不是一个通用的注册机制，而是一个具体的函数，内部硬编码了对特定字段变化的响应逻辑。

---

### 6. teammateViewHelpers.ts — 队友视图辅助（141 行）

#### 实际导出

```typescript
function enterTeammateView(appState: AppState, taskId: string): void
function exitTeammateView(appState: AppState): void
function stopOrDismissAgent(appState: AppState, taskId: string): void
```

---

## 与 bootstrap/state.ts 的区别

| 特性 | bootstrap/state.ts | state/ 模块 |
|------|-------------------|-------------|
| 类型 | 全局单例对象 | React 感知的 Store |
| 访问方式 | getter/setter 函数 | useAppState Hook |
| 重渲染 | 不触发 | 自动触发组件重渲染 |
| 用途 | 非 UI 状态（API、遥测） | UI 相关状态（消息、任务） |
| 生命周期 | 进程级 | 组件树级 |
