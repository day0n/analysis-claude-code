# 23 - server 模块源码分析

> 路径: `src/server/`
> 功能: HTTP/WebSocket 服务器 — IDE 扩展和 Web UI 的通信后端

---

## 功能概述

提供 HTTP 和 WebSocket 服务器，用于：
- IDE 扩展通信（VS Code / JetBrains）
- Web UI 桥接（claude.ai/code）
- MCP 服务器托管
- 健康检查端点 (`/health`)
- 会话状态查询 (`/status`)

---

## 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查，返回 200 |
| `/status` | GET | 会话状态（消息数、费用、模型等） |
| `/ws` | WebSocket | 双向消息通道 |
| `/mcp` | WebSocket/stdio | MCP 协议端点 |

---

## WebSocket 通信

```
IDE 扩展 / Web UI
    ↕ WebSocket (/ws)
Server
    ↕ 内部事件
REPL / Query Engine
```

### 消息类型

```typescript
// 服务器 → 客户端
type ServerMessage =
  | { type: 'message'; message: SDKMessage }
  | { type: 'status'; status: SessionStatus }
  | { type: 'permission_request'; request: PermissionRequest }

// 客户端 → 服务器
type ClientMessage =
  | { type: 'user_message'; content: string }
  | { type: 'permission_response'; response: PermissionUpdate }
  | { type: 'control_request'; request: ServerControlRequest }
```

---

## 与其他模块的关系

```
server/
├── ← bridge/ (桥接通信使用 server 的 WebSocket)
├── ← cli/transports/ (传输层连接到 server)
├── → screens/REPL.tsx (转发用户消息)
└── → services/mcp/ (托管 MCP 服务器)
```
