# 20 - bridge 模块源码分析

> 路径: `src/bridge/`
> 文件数: 31 个
> 功能: Web/IDE 桥接通信 — 连接 CLI 与 Web UI/IDE 扩展

---

## 模块概述

`bridge/` 是 Claude Code 最复杂的通信模块之一，负责在 CLI 进程与 Web 界面（claude.ai/code）或 IDE 扩展（VS Code/JetBrains）之间建立双向通信桥梁。支持多会话管理、断线重连、权限代理和状态同步。

---

## 架构总览

```
┌──────────────┐     WebSocket/SSE      ┌──────────────────┐
│  Web UI      │ ◄──────────────────────► │                  │
│  (claude.ai) │                         │   Bridge Layer    │
└──────────────┘                         │                  │
                                         │  ├── 消息路由     │
┌──────────────┐     WebSocket/SSE      │  ├── 权限代理     │
│  IDE 扩展    │ ◄──────────────────────► │  ├── 状态同步     │
│  (VS Code)   │                         │  ├── 断线重连     │
└──────────────┘                         │  └── 多会话管理   │
                                         │                  │
                                         └────────┬─────────┘
                                                  │
                                         ┌────────▼─────────┐
                                         │   CLI 核心        │
                                         │  (REPL/Query)     │
                                         └──────────────────┘
```

---

## 核心文件详解

### 1. bridgeMessaging.ts — 消息处理核心

**行数**: 462 行

#### 功能概述
传输层消息处理，提供纯函数用于解析 WebSocket 消息、路由控制请求和去重回声。

#### 导出
- `isSDKMessage()` — SDK 消息类型守卫
- `isSDKControlResponse()` — 控制响应类型守卫
- `isSDKControlRequest()` — 控制请求类型守卫
- `isEligibleBridgeMessage()` — 桥接消息资格检查
- `extractTitleText()` — 提取标题文本
- `handleIngressMessage()` — 入站消息处理
- `handleServerControlRequest()` — 服务器控制请求处理
- `makeResultMessage()` — 构造结果消息
- `BoundedUUIDSet` 类 — 有界 UUID 集合

#### BoundedUUIDSet — FIFO 环形缓冲去重

```typescript
class BoundedUUIDSet {
  private set = new Set<string>()
  private queue: string[] = []
  private maxSize: number

  add(uuid: string): boolean {
    if (this.set.has(uuid)) return false // 重复
    this.set.add(uuid)
    this.queue.push(uuid)
    if (this.queue.length > this.maxSize) {
      const oldest = this.queue.shift()!
      this.set.delete(oldest)
    }
    return true // 新消息
  }
  // O(1) 操作，防止回声消息重复处理
}
```

#### 控制请求处理

```typescript
async function handleServerControlRequesServerControlRequest) {
  switch (request.type) {
    case 'initialize':     // 初始化连接
    case 'set_model':      // 切换模型
    case 'interrupt':      // 中断执行
    case 'set_permission_mode':  // 设置权限模式
    case 'set_max_thinking_tokens':  // 设置思考 token 上限
  }
}
```

---

### 2. bridgePointer.ts — 崩溃恢复指针

**行数**: 211 行

#### 功能概述
会话启动时写入指针文件，用于崩溃恢复和 `--continue` 功能。

#### 导出
- `BRIDGE_POINTER_TTL_MS` — 指针 TTL（4 小时）
- `BridgePointer` 类型
- `writeBridgePointer()` — 写入指针
- `readBridgePointer()` — 读取指针
- `readBridgePointerAcrossWorktrees()` — 跨 worktree 读earBridgePointer()` — 清除指针

#### 指针结构

```typescript
type BridgePointer = {
  sessionId: string
  environmentId: string
  source: 'standalone' | 'repl'
}
```

#### 过期检测
```typescript
// 通过文件 mtime 检测过期（4 小时 TTL）
const stats = await stat(pointerPath)
const age = Date.now() - stats.mtimeMs
if (age > BRIDGE_POINTER_TTL_MS) return null // 过期
```

#### Worktree 扇出
```typescript
// 跨 git worktree 查找最新指针
// MAX_WORKTREE_FANOUT = 50，限制并行 stat() 调用
async function readBridgePointerAcrossWorktrees() {
  const worktrees = await getGitWorktrees()
  const pointers = await Promise.all(
    worktrees.slice(0, 50).map(wt => readBridgePointer(wt.path))
  )
  return pointers
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime)[0] // 取最新
}
```

---

### 3. bridgeUI.ts — 终端 UI 实现

**行数**: 531 行

#### 功能概述
桥接状态的终端 UI 显示，包括 QR 码、Spinner、会话列表和工具活动。

#### 导出
- `createBridgeLogger()` — 创建桥接日志器

#### 状态机

```
idle → attached → titled
  ↓        ↓         ↓
  └── reconnecting ──┘
           ↓
        failed
