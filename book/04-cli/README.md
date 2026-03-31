# 04 - cli 模块源码分析

> 路径: `src/cli/`
> 功能: CLI 传输层、IO 处理、子命令处理器

---

## 模块概述

`cli/` 模块负责 CLI 的底层通信基础设施，包括传输协议（WebSocket/SSE/HTTP）、结构化 IO、子命令处理器和输出格式化。

## 文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `structuredIO.ts` | 859 | SDK 消息协议核心实现 |
| `remoteIO.ts` | 255 | 远程双向流式 IO |
| `print.ts` | 5594 | 输出打印/格式化（最大文件） |
| `ndjsonSafeStringify.ts` | 33 | NDJSON 安全序列化 |
| `exit.ts` | 32 | 退出辅助函数 |
| `update.ts` | 422 | 版本更新检查 |
| `handlers/auth.ts` | 331 | OAuth 认证处理 |
| `handlers/plugins.ts` | 879 | 插件管理处理 |
| `handlers/autoMode.ts` | 171 | 自动模式配置 |
| `handlers/agents.ts` | 71 | Agent 列表显示 |
| `handlers/util.tsx` | 110 | 杂项子命令 |
| `handlers/mcp.tsx` | 361 | MCP 服务器管理 |
| `transports/HybridTransport.ts` | 283 | 混合传输（WS读+HTTP写） |
| `transports/WebSocketTransport.ts` | ~200 | WebSocket 传输 |
| `transports/SSETransport.ts` | ~200 | SSE 传输 |
| `transports/SerialBatchEventUploader.ts` | ~150 | 批量事件上传 |
| `transports/WorkerStateUploader.ts` | ~100 | Worker 状态上传 |
| `transports/ccrClient.ts` | ~200 | CCR v2 客户端 |
| `transports/transportUtils.ts` | ~100 | 传输工具函数 |

---

## 核心文件详解

### 1. structuredIO.ts — SDK 消息协议核心

**行数**: 859 行

#### 功能概述
实现 SDK 模式下的完整消息协议，处理控制请求/响应、权限管理、Hook 回调和 MCP 消息转发。

#### 导出
- `StructuredIO` 类
- `SANDBOX_NETWORK_ACCESS_TOOL_NAME` 常量

#### 核心架构

```
外部客户端 (Web/IDE/SDK)
    ↕ JSON 消息
StructuredIO
    ├── 控制请求处理 (control_request)
    │   ├── initialize
    │   ├── set_model
    │   ├── interrupt
    │   ├── set_permission_mode
    │   └── set_max_thinking_tokens
    │
    ├── 控制响应处理 (control_response)
    │   └── 权限请求的响应
    │
    ├── 权限管理
    │   ├── sendPermissionRequest()
    │   ├── handlePermissionResponse()
    │   └── cancelPermissionRequest()
    │
    ├── Hook 回调
    │   └── 转发 hook 执行结果
    │
    └── MCP 消息转发
        └── 透传 MCP 协议消息
```

#### 关键实现细节

```typescript
class StructuredIO {
  // 防重复：追踪已处理的 tool_use ID
  private readonly resolvedToolUseIds = new Set<string>()

  // 消息发送（带 NDJSON 安全序列化）
  send(message: SDKMessage): void {
    const json = ndjsonSafeStringify(message)
    this.transport.write(json + '\n')
  }

  // 控制请求处理
  async handleControlRequest(request: ServerControlRequest): Promise<void> {
    switch (request.type) {
      case 'initialize':
        // 版本协商、能力交换
        break
      case 'set_model':
        // 运行时模型切换
        setMainLoopModelOverride(request.payload.model)
        break
      case 'interrupt':
        // 中断当前执行
        this.abortController.abort()
        break
    }
  }
}
```

---

### 2. remoteIO.ts — 远程双向流式 IO

**行数**: 255 行

#### 功能概述
扩展 `StructuredIO`，添加远程会话支持（WebSocket/SSE 传输、会话令牌刷新和 keep-alive 机制）。

#### 导出
- `RemoteIO` 类（继承 `StructuredIO`）

#### 核心特性

```typescript
class RemoteIO extends StructuredIO {
  // CCR v2 客户端集成
  private ccrClient: CCRClient

  // 120 秒 keep-alive 帧
  private keepAliveInterval = setInterval(() => {
    this.send({ type: 'keep_alive' })
  }, 120_000)

  // 动态会话令牌刷新
  async refreshSessionToken(): Promise<void> {
    const newToken = await this.ccrClient.refreshToken()
    this.transport.updateAuth(newToken)
  }
}
```

---

### 3. ndjsonSafeStringify.ts — NDJSON 安全序列化

**行数**: 33 行

#### 功能概述
解决 NDJSON（Newline DeliON）传输中的 Unicode 行终止符问题。

#### 核心逻辑

