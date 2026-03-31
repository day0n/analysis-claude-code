# 23 - server 模块源码分析

> 路径: `src/server/`
> 文件数: 3 个
> 功能: DirectConnect 会话管理 — 创建和管理直连会话

---

## 模块概述

`server/` 模块实现的是 **DirectConnect 会话管理**，用于在远程服务器上创建和管理 Claude Code 会话。它不是传统的 HTTP/WebSocket 服务器。

---

## 文件清单

| 文件 | 说明 |
|------|------|
| `createDirectConnectSession.ts` | 创建 DirectConnect 会话（向远程服务器发起连接请求） |
| `directConnectManager.ts` | DirectConnect 管理器（会话配置、连接状态管理） |
| `types.ts` | 类型定义（连接响应 schema、配置类型） |

---

## 核心逻辑

### createDirectConnectSession.ts

```typescript
class DirectConnectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DirectConnectError'
  }
}

// 在 DirectConnect 服务器上创建会话
async function createDirectConnectSession(config: DirectConnectConfig): Promise<ConnectResponse>
```

### directConnectManager.ts

管理 DirectConnect 的配置和连接状态，提供 `DirectConnectConfig` 类型。

### types.ts

```typescript
// 连接响应的 Zod schema
const connectResponseSchema = z.object({ ... })
```

---

## 与其他模块的关系

```
server/
├── ← screens/REPL.tsx (type-only import: DirectConnectConfig)
├── ← remote/ (远程会话使用 DirectConnect)
└── → utils/errors.js (错误处理)
```

> 注意：IDE 扩展通信和 WebSocket 桥接功能由 `bridge/` 模块实现，不在 `server/` 中。