```

#### UI 功能

| 功能 | 说明 |
|------|------|
| QR 码 | 连接/会话 URL 的 QR 码显示 |
| Spinner | 等待连接时的动画 |
| 会话列表 | 多会话模式下的项目符号列表 |
| 工具活动 | 显示当前执行的工具（30 秒过期） |
| 容量指示 | Spawn 模式下的容量显示 |

#### ANSI 光标操作
```typescript
// 追踪 statusLineCount 用于 ANSI 光标操作
function updateDisplay() {
  // 上移 N 行
  process.stdout.write(`\x1b[${statusLineCount}A`)
  // 清除到末尾
  process.stdout.write('\x1b[J')
  // 写入新内容
  process.stdout.write(newContent)
  // 更新行数（考虑终端换行）
  statusLineCount = countVisualLines(newContent, terminalWidth)
}
```

---

### 4. bridgePermissionCallbacks.ts — 权限代理

**行数**: 44 行

#### 功能概述
定义 CLI 和 Web 应用之间权限请求/响应的回调接口。

```typescript
type BridgePermissionCallbacks = {
  sendRequest(request: PermissionRequest): void
  sendResponse(response: BridgePermissionResponse): void
  cancelRequest(requestId: string): void
  onResponse(handler: (response: BrPermissionResponse) => void): void
}

type BridgePermissionResponse = {
  behavior: 'allow' | 'deny'
  updatedInput?: unknown
  updatedPermissions?: PermissionUpdate
  message?: string
}
```

---

### 5. bridgeStatusUtil.ts — 状态工具函数

**行数**: 164 行

#### 导出
- `StatusState` 类型 — idle | attached | titled | reconnecting | failed
- `TOOL_DISPLAY_EXPIRY_MS` — 工具显示过期时间（30 秒）
- `SHIMMER_INTERVAL_MS` — 闪烁动画间隔
- `buildBridgeConnectUrl()` — 构建连接 URL
- `buildBridgeSessionUrl()` — 构建会话 URL
- `computeShimmerSegments()` — 计算闪烁动画段
- `getBridgeStatus()` — 获取桥接WithOsc8Link()` — OSC 8 终端超链接

#### 闪烁动画
```typescript
// 使用 grapheme segmentation 支持多字节字符
function computeShimmerSegments(text: string, index: number) {
  const graphemes = [...new Intl.Segmenter('en', { granularity: 'grapheme' })
    .segment(text)]
  // 计算闪烁位置...
}
```

#### OSC 8 超链接
```typescript
// 终端可点击链接
function wrapWithOsc8Link(text: string, url: string): string {
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`
}
```

---

### 6. bridgeConfig.ts — 桥接配置

管理桥接连接的配置参数，包括 WebSocket URL、认证令牌和重连策略。

### 7. bridgeMain.ts — 桥接主逻辑

桥接模式的主入口，协调连接建立、消息路由和生命周期管理。

### 8. remoteBridgeCore.ts — 远程桥接核心

远程桥接的核心实现，处理与远程服务器的持久连接。

### 9. replBridge.ts — REPL 桥接

将桥接功能集成到 REPL 屏幕中。

### 10. initReplBridge.ts — REPL 桥接初始化

REPL 模式下桥接的初始化逻辑。

### 11. sessionRunner.ts — 会话运行器

管理桥接会话的执行生命周期。

### 12. createSession.ts — 会话创建

创建新的桥接会话。

### 13. codeSessionApi.ts — 代码会话 API

与后端代码会话 API 的交互。

### 14. jwtUtils.ts — JWT 工具

JWT 令牌的解析和验证。

### 15. flushGate.ts — 刷新门控

控制消息刷新的门控机制。

### 16. capacityWake.ts — 容量唤醒

管理桥接容量和唤醒逻辑。

### 17. pollConfig.ts / pollConfigDefaults.ts — 轮询配置

桥接轮询的配置和默认值。

### 18. inboundMessages.ts / inboundAttachments.ts — 入站处理

处理入站消息和附件。

### 19. types.ts — 类型定义

桥接模块的内部类型定义。

---

## 设计亮点

1. **多传输支持**: WebSocket 和 SSE 双传输，自动降级
2. **崩溃恢复**: 指针文件 + TTL 机制确保会话可恢复
3. **回声去重**: BoundedUUIDSet 用 O(1) 操作过滤重复消息
4. **Worktree 感知**: 跨 git worktree 查找会话，支持并行开发
5. **渐进式 UI**: 状态机驱动的终端 UI，支持 QR 码和闪烁动画
6. **权限代理**: CLI 和 Web 之间透明的权限请求转发
