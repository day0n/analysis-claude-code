# 02 - entrypoints 模块源码分析

> 路径: `src/entrypoints/`
> 功能: 多入口点系统，支持 CLI、SDK、MCP 三种运行模式

---

## 模块概述

`entrypoints/` 定义了 Claude Code 的多种启动方式。不同的入口点决定了应用以何种模式运行——交互式 CLI、程序化 SDK、还是 MCP 服务器。

## 文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `cli.tsx` | ~2000+ | CLI 主入口（最大文件） |
| `mcp.ts` | 197 | MCP 服务器入口 |
| `sandboxTypes.ts` | 157 | 沙箱类型定义 |
| `agentSdkTypes.ts` | ~500+ | Agent SDK 类型定义 |
| `sdk/coreTypes.ts` | 63 | SDK 核心类型 |
| `sdk/controlSchemas.ts` | 664 | SDK 控制协议 Schema |

---

## 1. cli.tsx — CLI 主入口

**行数**: 302 行（比预期小得多，大量逻辑已拆分到其他模块）

### 功能概述
这是用户在终端执行 `claude` 命令时的入口点。负责完整的 CLI 生命周期管理。

### 核心流程

```
命令行解析 → 认证检查 → 模式路由 → 屏幕渲染 → 退出处理
```

### 详细步骤

1. **命令行参数解析**
   - 使用自定义解析器处理参数
   - 支持子命令: `auth`, `config`, `doctor`, `mcp`, `plugin` 等
   - 支持标志: `--print`, `--resume`, `--continue`, `--model` 等

2. **认证流程**
   - 检查 OAuth token 有效性
   - 支持 API Key 和 OAuth 两种认证方式
   - 处理 token 刷新

3. **模式路由**
   ```
   claude                    → 交互式 REPL
   claude -p "prompt"        → 非交互式打印模式
   claude --resume           → 恢复会话
   claude doctor             → 诊断模式
   claude auth login         → 认证登录
   claude config             → 配置管理
   claude mcp                → MCP 服务器管理
   ```

4. **屏幕渲染**
   - 使用 Ink 渲染 React 组件到终端
   - 管理终端原始模式
   - 处理窗口大小变化

5. **退出处理**
   - 保存会话状态
   - 清理临时资源
   - 发送遥测数据

---

## 2. mcp.ts — MCP 服务器入口

**行数**: 197 行

### 功能概述
将 Claude Code 作为 MCP (Model Context Protocol) 服务器运行，允许其他 AI 应用通过标准协议调用 Claude Code 的工具。

### 导出
- MCP 服务器启动函数

### 核心逻辑

```typescript
// 伪代码
async function startMCPServer() {
  // 1. 初始化 MCP 传输层（stdio）
  const transport = new StdioTransport()

  // 2. 注册可用工具
  const tools = loadTools()

  // 3. 处理 MCP 请求
  transport.onRequest(async (request) => {
    switch (request.method) {
      case 'tools/list':
        return { tools: tools.map(t => t.toMCPSchema()) }
      case 'tools/call':
        return await executeTool(request.params)
    }
  })

  // 4. 启动服务器
  await transport.start()
}
```

### MCP 协议支持
- `ListToolsRequest` — 列出可用工具（含 Zod→JSON Schema 转换）
- `CallToolRequest` — 调用工具（含输入验证和权限检查）
- 注意：当前**不支持** resources 相关处理（无 `resources/list` 或 `resources/read`）

---

## 3. sandboxTypes.ts — 沙箱类型定义

**行数**: 156 行

### 功能概述
使用 Zod Schema 定义沙箱环境的配置和权限，不是简单的 interface。

### 核心 Schema

```typescript
// 实际是 Zod schema，包含细粒度配置
const SandboxConfigSchema = z.object({
  network: z.object({ ... }),           // 网络访问控制
  filesystem: z.object({
    allowRead: z.array(z.string()),     // 允许读取的路径
    denyRead: z.array(z.string()),      // 禁止读取的路径
    allowManagedDomainsOnly: z.boolean(), // 仅允许托管域名
  }),
  // ... 更多细粒度配置
})
```

