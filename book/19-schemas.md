# 19 - schemas 模块源码分析

> 路径: `src/schemas/`
> 功能: Zod Schema 定义 — 运行时类型验证

---

## hooks.ts — 钩子 Schema

**行数**: 223 行

### 核心设计

使用 `lazySchema` 打破循环依赖（settings/types.ts ↔ plugins/schemas.ts）。

### 四种钩子类型的 discriminated union

```typescript
const HookCommandSchema = z.discriminatedUnion('type', [
  // Shell 命令钩子
  z.object({
    type: z.literal('command'),
    command: z.string(),
    shell: z.enum(SHELL_TYPES).optional(),
    timeout: z.number().optional(),
    if: IfConditionSchema.optional(),
    statusMessage: z.string().optional(),
    once: z.boolean().optional(),
    asyncRewake: z.boolean().optional(),
  }),

  // LLM 提示钩子
  z.object({
    type: z.literal('prompt'),
    prompt: z.string(),
    model: z.string().optional(),
    timeout: z.number().optional(),
    if: IfConditionSchema.optional(),
  }),

  // HTTP Webhook 钩子
  z.object({
    type: z.literal('http'),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
    allowedEnvVars: z.array(z.string()).optional(),
    timeout: z.number().optional(),
  }),

  // Agent 验证器钩子
  z.object({
    type: z.literal('agent'),
    prompt: z.string(),
    model: z.string().optional(),
    timeout: z.number().optional(),
  }),
])
```

### 匹配器 Schema

```typescript
const HookMatcherSchema = z.object({
  matcher: z.string().optional(),  // glob 模式，如 "Bash(git *)"
  hooks: z.array(HookCommandSchema),
})
```

### 完整钩子配置

```typescript
const HooksSchema = z.record(
  z.enum(HOOK_EVENTS),           // PreToolUse, PostToolUse, Stop, ...
  z.array(HookMatcherSchema)
).partial()
```

### IfConditionSchema — 条件过滤

```typescript
// 可选的权限规则语法，控制钩子何时运行
// 例如: "Bash(git *)" 只在 Bash 工具执行 git 命令时触发
const IfConditionSchema = z.string()
```

### 设计亮点

1. **lazySchema**: 使用懒加载打破 settings/types.ts 和 plugins/schemas.ts 之间的循环依赖
2. **discriminated union**: 通过 `type` 字段实现类型安全的钩子路由
3. **独立提取**: 从 settings/types.ts 中提取出来，避免循环引用
