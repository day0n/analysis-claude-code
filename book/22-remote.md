# 22 - remote 模块源码分析

> 路径: `src/remote/`
> 文件数: 4 个
> 功能: 远程会话管理 — 云端 Agent 会话的连接、消息收发和状态同步

---

## 文件详解

### 1. RemoteSessionManager.ts — 远程会话管理器

管理远程会话的连接、消息收发和权限处理。

```typescript
class RemoteSessionManager {
  // 连接管理
  connect(): Promise<void>
  disconnect(): void
  reconnect(): Promise<void>
  isConnected(): boolean
  getSessionId(): string

  // 消息发送
  sendMessage(content: RemoteMessageContent): Promise<void>

  // 权限处理
  respondToPermissionRequest(requestId: string, response: PermissionUpdate): void

  // 会话控制
  cancelSession(): void
}
```

> 注意：不存在 `createSession`、`disconnectSession`、`resumeSession`、`getActiveSession` 方法。

### 2. SessionsWebSocket.ts — 会话 WebSocket

维护与远程服务器的 WebSocket 持久连接。URL 和认证信息在构造函数中传入。

```typescript
class SessionsWebSocket {
  // 连接管理（无参数，配置在构造函数中）
  connect(): void
  close(): void
  reconnect(): void
  isConnected(): boolean

  // 消息发送
  sendControlResponse(response: SDKControlResponse): void
  sendControlRequest(request: SDKControlRequest): void

  // 重连（私有方法）
  private scheduleReconnect(delay: number, label: string): void
}
```

> 注意：`connect()` 无参数；不存在 `onMessage` 和 `send` 方法；重连方法是 `scheduleReconnect`（私有），不是 `reconnectWithBackoff`。消息回调通过构造函数的 `SessionsWebSocketCallbacks` 参数传入。

### 3. sdkMessageAdapter.ts — SDK 消息适配器

将远程 SDK 消息转换为本地 REPL 可用的格式。**只有单向转换**（SDK→REPL），不存在反向转换。

```typescript
// SDK 消息 → 本地消息
function convertSDKMessage(message: SDKMessage): ConvertedMessage

// 辅助函数
function isSessionEndMessage(message: SDKMessage): boolean
function isSuccessResult(message: SDKMessage): boolean
function getResultText(message: SDKMessage): string

type ConvertedMessage = { ... }
```

> 注意：不存在 `adaptRemoteToLocal` 和 `adaptLocalToRemote` 函数。

### 4. remotePermissionBridge.ts — 远程权限工具

提供为远程权限请求创建合成消息和工具存根的工具函数，**不是**一个代理转发模块。

```typescript
// 为远程权限请求创建合成的 assistant 消息
function createSyntheticAssistantMessage(
  toolName: string,
  toolInput: Record<string, unknown>,
  toolUseId: string
): Message

// 创建工具存根（用于权限检查）
function createToolStub(toolName: string): Tool
```