```typescript
export function ndjsonSafeStringify(value: unknown): string {
  const json = JSON.stringify(value)
  // 转义 U+2028 (行分隔符) 和 U+2029 (段落分隔符)
  // 这两个 Unicode 字符在 JSON 中合法，但会破坏 NDJSON 的行分割
  return json.replace(/[\u2028\u2029]/g, (char) =>
    char === '\u2028' ? '\\u2028' : '\\u2029'
  )
}
```

---

### 4. handlers/auth.ts — OAuth 认证处理

**行数**: 331 行

#### 功能概述
完整的 OAuth 2.0 认证流程实现，支持 claude.ai 和 Console 两种认证源。

#### 导出
- `installOAuthTokens()` — 安装 OAuth 令牌
- `authLogin()` — 登录流程
- `authStatus()` — 认证状态查询
- `authLogout()` — 登出

####
authLogin()
  ├── 检查环境变量 CLAUDE_CODE_OAUTH_REFRESH_TOKEN（快速路径）
  │   └── 直接使用，跳过浏览器流程
  │
  └── 标准 OAuth 流程
      ├── 启动本地 HTTP 服务器（回调接收）
      ├── 打开浏览器到授权页面
      ├── 等待用户授权
      ├── 接收授权码
      ├── 交换 access_token + refresh_token
      ├── 获取用户 profile
      ├── 创建 API Key（如需要）
      └── 存储令牌到本地
```

#### 令牌存储
- 令牌存储在 `~/.claude/` 目录下
- 支持多账户切换
- 自动刷新过期令牌

---

### 5. handlers/plugins.ts — 插件管理处理

**行数**: 879 行

#### 功能概述
完整的插件生命周期管理，包括安装、卸载、启用、禁用、更新和市场操作。

#### 导出
- 多个插件操作处理函数

#### 支持的操作

| 操作 | 说明 |
|------|------|
| install | 安装插件（从市场或本地路径） |
| uninstall | 卸载插件 |
| enable | 启用已安装的插件 |
| disable | 禁用插件（保留安装） |
| update | 更新插件到最新版本 |
| list | 列出已安装插件 |
| search | 搜索市场插件 |

#### 作用域

```typescript
type PluginScope = 'user' | 'project' | 'local'

// user: ~/.claude/plugins/ — 全局插件
// project: .claude/plugins/ — 项目级插件
// local: 本地路径引用
```

#### --cowork 标志
支持 `--cowork` 标志，启用协作插件模式。

---

### 6. handlers/autoMode.ts — 自动模式配置

**行数**: 171 行

#### 功能概述
管理自动模式的分类器规则，控制哪些操作自动允许、软拒绝或受环境限制。

#### 导出
- `autoModeDefaultsHandler()` — 默认规则管理
- `autoModeConfigHandler()` — 规则配置
- `autoModeCritiqueHandler()` — 规则审查（使用 LLM）

#### 规则类别

```typescript
type RuleCategory = 'allow' | 'soft_deny' | 'environment'

// allow: 自动允许的操作（如读取文件）
// soft_deny: 软拒绝（提示用户确认）
// environment: 环境限制（如网络访问）
```

#### LLM 审查
`autoModeCritiqueHandler` 使用 LLM 来审查用户编写的规则，确保规则的合理性和安全性。

---

## 传输层架构

### HybridTransport — 混合传输

**行数**: 283 行

```
┌─────────────────────────────────────┐
│          HybridTransport            │
├─────────────────────────────────────┤
│  读取: WebSocket (实时推送)          │
│  写入: HTTP POST (批量上传)          │
├─────────────────────────────────────┤
│  SerialBatchEventUploader           │
│  ├── 100ms 缓冲窗口                 │
│  ├ stream_event          │
│  └── 指数退避重试                    │
├─────────────────────────────────────┤
│  超时配置:                           │
│  ├── POST 超时: 15 秒               │
│  └── 关闭优雅期: 3 秒               │
└─────────────────────────────────────┘
```

#### 设计原因
- WebSocket 适合实时读取（低延迟推送）
- HTTP POST 适合可靠写入（自动重试、批量合并）
- 混合模式兼顾了实时性和可靠性

---

## 模块依赖关系

```
cli/
├── structuredIO.ts ← entrypoints/sdk/ (类型定义)
│   └── remoteIO.ts (继承扩展)
│
├── handlers/
│   ├── auth.ts ← constantsh 配置)
│   ├── plugins.ts ← services/ (插件服务)
│   ├── autoMode.ts ← services/api/ (LLM 调用)
│   └── mcp.tsx ← tools/ (MCP 工具注册)
│
└── transports/
    ├── HybridTransport.ts
    │   ├── WebSocketTransport.ts (基类)
    │   └── SerialBatchEventUploader.ts (批量上传)
    ├── SSETransport.ts
    └── ccrClient.ts (CCR v2 协议)
```
