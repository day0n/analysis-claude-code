# 33 - upstreamproxy 模块源码分析

> 路径: `src/upstreamproxy/`
> 文件数: 2 个
> 功能: 上游代理 — CCR 环境中的 CONNECT-over-WebSocket 代理隧道

---

## 模块概述

`upstreamproxy/` 实现了 CCR（Claude Code Remote）环境中的上游代理系统。当 Claude Code 在远程容器中运行时，工具（如 curl、gh、kubectl）的 HTTPS 请求需要通过代理隧道转发，由服务端注入组织配置的凭证（如 DD-API-KEY）。

---

## 1. relay.ts — CONNECT-over-WebSocket 中继

**行数**: 456 行

### 导出
- `encodeChunk(data)` — 编码 protobuf UpstreamProxyChunk 消息
- `decodeChunk(buf)` — 解码 protobuf 块
- `UpstreamProxyRelay` 类型 — `{ port: number, stop: () => void }`
- `startUpstreamProxyRelay(opts)` — 启动中继服务器
- `startNodeRelay(wsUrl, authHeader, wsAuthHeader)` — Node.js 特定实现

### 架构

```
工具 (curl/gh/kubectl)
    ↓ HTTP CONNECT
本地 TCP 服务器 (localhost:ephemeral)
    ↓ WebSocket 隧道
CCR upstreamproxy 端点
    ↓ MITM TLS + 凭证注入
真实上游服务器
```

### 连接状态机

```
Phase 1: 累积 CONNECT 请求
    ↓ (直到 CRLF CRLF 终止符)
Phase 2: 打开 WebSocket 隧道（带认证头）
    ↓
Phase 3: 双向字节转发
    ├── 客户端 → 服务器: encodeChunk() → WebSocket
    └── 服务器 → 客户端: WebSocket → decodeChunk() → TCP
```

### Protobuf 编码（手写）

```typescript
// 手写 protobuf wire format，避免引入 protobuf 库
// UpstreamProxyChunk: field 1, wire type 2 (length-delimited)
function encodeChunk(data: Uint8Array): Uint8Array {
  const tag = 0x0a  // field 1, wire type 2
  const len = encodeVarint(data.length)
  return concat([tag], len, data)
}
```

### 双运行时支持

```typescript
if (typeof Bun !== 'undefined') {
  // Bun: 需要显式写缓冲管理（背压处理）
  return startBunRelay(wsUrl, auth)
} else {
  // Node.js: 内部缓冲
  return startNodeRelay(wsUrl, auth)
}
```

### 关键参数
- 最大块大小: 512KB
- Keepalive: 每 30 秒发送空块
- 错误处理: 隧道建立前返回 502 Bad Gateway；建立后静默关闭

---

## 2. upstreamproxy.ts — 代理系统初始化

**行数**: 286 行

### 导出
- `SESSION_TOKEN_PATH = '/run/ccr/session_token'`
- `initUpstreamProxy(opts?)` — 初始化代理系统
- `getUpstreamProxyEnv()` — 获取子进程环境变量
- `resetUpstreamProxyForTests()` — 测试重置

### 初始化流程

```
initUpstreamProxy()
    ├── 1. 守卫: 仅在 CLAUDE_CODE_REMOTE && CCR_UPSTREAM_PROXY_ENABLED 时执行
    ├── 2. 令牌: 读取 /run/ccr/session_token → 读后即删
    ├── 3. 安全: prctl(PR_SET_DUMPABLE, 0) 阻止 ptrace
    ├── 4. CA 证书: 下载 + 合并到 ~/.ccr/ca-bundle.crt
    ├── 5. 中继: startUpstreamProxyRelay() → 获取本地端口
    └── 6. 环境变量: HTTPS_PROXY, SSL_CERT_FILE, NODE_EXTRA_CA_CERTS 等
```

### NO_PROXY 排除列表
localhost, 127.0.0.1, RFC1918, IMDS, api.anthropic.com, github.com, registry.npmjs.org 等

### Fail-Open 设计
任何错误只记录警告，不中断会话。

---

## 设计亮点

1. **零依赖 Protobuf**: 手写 wire format，避免引入 protobuf 库
2. **双运行时**: Bun 和 Node.js 各自的背压处理
3. **安全加固**: prctl 防 ptrace、令牌读后即删、CA 证书管理
4. **Fail-Open**: 代理失败不阻断会话
5. **凭证注入**: 服务端 MITM 注入组织凭证，客户端无需感知
