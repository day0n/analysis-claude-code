# 18 - types 模块源码分析

> 路径: `src/types/`
> 文件数: 7 个 .ts 文件 + 1 个 generated/ 子目录
> 总行数: 2071 行
> 功能: 全局类型定义 — 命令、钩子、ID、日志、权限、插件、文本输入

---

## 文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `command.ts` | 216 | 命令类型定义 |
| `hooks.ts` | 290 | 钩子系统类型（Zod schema + 类型守卫） |
| `ids.ts` | 44 | 品牌类型 ID（SessionId, AgentId） |
| `logs.ts` | 330 | 日志类型定义 |
| `permissions.ts` | 441 | 权限类型（模式、规则、请求、更新） |
| `plugin.ts` | 363 | 插件类型（BuiltinPluginDefinition 等） |
| `textInputTypes.ts` | 387 | 文本输入类型 |
| `generated/` | — | 自动生成的类型（events_mono, google 子目录） |

---

## 核心类型详解

### ids.ts — ID 品牌类型

```typescript
// 使用品牌类型防止 ID 混用
type SessionId = string & { readonly __brand: 'SessionId' }
type AgentId = string & { readonly __brand: 'AgentId' }

// 类型转换辅助函数
function asSessionId(id: string): SessionId
function asAgentId(id: string): AgentId
```

> 注意：不存在 `TaskId` 品牌类型，任务 ID 使用普通 `string`。

### permissions.ts — 权限类型

```typescript
// 外部权限模式
const EXTERNAL_PERMISSION_MODES = [
  'acceptEdits', 'bypassPermissions', 'default', 'dontAsk', 'plan'
] as const

type ExternalPermissionMode = typeof EXTERNAL_PERMISSION_MODES[number]

// 内部权限模式（扩展外部模式）
type InternalPermissionMode = ExternalPermissionMode | 'auto' | 'bubble'
type PermissionMode = InternalPermissionMode
```

### hooks.ts — 钩子系统类型

```typescript
// 从 agentSdkTypes.ts 导入核心类型
import { type HookEvent, HOOK_EVENTS, type HookInput, type PermissionUpdate }
  from 'src/entrypoints/agentSdkTypes.js'

// 类型守卫
function isHookEvent(value: string): value is HookEvent

// Prompt elicitation 协议类型
const promptRequestSchema = z.object({ prompt: z.string() })
```

### plugin.ts — 插件类型

```typescript
type BuiltinPluginDefinition = {
  name: string
  description: string
  version?: string
  skills?: BundledSkillDefinition[]
  hooks?: HooksSettings
  mcpServers?: Record<string, McpServerConfig>
  lspServers?: Record<string, LspServerConfig>
}
```

### command.ts — 命令类型

定义斜杠命令的类型接口，包括命令注册、加载和执行的类型。

### logs.ts — 日志类型

定义结构化日志的类型系统。

### textInputTypes.ts — 文本输入类型

定义文本输入组件的类型，包括输入模式、光标位置、选择范围等。
