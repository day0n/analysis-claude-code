# 18 - types 模块源码分析

> 路径: `src/types/`
> 文件数: ~11 个
> 功能: 全局类型定义 — 消息、工具、权限、设置等核心类型

---

## 核心类型

### message.ts — 消息类型

```typescript
type Message = {
  role: 'user' | 'assistant'
  content: ContentBlock[]
  id?: string
  timestamp?: number
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: ImageSource }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown }
  | { type: 'thinking'; thinking: string }
```

### ids.ts — ID 类型（品牌类型）

```typescript
// 使用品牌类型防止 ID 混用
type SessionId = string & { __brand: 'SessionId' }
type TaskId = string & { __brand: 'TaskId' }
type AgentId = string & { __brand: 'AgentId' }
```

### permissions.ts — 权限类型

```typescript
type PermissionMode = 'default' | 'auto' | 'bypassAll'

type PermissionRequest = {
  toolName: string
  toolInput: unknown
  requestId: string
}

type PermissionUpdate = {
  behavior: 'allow' | 'deny'
  rule?: string  // 持久化规则
}
```

### settings.ts — 设置类型

```typescript
interface Settings {
  model?: string
  theme?: string
  vimMode?: boolean
  autoMemory?: boolean
  permissions?: PermissionRule[]
  hooks?: HooksSettings
  env?: Record<string, string>
  mcpServers?: Record<string, MCPServerConfig>
  // ...
}
```

### tool.ts — 工具相关类型

```typescript
interface ToolUseContext {
  sessionId: SessionId
  agentId?: AgentId
  cwd: string
  abortSignal: AbortSignal
}
```

### hooks.ts — 钩子系统类型

```typescript
interface HookContext {
  messages: Message[]
  systemPrompt: string
  toolName?: string
  toolInput?: unknown
  toolResult?: unknown
}

type HookCallback = (context: HookContext) => Promise<HookResult>
```

### mcp.ts — MCP 协议类型

```typescript
interface MCPServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

interface MCPTool {
  name: string
  description: string
  inputSchema: JSONSchema
}
```

### theme.ts — 主题类型

```typescript
type Theme = 'dark' | 'light' | 'light-daltonized' | 'dark-daltonized'
```

### model.ts — 模型配置类型

```typescript
interface ModelSetting {
  model: string
  contextWindow: number
  maxOutputTokens: number
}
```

### agent.ts — Agent 类型

```typescript
interface AgentDefinition {
  name: string
  description: string
  model?: string
  tools?: string[]
  systemPrompt?: string
  source: 'built-in' | 'user' | 'project' | 'plugin'
}
```

### plugin.ts — 插件类型

```typescript
interface Plugin {
  id: string
  name: string
  version: string
  enabled: boolean
  scope: 'user' | 'project' | 'local'
}
```