---

## 4. agentSdkTypes.ts — Agent SDK 类型定义

**行数**: ~500+ 行

### 功能概述
定义 Agent SDK 的完整类型系统，包括消息格式、事件类型和钩子事件。

### 核心类型

```typescript
// SDK 消息类型
type SDKMessage = {
  type: 'usesistant' | 'system' | 'tool_use' | 'tool_result'
  content: ContentBlock[]
  // ...
}

// 钩子事件类型
type HookEvent =
  | 'PreToolUse'      // 工具执行前
  | 'PostToolUse'     // 工具执行后
  | 'Stop'            // 回合结束
  | 'TeammateIdle'    // 队友空闲
  | 'TaskCompleted'   // 任务完成
  | 'Notification'    // 通知
  | 'SubagentStop'    // 子Agent停止

// 导出的常量
const HOOK_EVENTS: HookEvent[] = [...]
```

### 设计特点
- 使用 discriminated union 实现类型安全的消息路由
- 钩子事件覆盖完整的工具生命周期
- 支持子 Agent 和队友模式的事件

---

## 5. sdk/coreTypes.ts — SDK 核心类型

**行数**: 63 行

### 功能概述
SDK 的最基础类型定义，被其他 SDK 文件广泛引用。

### 导出

```typescript
// 内容块类型
type ContentBlockParam =
  | TextBlock
  | ImageBlock
  | ToolUseBlock
  | ToolResultBlock

// 消息角色
type Role = 'user' | 'assistant'

// 停止原因
type StopReason =
  | 'end_turn'        // 正常结束
  | 'max_tokens'      // 达到 token 上限
  | 'stop_sequence'   // 遇到停止序列
  | 'tool_use'        // 需要执行工具
```

---

## 6. sdk/controlSchemas.ts — SDK 控制协议 Schema

**行数**: 664 行

### 功能概述
使用 Zod 定义 SDK 控制协议的完整 Schema，用于 CLI 和 Web/IDE 之间的双向通信。

### 控制请求类型

```typescript
// 服务器 → 客户端的控制请求
type ServerControlRequest =
  | { type: 'initialize', payload: InitializePayload }
   type: 'set_model', payload: SetModelPayload }
  | { type: 'interrupt', payload: InterruptPayload }
  | { type: 'set_permission_mode', payload: SetPermissionModePayload }
  | { type: 'set_max_thinking_tokens', payload: SetMaxThinkingTokensPayload }
```

### 控制响应类型

```typescript
// 客户端 → 服务器的控制响应
type ClientControlResponse = {
  requestId: string
  success: boolean
  error?: string
  data?: unknown
}
```

### Schema 验证
- 所有控制消息都经过 Zod Schema 验证
- 支持版本协商
- 类型安全的序列化/反序列化

---

## 模块间关系

```
entrypoints/
├── cli.tsx ──────────→ screens/REPL.tsx (交互模式)
│                    → screens/Doctor.tsx (诊断模式)
│                    → screens/ResumeConversation.tsx (恢复模式)
│
├── mcp.ts ──────────→ tools/ (注册工具为 MCP 资源)
│
├── agentSdkTypes.ts → 被 bridge/, hooks/, query/ 广泛引用
│
└── sdk/
    ├── coreTypes.ts → 基础类型，被所有 SDK 相关代码引用
    └── controlSchemas.ts → 被 bridge/ 用于消息验证
```

## 设计亮点

1. **多入口架构**: 同一套核心代码支持 CLI、SDK、MCP 三种运行模式
2. **协议分层**: 控制协议与业务逻辑分离，Schema 独立定义
3. **类型驱动**: 使用 Zod Schema 同时提供运行时验证和编译时类型
4. **渐进式复杂度**: 从简单的 MCP 服务器到完整的交互式 CLI，复杂度逐层递增
