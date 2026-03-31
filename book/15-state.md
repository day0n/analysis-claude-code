# 15 - state 模块源码分析

> 路径: `src/state/`
> 文件数: 6 个
> 功能: React 感知的应用状态管理 — 组件级订阅与重渲染

---

## 模块概述

`state/` 与 `bootstrap/state.ts` 的全局单例不同，这里的状态是 React 感知的，支持组件级别的订阅和选择性重渲染。类似 Zustand 的设计模式。

---

## 文件详解

### 1. store.ts — 状态存储核心

#### 功能
创建中心化的状态存储实例，提供 `getState()`、`setState()`、`subscribe()` 等核心方法。

#### 核心 API

```typescript
const store = createStore<AppState>(initialState)

// 获取当前状态快照
store.getState()

// 更新状态（浅合并）
store.setState({ isProcessing: true })

// 订阅状态变化
store.subscribe((newState, prevState) => {
  // 响应变化
})
```

---

### 2. AppStateStore.ts — 应用状态定义

#### 功能
定义完整的应用状态结构和初始值。

#### 状态结构

```typescript
interface AppState {
  // 对话状态
  messages: Message[]
  isProcessing: boolean
  currentToolUse: ToolUseInfo | null
  streamingContent: string

  // UI 状态
  theme: Theme
  vimMode: boolean
  fastMode: boolean
  fullscreenLayout: boolean
  inputMode: 'normal' | 'insert' | 'visual'

  // 会话状态
  sessionTitle: string | null
  sessionId: string
  isResumedSession: boolean

  // 任务状态
  tasks: TaskState[]
  backgroundTasks: BackgroundTaskState[]

  // 权限状态
  pendingPermission: PermissionRequest | null
  permissionMode: PermissionMode

  // 团队状态（Swarm 模式）
  teammates: TeammateState[]
  activeTeammate: string | null

  // 费用状态
  totalCostUSD: number
  totalInputTokens: number
  totalOutputTokens: number
}
```

---

### 3. selectors.ts — 状态选择器

#### 功能
派生状态选择器，避免不必要的组件重渲染。

```typescript
// 基础选择器
const selectMessages = (state: AppState) => state.messages
const selectIsProcessing = (state: AppState) => state.isProcessing
const selectTasks = (state: AppState) => state.tasks

// 派生选择器
const selectRunningTasks = (state: AppState) =>
  state.tasks.filter(t => t.status === 'running')

const selectBackgroundTaskCount = (state: AppState) =>
  state.backgroundTasks.length

const selectHasPendingPermission = (state: AppState) =>
  state.pendingPermission !== null
```

---

### 4. AppState.tsx — React Provider

#### 功能
React Context Provider，将状态存储注入组件树。

```tsx
function AppStateProvider({ children, initialState }) {
  const store = useMemo(() => createStore(initialState), [])

  return (
    <AppStateContext.Provider value={store}>
      {children}
    </AppStateContext.Provider>
  )
}

// 消费 Hook
function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useContext(AppStateContext)
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState())
  )
}
```

---

### 5. onChangeAppState.ts — 状态变更监听

#### 功能
注册状态变更的副作用处理器。

```typescript
// 当特定状态片段变化时执行副作用
onChangeAppState(
  (state) => state.sessionTitle,  // 选择器
  (title) => {                     // 副作用
    updateTerminalTitle(title)
  }
)
```

---

### 6. teammateViewHelpers.ts — 队友视图辅助

#### 功能
Swarm 模式下队友状态的视图层辅助函数。

```typescript
// 获取排序后的队友列表
function getRunningTeammatesSorted(state: AppState): TeammateState[]

// 获取队友的显示颜色
function getTeammateColor(agentId: string): string

// 格式化队友状态文本
function formatTeammateStatus(teammate: TeammateState): string
```

---

## 与 bootstrap/state.ts 的区别

| 特性 | bootstrap/state.ts | state/ 模块 |
|------|-------------------|-------------|
| 类型 | 全局单例对象 | React 感知的 Store |
| 访问方式 | getter/setter 函数 | useAppSk |
| 重渲染 | 不触发 | 自动触发组件重渲染 |
| 用途 | 非 UI 状态（API、遥测） | UI 相关状态（消息、任务） |
| 生命周期 | 进程级 | 组件树级 |
