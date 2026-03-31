# 22 - remote 模块源码分析

> 路径: `src/remote/`
> 文件数: 4 个
> 功能: 远程会话管理 — 云端 Agent 会话的创建、连接和状态同步

---

## 文件详解

### 1. RemoteSessionManager.ts — 远程会话管理器

管理远程会话的完整生命周期：创建、连接、断开、恢复。

```typescript
class RemoteSessionManager {
  async createSession(params: CreateSessionParams): Promise<RemoteSession>
  async connectToSession(sessionId: string): Promise<void>
  async disconnectSession(sessionId: string): Promise<void>
  async resumeSession(sessionId: string): Promise<void>
  getActiveSession(): RemoteSession | null
}
```

### 2. SessionsWebSocket.ts — 会话 WebSocket

维护与远程服务器的 WebSocket 持久连接，处理消息收发和重连。

```typescript
class SessionsWebSocket {
  // 连接管理
  connect(url: string, auth: AuthHeaders): void
  disconnect(): void

  // 消息处理
  onMessage(handler: (msg: SDKMessage) => void): void
  send(message: SDKMessage): void

  // 自动重连
  private reconnectWithBackoff(): void
}
```

### 3. remotePermissionBridge.ts — 远程权限桥接

在远程会话中将权限请求代理到本地用户，确保远程 Agent 的操作经过用户授权。

```
远程 Agent 请求权限
    ↓
remotePermissionBridge 接收
    ↓
转发到本地 CLI 的权限对话框
    ↓
用户允许/拒绝
    ↓
结果回传给远程 Agent
```

### 4. sdkMessageAdapter.ts — SDK 消息适配器

在远程会话的消息格式和本地 SDK 消息格式之间进行转换。

```typescript
// 远程格式 → 本地格式
function adaptRemoteToLocal(remoteMsg: RemoteMessage): SDKMessage

// 本地格式 → 远程格式
function adaptLocalToRemote(localMsg: SDKMessage): RemoteMessage
```
