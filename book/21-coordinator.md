# 21 - coordinator 模块源码分析

> 路径: `src/coordinator/`
> 文件数: 1 个
> 功能: 多会话协调器 — Spawn 模式下的并发会话管理

---

## coordinatorMode.ts

**行数**: 370 行

### 功能概述
管理多个并发会话的协调，支持从 Web UI 创建多个并行会话（Spawn 模式）。

### 核心概念

```
Coordinator（协调器）
├── 管理多个并发 Session
├── 容量控制（限制同时运行数）
├── 消息路由（将消息分发到正确的 Session）
├── 生命周期管理（创建/销毁 Session）
└── 状态同步（向 Web UI 报告状态）
```

### Spawn 模式类型

| 模式 | 说明 |
|------|------|
| single-session | 单会话（默认） |
| same-dir | 同目录多会话 |
| worktree | 每个会话独立 git worktree |

### 容量管理

```typescript
// 限制同时运行的会话数量
const MAX_CONCURRENT_SESSIONS = 5

function canSpawnNewSession(): boolean {
  return getRunningSessionCount() < MAX_CONCURRENT_SESSIONS
}
```

### 会话路由

```
Web UI 发送消息
    ↓
Coordinator 接收
    ↓
根据 sessionId 路由
    ├── 已有会话 → 转发到对应 Session
    └── 新会话请求 → 检查容量 → 创建新 Session
```

### 状态同步

```typescript
// 向 Web UI 报告所有会话状态
function broadcastStatus(): void {
  const sessions = getActiveSessions()
  bridge.send({
    type: 'coordinator_status',
    sessions: sessions.map(s => ({
      id: s.id,
      title: s.title,
      status: s.status,
      activity: s.currentActivity,
    }))
  })
}
```
